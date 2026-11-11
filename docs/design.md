# Implementation design and limitations

## Runtime and data

`src/index.html` is a static entry point. `src/app.js` renders the interface and
`src/assets.js` owns the sample records and pure search/validation helpers. There is
no build pipeline or server. The app loads directly as browser-native JavaScript;
Leaflet is loaded from its CDN and map tiles are fetched from OpenStreetMap.
The published `src/documentation.html` page provides an in-app guide, with page-specific
styles in `src/documentation.css`.

Records are held as browser-local JSON under `poc-asset.records.v1`. The selected
light or dark theme is saved separately under `poc-asset.theme.v1`. Asset latitude
and longitude are used to center the Leaflet preview and full-size map. The in-memory
sample data is the reset baseline. Saving an Asset emits a small local audit event;
changing or ending an Asset relationship retains its prior link with an ended status
and end date. The Building's Units are derived from the Unit's active `part_of` link,
not stored as a second inverse relationship.

## Demonstrated model

The detail pane can be independently zoomed from 80% to 140% in 10% increments and
reset to 100%; this does not change the catalogue or page zoom.

Assets include a stable demo ID, explicit type and record status, display name,
physical location text, country, coordinates, CRS, source/capture/precision fields,
optional external identifier and Sector/Site labels. Sample Instruction references
include their own Instruction status, junction reference, relationship status, and
role. WIP counts are illustrative sample counters.

Asset links use `part_of`, `located_on`, or `associated_with`, with effective dates
and source. A Unit can only be linked using `part_of` to a Building. Search spans
stable ID, external reference, name, address, locality, country, description, Sector,
and Site; type and record status are separate filters.

Create and edit forms can search and verify addresses through Loqate's browser APIs.
The Loqate API key is stored locally under `loqate_api_key`, shared with the POC
Address app. Choosing a verified result fills the display name, address, locality,
country, and WGS 84 coordinates when available; the result's provenance is saved
with the Asset.

## Deliberate limitations

- Sample records and coordinates are fictional and illustrative. Loqate verification
  is available only with a configured API key and network access; it does not render
  geometry or connect to a registry.
- Maps require an internet connection and use Leaflet from a CDN with OpenStreetMap
  tiles. Coordinates are plotted as latitude/longitude; the map does not transform
  alternate coordinate reference systems.
- Estate sample details describe a scope but do not include boundary geometry or an
  authoritative boundary reference.
- No Party links, matter editor, authorization, multi-user access, server persistence,
  production audit guarantees, or historic snapshots of Asset fields are implemented.
- Instruction/WIP associations are static demo examples and cannot be created or
  edited. They do not represent an approved production relationship schema.
- Local storage can be cleared or altered by the browser user. Do not enter real,
  confidential, or personal data.
- The Loqate API key is visible to the browser and is not stored in a production
  secret vault. Requests are sent directly from the browser to Loqate.

The interface and records must not be used to infer title, ownership, valuation,
legal status, transaction inclusion, cadastral boundaries, or compliance outcomes.

## Validation

Run `node --test tests/*.test.mjs` with Node.js. The test suite has no package
dependencies and checks the asset model, Loqate client requests, and inverse
relationship behavior. Manually verify the static entry point in a modern browser
for responsive layout and localStorage persistence.

## Related project

Discovery requirements and decisions: [Asset project in the knowledge vault](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Asset/README.md).
