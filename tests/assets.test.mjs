import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { getSampleAssets, validateAsset, searchAssets, deriveUnits } = createRequire(import.meta.url)("../src/assets.js");

const valid = {
  id: "AST-2000", name: "Test parcel", type: "Land parcel", status: "Active",
  address: "North field", country: "United Kingdom", latitude: "51.5",
  longitude: "-0.12", crs: "WGS 84 (EPSG:4326)"
};

test("sample records have unique stable IDs and satisfy required location/type fields", () => {
  const assets = getSampleAssets();
  assert.equal(new Set(assets.map(asset => asset.id)).size, assets.length);
  for (const asset of assets) {
    assert.deepEqual(validateAsset({
      ...asset,
      latitude: asset.location.latitude,
      longitude: asset.location.longitude,
      crs: asset.location.crs
    }, assets, asset.id), []);
  }
});

test("valid asset passes and missing descriptive/location fields fail", () => {
  assert.deepEqual(validateAsset(valid), []);
  const errors = validateAsset({ ...valid, name: "", country: "", latitude: "91" });
  assert.ok(errors.some(error => error.includes("display name")));
  assert.ok(errors.some(error => error.includes("country")));
  assert.ok(errors.some(error => error.includes("Latitude")));
});

test("longitude range and duplicate stable identifier are enforced", () => {
  assert.ok(validateAsset({ ...valid, longitude: "181" }).some(error => error.includes("Longitude")));
  assert.ok(validateAsset({ ...valid, id: "ast-1001" }, getSampleAssets()).some(error => error.includes("already in use")));
});

test("search covers name, address, identifier, and filters by type/status", () => {
  const assets = getSampleAssets();
  assert.equal(searchAssets(assets, "riverside").length, 4);
  assert.equal(searchAssets(assets, "AST-1004")[0].name, "Exchange — Suite 4B");
  assert.equal(searchAssets(assets, "", "Site", "Inactive").length, 1);
});

test("building Units are derived from inverse active Unit part_of links", () => {
  const assets = getSampleAssets();
  const building = assets.find(asset => asset.id === "AST-1003");
  assert.deepEqual(deriveUnits(building, assets).map(unit => unit.id), ["AST-1004"]);
  const ended = structuredClone(assets);
  ended.find(asset => asset.id === "AST-1004").relationships[0].status = "Ended";
  assert.deepEqual(deriveUnits(building, ended), []);
});

test("self links, duplicate active links, and invalid Unit links are rejected", () => {
  const assets = getSampleAssets();
  const unit = assets.find(asset => asset.id === "AST-1004");
  assert.ok(validateAsset({ ...valid, id: unit.id, type: "Unit", relationship: { type: "part_of", targetId: unit.id } }, assets, unit.id).some(error => error.includes("itself")));
  assert.ok(validateAsset({ ...valid, id: unit.id, type: "Unit", relationship: { type: "part_of", targetId: "AST-1003" } }, assets, unit.id).some(error => error.includes("already exists")));
  assert.ok(validateAsset({ ...valid, type: "Unit", relationship: { type: "located_on", targetId: "AST-1003" } }, assets).some(error => error.includes("enclosing Building")));
});

test("a new Unit must name an enclosing Building", () => {
  assert.ok(validateAsset({ ...valid, type: "Unit" }, getSampleAssets()).some(error => error.includes("active part_of link")));
  assert.deepEqual(validateAsset({ ...valid, type: "Unit", relationship: { type: "part_of", targetId: "AST-1003" } }, getSampleAssets()), []);
});
