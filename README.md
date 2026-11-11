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
- Loqate address search and verification in the create/edit form, including
  filling the display name, address, locality, country, and verified coordinates.
- Typed relationships with effective dates and source; ended links remain visible
  as history. Building Units are derived from active Unit `part_of` links.
- A resettable sample dataset and locally persisted edits.
- Switchable light and dark themes; the theme preference is saved in this browser.
- A Leaflet map preview centered on each record's latitude/longitude; click it to
  open an interactive full-size map.

The included sample records are fictional demo data. Loqate-verified addresses may
refer to real locations. Map tiles come from OpenStreetMap and display its
attribution. Relationships and mapped locations do not establish title, ownership,
legal boundaries, or inclusion in a transaction.
Live Loqate lookups require an API key, entered and saved in the form. It is stored
in this browser's `localStorage` under the same key used by the POC Address app.
Search and verification requests go through the local POC Address API. Do not
enter confidential or personal information; browser storage is not a production
secret store.

## Run the client with the local POC Address API

Install Podman Desktop and Node.js, ensure the sibling `poc-address` repository is
available, then run this from PowerShell:

```powershell
.\scripts\run-local.ps1
```

The script builds and starts the POC Address API container, serves a temporary
Asset client configured for that API, and opens the client. The Asset client uses
port `5175`; the Address API uses port `8001`. The interactive API documentation
is available at `http://127.0.0.1:8001/docs`.

## Project links

- Knowledge-vault project: [Asset](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Asset/README.md)
- Requirements: [Asset PRD](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Asset/asset-prd.md)
- Implementation design and limitations: [docs/design.md](docs/design.md)

## Validation

Focused, dependency-free logic tests: `node --test tests/*.test.mjs`

The tests cover required asset fields, coordinates, stable identifiers, relationship
rules, derived inverse Unit links, relationship history, and Loqate search/verification
requests.
