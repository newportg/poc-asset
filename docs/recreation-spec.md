# Asset Explorer Recreation Specification

This specification describes how to recreate the Asset Explorer POC without
access to the original source. The implementation is a browser-native static
application with no build step or database.

## Runtime files

```text
src/index.html             Application shell and page layout
src/app.js                 UI rendering, editing, persistence, and map behavior
src/assets.js              Asset fixtures, validation, search, and relationships
src/config.js              Optional POC Address API base URL
src/loqate-client.js       Address lookup HTTP client
src/documentation.html     In-app documentation
src/documentation.css      Documentation page styles
tests/assets.test.mjs      Asset model tests
tests/loqate-client.test.mjs  Address client tests
```

Leaflet is loaded from its CDN and OpenStreetMap provides map tiles. The app
must work when opened directly as a static page.

## Data and storage

Store the editable catalogue as JSON under `poc-asset.records.v1` in
`localStorage`. Store the theme under `poc-asset.theme.v1` and the shared
Loqate key under `loqate_api_key`. Reset restores the fictional sample data.

An Asset has a stable ID, type, status, display name, address, country,
latitude, longitude, CRS, source, capture date, precision, optional external
identifier, Sector/Site labels, typed links, and Instruction references.

Supported Asset types include Land parcel, Site, Estate, Building, and Unit.
Links use `part_of`, `located_on`, or `associated_with`, with effective dates
and source. A Unit can only use an active `part_of` link to a Building.
Building Units are derived from active links rather than stored as inverse
links.

## UI behavior

The main page contains:

- searchable Asset catalogue;
- type and record-status filters;
- selected Asset detail panel;
- create/edit dialog with validation;
- map preview and full-size map dialog;
- detail-pane zoom from 80% to 140%;
- light/dark theme toggle;
- reset sample-data action.

Search covers stable ID, external reference, name, address, locality, country,
description, Sector, and Site. Selecting a result renders its details and
centers the map on valid coordinates.

The detail panel must show location/provenance, links, Instruction references,
WIP counts, and related Assets. Ending a relationship retains its history with
an ended status and end date.

## Address lookup

The create/edit form can call the POC Address API using `loqate-client.js`.
Search returns selectable address results. Selecting a verified result fills
display name, address, locality, country, and WGS84 coordinates when present,
and stores provenance on the Asset.

The API base URL is read from `window.ASSET_API_BASE_URL`. Live lookup requires
the shared `loqate_api_key` and network access. The Asset app does not own the
Loqate proxy.

## Validation and tests

Validate required fields, stable ID uniqueness, coordinates, valid Asset types
and statuses, relationship target types, date ordering, and Unit-to-Building
rules. Keep sample records fictional.

Run:

```powershell
node --test tests/*.test.mjs
```

The test suite must cover model validation, search/filter behavior, inverse
relationship derivation, relationship history, and Loqate client requests.

## Limitations

There is no authentication, authorization, server persistence, production audit
trail, historic field snapshots, title/ownership determination, legal status,
boundary geometry, coordinate transformation, or compliance workflow. Do not
enter real personal or confidential information.
