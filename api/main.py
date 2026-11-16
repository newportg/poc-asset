import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


DATABASE_PATH = os.getenv(
    "ASSET_DB_PATH",
    os.path.join(os.path.dirname(__file__), "asset.db"),
)
ADDRESS_API_BASE_URL = os.getenv("ADDRESS_API_BASE_URL", "http://127.0.0.1:8001").rstrip("/")


class AssetRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1)


class AssetListResponse(BaseModel):
    items: list[dict[str, Any]]


class AssetEnrichmentRequest(BaseModel):
    address: str = Field(min_length=1)
    city: str = ""
    country: str = Field(min_length=2, max_length=2)


def initialize_database() -> None:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                record_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


def read_assets() -> list[dict[str, Any]]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        rows = connection.execute(
            "SELECT record_json FROM assets ORDER BY updated_at DESC, id"
        ).fetchall()
    return [json.loads(row[0]) for row in rows]


def read_asset(asset_id: str) -> dict[str, Any] | None:
    with sqlite3.connect(DATABASE_PATH) as connection:
        row = connection.execute(
            "SELECT record_json FROM assets WHERE id = ?",
            (asset_id,),
        ).fetchone()
    return json.loads(row[0]) if row else None


def write_asset(record: dict[str, Any], *, expected_id: str | None = None) -> dict[str, Any]:
    asset_id = expected_id or str(record["id"])
    now = datetime.now(timezone.utc).isoformat()
    stored = {
        **record,
        "id": asset_id,
        "createdAt": record.get("createdAt") or now,
        "updatedAt": now,
    }
    with sqlite3.connect(DATABASE_PATH) as connection:
        if expected_id is None:
            connection.execute(
                "INSERT INTO assets (id, record_json, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (asset_id, json.dumps(stored), stored["createdAt"], stored["updatedAt"]),
            )
        else:
            connection.execute(
                "UPDATE assets SET record_json = ?, updated_at = ? WHERE id = ?",
                (json.dumps(stored), stored["updatedAt"], asset_id),
            )
        connection.commit()
    return stored


async def enrich_asset_record(
    asset: dict[str, Any],
    request: AssetEnrichmentRequest,
    loqate_api_key: str,
) -> dict[str, Any]:
    headers = {"Accept": "application/json", "X-Loqate-Api-Key": loqate_api_key}
    params = {"q": request.address, "country": request.country.upper()}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            search_response = await client.get(
                f"{ADDRESS_API_BASE_URL}/api/addresses/search",
                params=params,
                headers=headers,
            )
            search_response.raise_for_status()
            search_body = search_response.json()
            matches = search_body.get("items", [])
            if not matches:
                raise HTTPException(status_code=502, detail="Address API returned no matching addresses.")
            retrieve_response = await client.post(
                f"{ADDRESS_API_BASE_URL}/api/addresses/retrieve",
                json={**matches[0], "country": request.country.upper()},
                headers=headers,
            )
            retrieve_response.raise_for_status()
            verified = retrieve_response.json()
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Address API enrichment failed.") from exc

    address_parts = [
        verified.get(key)
        for key in ("Address1", "Address2", "Address3", "Address4", "Address5", "PostalCode")
        if verified.get(key)
    ]
    latitude = _coordinate(verified.get("Latitude"), -90, 90)
    longitude = _coordinate(verified.get("Longitude"), -180, 180)
    enriched = {
        **asset,
        "address": ", ".join(dict.fromkeys(address_parts)) or verified.get("Address") or asset["address"],
        "city": verified.get("Locality") or verified.get("DependentLocality") or asset.get("city", ""),
        "country": verified.get("CountryName") or request.country.upper(),
        "location": {
            **(asset.get("location") or {}),
            "latitude": latitude,
            "longitude": longitude,
            "crs": "WGS 84 (EPSG:4326)",
            "source": "Address API / Loqate verified address",
            "precision": "Verified address" if latitude is not None and longitude is not None else "Verified address without coordinates",
        },
        "loqateResponse": verified,
        "addressVerificationPending": False,
    }
    return write_asset(enriched, expected_id=str(asset["id"]))


def _coordinate(value: Any, minimum: float, maximum: float) -> float | None:
    try:
        coordinate = float(value)
    except (TypeError, ValueError):
        return None
    return coordinate if minimum <= coordinate <= maximum else None


initialize_database()

app = FastAPI(title="Asset API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Accept", "Content-Type", "X-Loqate-Api-Key"],
)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": "Asset API", "docs": "/docs"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/assets", response_model=AssetListResponse)
async def list_assets() -> AssetListResponse:
    return AssetListResponse(items=read_assets())


@app.get("/api/assets/{asset_id}")
async def get_asset(asset_id: str) -> dict[str, Any]:
    asset = read_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return asset


@app.post("/api/assets", status_code=201)
async def create_asset(asset: AssetRecord) -> dict[str, Any]:
    if read_asset(asset.id) is not None:
        raise HTTPException(status_code=409, detail="An Asset with this ID already exists.")
    return write_asset(asset.model_dump())


@app.put("/api/assets/{asset_id}")
async def update_asset(asset_id: str, asset: AssetRecord) -> dict[str, Any]:
    if read_asset(asset_id) is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return write_asset(asset.model_dump(), expected_id=asset_id)


@app.post("/api/assets/{asset_id}/enrich")
async def enrich_asset(
    asset_id: str,
    request: AssetEnrichmentRequest,
    loqate_api_key: str | None = Header(None, alias="X-Loqate-Api-Key"),
) -> dict[str, Any]:
    asset = read_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    api_key = (loqate_api_key or os.getenv("LOQATE_API_KEY", "")).strip()
    if not api_key:
        raise HTTPException(
            status_code=422,
            detail="A Loqate API key is required. Set LOQATE_API_KEY or provide X-Loqate-Api-Key.",
        )
    return await enrich_asset_record(asset, request, api_key)


@app.delete("/api/assets/{asset_id}")
async def delete_asset(asset_id: str) -> dict[str, Any]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        cursor = connection.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return {"id": asset_id, "deleted": True}
