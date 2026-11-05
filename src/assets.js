const STORAGE_KEY = "poc-asset.records.v1";
const ASSET_TYPES = ["Land parcel", "Site", "Estate", "Building", "Unit"];
const STATUSES = ["Active", "Inactive", "Archived"];
const RELATIONSHIP_TYPES = ["part_of", "located_on", "associated_with"];

const sample = [
  {
    id: "AST-1001", name: "Riverside Estate", type: "Estate", status: "Active", sector: "Mixed use", site: "",
    address: "Riverside Quarter, north bank", city: "Bristol", country: "United Kingdom",
    location: { latitude: 51.4545, longitude: -2.5879, crs: "WGS 84 (EPSG:4326)", source: "Illustrative sample point", capturedAt: "2026-10-12", precision: "Approximate" },
    description: "Illustrative defined-scope estate record with land and buildings. No boundary geometry is supplied in this demo.",
    externalIdentifiers: [{ type: "Demo reference", issuer: "POC dataset", value: "RIV-EST-01", source: "Sample data" }],
    instructions: [{ id: "INS-2048", name: "Riverside refinancing", status: "In progress", junction: "DPA-701", relationshipStatus: "Active", role: "Subject property" }],
    wipCount: 2, relationships: []
  },
  {
    id: "AST-1002", name: "Riverside North Parcel", type: "Land parcel", status: "Active", sector: "Development land", site: "Riverside Quarter",
    address: "North bank, Riverside Quarter", city: "Bristol", country: "United Kingdom",
    location: { latitude: 51.4551, longitude: -2.5884, crs: "WGS 84 (EPSG:4326)", source: "Illustrative sample point", capturedAt: "2026-10-12", precision: "Approximate" },
    description: "Sample parcel record associated with a larger estate; no cadastral boundary is represented.",
    externalIdentifiers: [{ type: "Demo parcel ref", issuer: "POC dataset", value: "RIV-P-014", source: "Sample data" }],
    instructions: [{ id: "INS-2048", name: "Riverside refinancing", status: "In progress", junction: "DPA-702", relationshipStatus: "Active", role: "Related property" }],
    wipCount: 1, relationships: [{ id: "REL-1", targetId: "AST-1001", type: "part_of", from: "2025-03-01", to: "", source: "Sample data", status: "Active" }]
  },
  {
    id: "AST-1003", name: "Riverside Exchange", type: "Building", status: "Active", sector: "Commercial", site: "Riverside Quarter",
    address: "18 Quay Street", city: "Bristol", country: "United Kingdom",
    location: { latitude: 51.4539, longitude: -2.5892, crs: "WGS 84 (EPSG:4326)", source: "Illustrative sample point", capturedAt: "2026-10-12", precision: "Approximate" },
    description: "A sample multi-storey office building with separately managed floor units.",
    externalIdentifiers: [], instructions: [], wipCount: 0,
    relationships: [{ id: "REL-2", targetId: "AST-1001", type: "located_on", from: "2025-03-01", to: "", source: "Sample data", status: "Active" }]
  },
  {
    id: "AST-1004", name: "Exchange — Suite 4B", type: "Unit", status: "Active", sector: "Office", site: "Riverside Quarter",
    address: "18 Quay Street, Suite 4B", city: "Bristol", country: "United Kingdom",
    location: { latitude: 51.4539, longitude: -2.5892, crs: "WGS 84 (EPSG:4326)", source: "Building location inherited for demo", capturedAt: "2026-10-12", precision: "Approximate" },
    description: "A separately identified office unit. Its enclosing Building is represented by the active part_of relationship below.",
    externalIdentifiers: [], instructions: [{ id: "INS-2051", name: "Suite 4B lease review", status: "Open", junction: "DPA-713", relationshipStatus: "Active", role: "Subject property" }], wipCount: 1,
    relationships: [{ id: "REL-3", targetId: "AST-1003", type: "part_of", from: "2025-09-01", to: "", source: "Sample data", status: "Active" }]
  },
  {
    id: "AST-1005", name: "Old Mill Works", type: "Site", status: "Inactive", sector: "Industrial", site: "",
    address: "Former mill grounds, Mill Lane", city: "Bath", country: "United Kingdom",
    location: { latitude: 51.3811, longitude: -2.359, crs: "WGS 84 (EPSG:4326)", source: "Illustrative sample point", capturedAt: "2026-09-30", precision: "Approximate" },
    description: "Inactive example retained to show record status is separate from legal or occupancy status.",
    externalIdentifiers: [], instructions: [], wipCount: 0,
    relationships: [{ id: "REL-4", targetId: "AST-1001", type: "associated_with", from: "2023-02-01", to: "2025-08-31", source: "Sample data", status: "Ended" }]
  }
];

function getSampleAssets() {
  return structuredClone(sample);
}

function validateAsset(asset, assets = [], editingId = "") {
  const errors = [];
  if (!asset.name?.trim()) errors.push("Enter a display name.");
  if (!ASSET_TYPES.includes(asset.type)) errors.push("Choose a supported asset type.");
  if (!STATUSES.includes(asset.status)) errors.push("Choose a valid record status.");
  if (!asset.address?.trim()) errors.push("Enter an address or meaningful land/site location description.");
  if (!asset.country?.trim()) errors.push("Enter a country.");
  if (asset.latitude === "" || asset.latitude === null || !Number.isFinite(Number(asset.latitude)) || Number(asset.latitude) < -90 || Number(asset.latitude) > 90) errors.push("Latitude must be a number from -90 to 90.");
  if (asset.longitude === "" || asset.longitude === null || !Number.isFinite(Number(asset.longitude)) || Number(asset.longitude) < -180 || Number(asset.longitude) > 180) errors.push("Longitude must be a number from -180 to 180.");
  if (!asset.crs?.trim()) errors.push("Declare a coordinate reference system.");
  if (asset.id && assets.some(item => item.id.toLowerCase() === asset.id.toLowerCase() && item.id !== editingId)) errors.push("That stable asset identifier is already in use.");
  const rel = asset.relationship;
  if (rel?.type || rel?.targetId) {
    if (!RELATIONSHIP_TYPES.includes(rel.type)) errors.push("Choose a valid relationship type.");
    if (!rel.targetId) errors.push("Choose the related asset.");
    if (rel.targetId === editingId) errors.push("An asset cannot be related to itself.");
    if (rel.targetId && !assets.some(item => item.id === rel.targetId)) errors.push("The related asset does not exist.");
    if (rel.targetId && RELATIONSHIP_TYPES.includes(rel.type) && assets.some(item => item.id === editingId && item.relationships?.some(link => link.status === "Active" && link.type === rel.type && link.targetId === rel.targetId))) errors.push("An active relationship of this type already exists.");
    if (asset.type === "Unit" && rel.type && (rel.type !== "part_of" || !assets.some(item => item.id === rel.targetId && item.type === "Building"))) errors.push("A Unit must be linked to an enclosing Building using part_of.");
  }
  if (asset.type === "Unit") {
    const activeBuildingLinks = (assets.find(item => item.id === editingId)?.relationships || []).filter(link => link.status === "Active" && link.type === "part_of");
    const hasCandidateBuildingLink = rel?.type === "part_of" && assets.some(item => item.id === rel.targetId && item.type === "Building");
    if (activeBuildingLinks.length === 0 && !hasCandidateBuildingLink) errors.push("A Unit must have an active part_of link to its enclosing Building.");
    if (activeBuildingLinks.some(link => !assets.some(item => item.id === link.targetId && item.type === "Building"))) errors.push("A Unit's active part_of link must target a Building.");
  }
  return errors;
}

function searchAssets(assets, query, type = "", status = "") {
  const needle = query.trim().toLocaleLowerCase();
  return assets.filter(asset => {
    const searchable = [asset.id, asset.name, asset.address, asset.city, asset.country, asset.description, asset.sector, asset.site, ...(asset.externalIdentifiers || []).map(x => x.value)].join(" ").toLocaleLowerCase();
    return (!needle || searchable.includes(needle)) && (!type || asset.type === type) && (!status || asset.status === status);
  });
}

function deriveUnits(building, assets) {
  return assets.filter(asset => asset.type === "Unit" && asset.relationships?.some(link => link.status === "Active" && link.type === "part_of" && link.targetId === building.id));
}

function normalizeRelationship(rel, id) {
  return { id, targetId: rel.targetId, type: rel.type, from: new Date().toISOString().slice(0, 10), to: "", source: rel.source?.trim() || "User-entered demo data", status: "Active" };
}

const AssetModel = { STORAGE_KEY, ASSET_TYPES, STATUSES, RELATIONSHIP_TYPES, getSampleAssets, validateAsset, searchAssets, deriveUnits, normalizeRelationship };
globalThis.AssetModel = AssetModel;
if (typeof module !== "undefined" && module.exports) module.exports = AssetModel;
