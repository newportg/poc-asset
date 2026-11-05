# Asset Explorer — static POC

A browser-native demonstration of real-estate Asset records, typed relationships,
and matter/Instruction references. This is a standalone prototype; it has no server,
build step, dependency installation, external requests, or authoritative data.

## Run

Open [`src/index.html`](src/index.html) directly in a modern browser. All app code
uses local browser APIs and ES modules. Alternatively, serve this folder with any
basic static HTTP server and open its `src/` directory. No install or build is needed.

Edits are saved in this browser's `localStorage`. Use **Reset sample data** to remove
local changes and restore the included sample records. Browser storage is not shared,
secure, backed up, or suitable for production data.

## What is included

- Search by identifier, name, address, description, or external reference; filter by
  type and record status.
- Asset details with location/provenance, external identifiers, linked
  Instructions/matters, WIP reference counts, and related Assets.
- Create and edit forms with required-field, coordinate, duplicate-id, and
  relationship validation.
- Typed relationships with effective dates and source; ended links remain visible
  as history. Building Units are derived from active Unit `part_of` links.
- A resettable sample dataset and locally persisted edits.

All records are fictional demo data. Relationships and mapped locations do not
establish title, ownership, legal boundaries, or inclusion in a transaction.

## Project links

- Knowledge-vault project: [Asset](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Asset/README.md)
- Requirements: [Asset PRD](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Asset/asset-prd.md)
- Implementation design and limitations: [docs/design.md](docs/design.md)

## Validation

Focused, dependency-free logic tests: `node --test tests/assets.test.mjs`

The tests cover required asset fields, coordinates, stable identifiers, relationship
rules, derived inverse Unit links, and relationship history.
