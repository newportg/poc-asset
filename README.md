# Asset Explorer — static POC

A browser-native demonstration of real-estate Asset records, typed relationships,
and matter/Instruction references. This is a standalone prototype with no server or
build step. Leaflet and OpenStreetMap map tiles require an internet connection.

## Run

Open [`src/index.html`](src/index.html) directly in a modern browser. The app code
uses local browser APIs; Leaflet is loaded from a CDN and map tiles are provided by
OpenStreetMap. Alternatively, serve this folder with any basic static HTTP server
and open its `src/` directory. No install or build is needed.

## Publish with GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` publishes the `src/` folder
when changes are pushed to `master`, or when run manually. In the repository's
**Settings → Pages**, set the build and deployment source to **GitHub Actions**.
After the workflow succeeds, GitHub Pages will show the published site URL.

Edits are saved in this browser's `localStorage`. Use **Reset sample data** to remove
local changes and restore the included sample records. Browser storage is not shared,
secure, backed up, or suitable for production data.

## What is included

- Search by identifier, name, address, description, or external reference; filter by
  type and record status.
- Asset details with location/provenance, external identifiers, linked
  Instructions/matters, WIP reference counts, and related Assets.
- Detail pane zoom from 80% to 140% without changing the catalogue or page zoom.
- Create and edit forms with required-field, coordinate, duplicate-id, and
  relationship validation.
- Typed relationships with effective dates and source; ended links remain visible
  as history. Building Units are derived from active Unit `part_of` links.
- A resettable sample dataset and locally persisted edits.
- Switchable light and dark themes; the theme preference is saved in this browser.
- A Leaflet map preview centered on each record's latitude/longitude; click it to
  open an interactive full-size map.

All records are fictional demo data. Map tiles come from OpenStreetMap and display
its attribution. Relationships and mapped locations do not
establish title, ownership, legal boundaries, or inclusion in a transaction.

## Project links

- Knowledge-vault project: [Asset](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Asset/README.md)
- Requirements: [Asset PRD](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Asset/asset-prd.md)
- Implementation design and limitations: [docs/design.md](docs/design.md)

## Validation

Focused, dependency-free logic tests: `node --test tests/assets.test.mjs`

The tests cover required asset fields, coordinates, stable identifiers, relationship
rules, derived inverse Unit links, and relationship history.
