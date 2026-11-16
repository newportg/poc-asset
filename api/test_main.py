import asyncio
import os
import tempfile
import unittest
from unittest.mock import patch

import main


class AssetApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.database = tempfile.NamedTemporaryFile(delete=False)
        self.database.close()
        main.DATABASE_PATH = self.database.name
        main.initialize_database()
        with main.sqlite3.connect(main.DATABASE_PATH) as connection:
            connection.execute("DELETE FROM assets")
            connection.commit()
        self.addCleanup(lambda: os.unlink(self.database.name))

    def test_asset_crud_persists_full_record(self) -> None:
        source = {
            "id": "AST-1",
            "name": "Riverside Office",
            "address": "1 High Street",
            "location": {"latitude": 51.5, "longitude": -0.1},
            "partyReferences": ["PTY-1"],
        }
        created = asyncio.run(main.create_asset(main.AssetRecord(**source)))
        self.assertEqual(created["address"], source["address"])
        self.assertEqual(asyncio.run(main.get_asset("AST-1"))["location"], source["location"])

        updated = asyncio.run(main.update_asset("AST-1", main.AssetRecord(**{**source, "name": "Updated"})))
        self.assertEqual(updated["name"], "Updated")
        self.assertEqual(len(asyncio.run(main.list_assets()).items), 1)

        self.assertEqual(asyncio.run(main.delete_asset("AST-1")), {"id": "AST-1", "deleted": True})
        with self.assertRaises(main.HTTPException):
            asyncio.run(main.get_asset("AST-1"))

    def test_duplicate_asset_ids_are_rejected(self) -> None:
        asset = main.AssetRecord(id="AST-1")
        asyncio.run(main.create_asset(asset))
        with self.assertRaises(main.HTTPException) as error:
            asyncio.run(main.create_asset(asset))
        self.assertEqual(error.exception.status_code, 409)

    def test_openapi_exposes_address_enrichment_endpoint(self) -> None:
        schema = main.app.openapi()
        self.assertIn("/api/assets/{asset_id}/enrich", schema["paths"])

    def test_enrichment_requires_a_configured_or_request_api_key(self) -> None:
        asyncio.run(main.create_asset(main.AssetRecord(id="AST-1", address="1 High Street")))
        with patch.dict(os.environ, {"LOQATE_API_KEY": ""}):
            with self.assertRaises(main.HTTPException) as error:
                asyncio.run(main.enrich_asset(
                    "AST-1",
                    main.AssetEnrichmentRequest(address="1 High Street", country="GB"),
                ))
        self.assertEqual(error.exception.status_code, 422)
