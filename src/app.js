(() => {
  "use strict";
  const M = window.AssetModel;
  const $ = selector => document.querySelector(selector);
  const list = $("#asset-list");
  const detail = $("#detail-panel");
  const dialog = $("#asset-dialog");
  const mapDialog = $("#map-dialog");
  const form = $("#asset-form");
  const toast = $("#toast");
  const THEME_STORAGE_KEY = "poc-asset.theme.v1";
  let assets = loadAssets();
  let selectedId = assets[0]?.id || "";
  let detailZoom = 100;
  let toastTimer;
  let previewMap;
  let fullMap;

  function loadTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    } catch (error) {
      console.warn("Could not read the theme preference.", error);
      return "dark";
    }
  }

  function setTheme(theme, save = false) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    $("#theme-toggle").setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    $("#theme-toggle").title = `Switch to ${nextTheme} theme`;
    $("#theme-toggle .theme-icon").textContent = theme === "dark" ? "☼" : "☾";
    $("#theme-toggle .theme-label").textContent = theme === "dark" ? "Light" : "Dark";
    document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#0a0a0f" : "#f5f6fa";
    if (!save) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Could not save the theme preference.", error);
      showToast("Theme changed, but the preference could not be saved.", "error");
    }
  }

  setTheme(loadTheme());

  function loadAssets() {
    try {
      const saved = localStorage.getItem(M.STORAGE_KEY);
      if (!saved) return M.getSampleAssets();
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === "string")) return parsed;
    } catch (error) {
      console.warn("Could not read the local demo records.", error);
    }
    return M.getSampleAssets();
  }

  function persist() {
    try {
      localStorage.setItem(M.STORAGE_KEY, JSON.stringify(assets));
      $("#reset-button").classList.remove("unsaved");
      return true;
    } catch (error) {
      showToast("Could not save. Browser storage may be unavailable or full.", "error");
      console.error(error);
      return false;
    }
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function showToast(message, kind = "success") {
    toast.textContent = message;
    toast.className = `toast visible ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = "toast"; }, 3200);
  }

  function initials(name) {
    return name.split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  }

  function renderList() {
    const filtered = M.searchAssets(assets, $("#search-input").value, $("#type-filter").value, $("#status-filter").value);
    $("#record-count").textContent = `${assets.length} ${assets.length === 1 ? "asset" : "assets"}`;
    $("#visible-count").textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;
    if (!filtered.some(asset => asset.id === selectedId)) selectedId = filtered[0]?.id || "";
    list.innerHTML = filtered.length ? filtered.map(asset => `
      <li class="asset-row ${asset.id === selectedId ? "selected" : ""}" data-id="${escapeHtml(asset.id)}">
        <span class="asset-avatar ${asset.type.toLowerCase().replaceAll(" ", "-")}">${escapeHtml(initials(asset.name))}</span>
        <span class="asset-row-main"><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.id)} <span class="row-divider">·</span> ${escapeHtml(asset.type)}</small></span>
        <span class="status-dot ${asset.status.toLowerCase()}">${escapeHtml(asset.status)}</span>
      </li>`).join("") : `<li class="list-empty"><span>⌕</span><strong>No matching assets</strong><small>Try another search or clear a filter.</small></li>`;
    renderDetail();
  }

  function locationLine(asset) {
    return [asset.address, asset.city, asset.country].filter(Boolean).join(", ");
  }

  function relationshipLabel(type) {
    return ({ part_of: "Part of", located_on: "Located on", associated_with: "Associated with" })[type] || type;
  }

  function locationCoordinates(asset) {
    const latitudeValue = asset.location?.latitude;
    const longitudeValue = asset.location?.longitude;
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
    if (latitudeValue == null || String(latitudeValue).trim() === "" ||
        longitudeValue == null || String(longitudeValue).trim() === "" ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return [latitude, longitude];
  }

  function renderLocationMap(asset) {
    const coordinates = locationCoordinates(asset);
    if (!coordinates) {
      return `<div class="location-map-unavailable" role="note">A map cannot be shown because this record has no valid latitude and longitude.</div>`;
    }
    if (!window.L) {
      console.error("Leaflet could not be loaded. The location map is unavailable.");
      const [latitude, longitude] = coordinates;
      const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
      return `<div class="location-map-unavailable" role="status">The map could not load. Check your internet connection, or <a href="${mapUrl}" target="_blank" rel="noopener noreferrer">open this location in OpenStreetMap</a>.</div>`;
    }
    return `<div class="location-map-wrap">
      <div id="location-map-preview" class="location-map-preview" role="img" aria-label="Map preview centered on ${coordinates[0]}, ${coordinates[1]}. Click to open the full map."></div>
      <button class="map-open-button" type="button" data-open-location-map aria-label="Open full map for ${escapeHtml(asset.name)}" title="Open full map">⤢</button>
    </div>`;
  }

  function addMapTiles(map) {
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
  }

  function openFullLocationMap(asset) {
    const coordinates = locationCoordinates(asset);
    if (!coordinates || !window.L) return;
    $("#map-dialog-title").textContent = `${asset.name} · ${asset.id}`;
    mapDialog.showModal();
    requestAnimationFrame(() => {
      fullMap?.remove();
      fullMap = window.L.map("full-location-map").setView(coordinates, 16);
      addMapTiles(fullMap);
      window.L.circleMarker(coordinates, {
        radius: 8, color: "#fff", weight: 2, fillColor: "#6b67ed", fillOpacity: 1
      }).addTo(fullMap).bindTooltip(asset.name).openTooltip();
      fullMap.invalidateSize();
    });
  }

  function renderRelationship(link, direction = "outgoing") {
    const other = assets.find(asset => asset.id === (direction === "outgoing" ? link.targetId : link.sourceId));
    if (!other) return "";
    return `<article class="connection-card">
      <span class="connection-glyph">${direction === "incoming" ? "↙" : "↗"}</span>
      <button class="text-link connection-name" data-open="${escapeHtml(other.id)}">${escapeHtml(other.name)}<small>${escapeHtml(other.id)} · ${escapeHtml(other.type)}</small></button>
      <span class="connection-meta"><b>${escapeHtml(relationshipLabel(link.type))}</b><small>${link.status === "Ended" ? `Ended ${escapeHtml(link.to || "date not recorded")}` : `Since ${escapeHtml(link.from || "date not recorded")}`}</small>${link.source ? `<small>Source: ${escapeHtml(link.source)}</small>` : ""}</span>
      ${link.status === "Active" && direction === "outgoing" ? `<button class="end-link" data-end="${escapeHtml(link.id)}" title="End relationship">End link</button>` : `<span class="history-tag">${link.status === "Ended" ? "History" : "Active"}</span>`}
    </article>`;
  }

  function renderDetail() {
    previewMap?.remove();
    previewMap = undefined;
    const asset = assets.find(item => item.id === selectedId);
    if (!asset) {
      detail.innerHTML = `<div class="detail-empty"><span class="empty-glyph">⌖</span><h2>${assets.length ? "No asset selected" : "No records yet"}</h2><p>${assets.length ? "Choose an asset from the catalogue." : "Create a record or reset the sample data."}</p></div>`;
      return;
    }
    const outgoing = asset.relationships || [];
    const incoming = assets.flatMap(item => (item.relationships || []).filter(link => link.status === "Active" && link.targetId === asset.id).map(link => ({ ...link, sourceId: item.id })));
    const links = [...outgoing.map(link => renderRelationship(link)), ...incoming.map(link => renderRelationship(link, "incoming"))].join("");
    const units = asset.type === "Building" ? M.deriveUnits(asset, assets) : [];
    const instructions = asset.instructions || [];
    const history = asset.history || [];
    const external = asset.externalIdentifiers || [];
    detail.innerHTML = `
      <div class="detail-topline">
        <span class="record-label">ASSET RECORD <span>/</span> ${escapeHtml(asset.id)}</span>
        <div class="detail-actions">
          <div class="detail-zoom" role="group" aria-label="Detail pane zoom">
            <button class="button button-quiet zoom-button" type="button" data-zoom="out" aria-label="Zoom out detail pane">−</button>
            <button class="button button-quiet zoom-value" type="button" data-zoom="reset" aria-label="Reset detail pane zoom to 100 percent">${detailZoom}%</button>
            <button class="button button-quiet zoom-button" type="button" data-zoom="in" aria-label="Zoom in detail pane">+</button>
          </div>
          <button class="button button-outline" id="edit-button" type="button">✎ &nbsp;Edit record</button>
        </div>
      </div>
      <div class="detail-zoom-content">
      <div class="detail-title">
        <span class="detail-avatar ${asset.type.toLowerCase().replaceAll(" ", "-")}">${escapeHtml(initials(asset.name))}</span>
        <div class="title-copy"><div class="eyebrow">${escapeHtml(asset.type.toUpperCase())} <span class="footer-dot">/</span> ${escapeHtml(asset.sector || "SECTOR NOT SET")}</div><h2>${escapeHtml(asset.name)}</h2><p>${escapeHtml(asset.id)} <span class="row-divider">·</span> ${escapeHtml(asset.site ? `Site: ${asset.site}` : "No site association")}</p></div>
        <span class="status-badge ${asset.status.toLowerCase()}"><i></i>${escapeHtml(asset.status)}</span>
      </div>
      <nav class="tabs" aria-label="Asset details"><button class="tab active" data-tab="overview">Overview</button><button class="tab" data-tab="connections">Connections <span>${outgoing.length + incoming.length}</span></button><button class="tab" data-tab="references">References <span>${instructions.length}</span></button></nav>
      <div class="tab-content active" data-panel="overview">
        <div class="content-grid">
          <section class="info-card location-card"><div class="card-title"><span class="card-icon">⌖</span><div><h3>Location</h3><p>Physical location details</p></div></div>
            <div class="address-block"><span class="micro-label">ADDRESS / LOCATION DESCRIPTION</span><strong>${escapeHtml(locationLine(asset) || "Not recorded")}</strong></div>
            ${renderLocationMap(asset)}
            <div class="data-grid"><div><span class="micro-label">LATITUDE</span><strong>${escapeHtml(asset.location?.latitude ?? "Not recorded")}</strong></div><div><span class="micro-label">LONGITUDE</span><strong>${escapeHtml(asset.location?.longitude ?? "Not recorded")}</strong></div><div><span class="micro-label">COORDINATE SYSTEM</span><strong>${escapeHtml(asset.location?.crs || "Not recorded")}</strong></div><div><span class="micro-label">LOCATION SOURCE</span><strong>${escapeHtml(asset.location?.source || "Not recorded")}</strong></div><div><span class="micro-label">CAPTURE DATE</span><strong>${escapeHtml(asset.location?.capturedAt || "Not recorded")}</strong></div><div><span class="micro-label">PRECISION / CONFIDENCE</span><strong>${escapeHtml(asset.location?.precision || "Not recorded")}</strong></div></div>
          </section>
          <section class="info-card description-card"><div class="card-title"><span class="card-icon violet">▤</span><div><h3>About this asset</h3><p>Descriptive information</p></div></div><p class="description-copy">${escapeHtml(asset.description || "No description has been added.")}</p><div class="data-grid compact"><div><span class="micro-label">SECTOR</span><strong>${escapeHtml(asset.sector || "Not recorded")}</strong></div><div><span class="micro-label">SITE ASSOCIATION</span><strong>${escapeHtml(asset.site || "None")}</strong></div><div><span class="micro-label">RECORD STATUS</span><strong>${escapeHtml(asset.status)} <small class="muted">(not legal status)</small></strong></div><div><span class="micro-label">EXTERNAL IDENTIFIERS</span><strong>${external.length ? external.map(x => `${escapeHtml(x.type)}: ${escapeHtml(x.value)}`).join("<br>") : "None recorded"}</strong></div></div></section>
        </div>
        ${asset.type === "Estate" ? `<div class="boundary-note"><span>◎</span><div><strong>Estate scope is descriptive</strong><p>${escapeHtml(asset.description || "No boundary geometry or authoritative boundary reference is supplied in this demo.")} This record is not proof of title, ownership, or cadastral boundaries.</p></div></div>` : ""}
        <div class="metrics-row"><div class="metric-card"><span class="metric-icon">⇄</span><div><strong>${outgoing.filter(link => link.status === "Active").length + incoming.length}</strong><small>Active asset links</small></div></div><div class="metric-card"><span class="metric-icon">▤</span><div><strong>${instructions.length}</strong><small>Instruction references</small></div></div><div class="metric-card"><span class="metric-icon">⌑</span><div><strong>${asset.wipCount || 0}</strong><small>WIP lines <span class="muted">(sample)</span></small></div></div></div>
        ${units.length ? `<section class="inline-units"><div class="section-heading"><div><div class="section-kicker">INVERSE RELATIONSHIP</div><h3>Units in this building</h3></div><span class="count-pill">${units.length}</span></div>${units.map(unit => `<button class="unit-link" data-open="${escapeHtml(unit.id)}"><span class="mini-building">▦</span><span><strong>${escapeHtml(unit.name)}</strong><small>${escapeHtml(unit.id)} · linked by Unit part_of Building</small></span><span>↗</span></button>`).join("")}</section>` : ""}
      </div>
      <div class="tab-content" data-panel="connections"><div class="section-heading"><div><div class="section-kicker">EXPLICIT ASSET LINKS</div><h3>Related assets</h3></div><span class="count-pill">${outgoing.length + incoming.length}</span></div><p class="tab-intro">Links describe a recorded association only. They do not establish ownership, title, legal boundaries, or transaction inclusion.</p>${links || `<div class="empty-inline"><span>⇄</span><strong>No related assets</strong><p>Relationships will appear here when recorded.</p></div>`}${history.length ? `<div class="audit-box"><div class="section-kicker">LOCAL DEMO AUDIT</div>${history.slice().reverse().map(event => `<p><strong>${escapeHtml(event.action)}</strong> · ${escapeHtml(event.date)} <span>${escapeHtml(event.note || "")}</span></p>`).join("")}</div>` : ""}</div>
      <div class="tab-content" data-panel="references"><div class="section-heading"><div><div class="section-kicker">MATTERS & INSTRUCTIONS</div><h3>Linked references</h3></div><span class="count-pill">${instructions.length} instructions</span></div><p class="tab-intro">Demo associations only. Instruction status below is distinct from the junction relationship status. Counts include active sample associations only; removed or sold links are not included.</p>${instructions.length ? `<div class="reference-table"><div class="table-head"><span>INSTRUCTION</span><span>JUNCTION REF</span><span>INSTRUCTION STATUS</span><span>LINK STATUS</span><span>ROLE</span></div>${instructions.map(item => `<article class="reference-row"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.id)}</small></span><span>${escapeHtml(item.junction)}</span><span><b class="instruction-status">${escapeHtml(item.status)}</b></span><span>${escapeHtml(item.relationshipStatus)}</span><span>${escapeHtml(item.role)}</span></article>`).join("")}</div>` : `<div class="empty-inline"><span>▤</span><strong>No linked Instructions</strong><p>No Instruction references are attached to this Asset in the sample data.</p></div>`}</div>
      <div class="detail-disclaimer">Demo record only · sourced / confidence values are illustrative · no legal or ownership determination</div>
      </div>`;
    const coordinates = locationCoordinates(asset);
    const preview = $("#location-map-preview");
    if (coordinates && preview && window.L) {
      previewMap = window.L.map(preview, {
        center: coordinates, zoom: 15, zoomControl: false, attributionControl: true,
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        boxZoom: false, keyboard: false, touchZoom: false
      });
      addMapTiles(previewMap);
      window.L.circleMarker(coordinates, {
        radius: 7, color: "#fff", weight: 2, fillColor: "#6b67ed", fillOpacity: 1
      }).addTo(previewMap);
      previewMap.on("click", () => openFullLocationMap(asset));
    }
    applyDetailZoom();
    updateDetailZoomControls();
  }

  function applyDetailZoom() {
    const zoomContent = detail.querySelector(".detail-zoom-content");
    if (!zoomContent) return;
    const scale = detailZoom / 100;
    const detailStyle = getComputedStyle(detail);
    const availableWidth = detail.clientWidth - parseFloat(detailStyle.paddingLeft) - parseFloat(detailStyle.paddingRight);
    zoomContent.style.width = `${availableWidth / scale}px`;
    zoomContent.style.transform = `scale(${scale})`;
    zoomContent.style.marginBottom = `${zoomContent.offsetHeight * (scale - 1)}px`;
    previewMap?.invalidateSize({ pan: false });
  }

  function updateDetailZoomControls() {
    const zoomOut = detail.querySelector('[data-zoom="out"]');
    const zoomIn = detail.querySelector('[data-zoom="in"]');
    const zoomReset = detail.querySelector('[data-zoom="reset"]');
    if (!zoomOut || !zoomIn || !zoomReset) return;
    zoomOut.disabled = detailZoom <= 80;
    zoomIn.disabled = detailZoom >= 140;
    zoomReset.textContent = `${detailZoom}%`;
    zoomReset.setAttribute("aria-label", `Detail pane zoom is ${detailZoom} percent; reset to 100 percent`);
  }

  function openForm(asset = null) {
    form.reset();
    $("#form-feedback").hidden = true;
    $("#dialog-title").textContent = asset ? "Edit asset" : "New asset";
    $("#form-id").value = asset?.id || "";
    $("#form-name").value = asset?.name || "";
    $("#form-type").value = asset?.type || "";
    $("#form-status").value = asset?.status || "Active";
    $("#form-address").value = asset?.address || "";
    $("#form-city").value = asset?.city || "";
    $("#form-country").value = asset?.country || "";
    $("#form-lat").value = asset?.location?.latitude ?? "";
    $("#form-lon").value = asset?.location?.longitude ?? "";
    $("#form-crs").value = asset?.location?.crs || "WGS 84 (EPSG:4326)";
    $("#form-location-source").value = asset?.location?.source || "";
    $("#form-sector").value = asset?.sector || "";
    $("#form-site").value = asset?.site || "";
    $("#form-description").value = asset?.description || "";
    const external = asset?.externalIdentifiers?.[0] || {};
    $("#form-external-type").value = external.type || "";
    $("#form-external-issuer").value = external.issuer || "";
    $("#form-external-value").value = external.value || "";
    const activeRelation = asset?.relationships?.find(link => link.status === "Active");
    updateRelationTargets(asset?.id || "");
    $("#form-rel-type").value = activeRelation?.type || "";
    $("#form-rel-target").value = activeRelation?.targetId || "";
    $("#form-rel-source").value = activeRelation?.source || "";
    updateUnitGuidance();
    dialog.showModal();
    $("#form-name").focus();
  }

  function updateRelationTargets(editingId) {
    const target = $("#form-rel-target");
    const previous = target.value;
    const eligible = assets.filter(asset => asset.id !== editingId && (!$("#form-type").value || $("#form-type").value !== "Unit" || asset.type === "Building"));
    target.innerHTML = `<option value="">Choose an asset</option>${eligible.map(asset => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)} · ${escapeHtml(asset.type)}</option>`).join("")}`;
    if (eligible.some(asset => asset.id === previous)) target.value = previous;
  }

  function updateUnitGuidance() {
    const isUnit = $("#form-type").value === "Unit";
    $("#unit-guidance").hidden = !isUnit;
    $("#form-rel-type").disabled = isUnit;
    if (isUnit) $("#form-rel-type").value = "part_of";
    updateRelationTargets($("#form-id").value);
  }

  function getFormAsset() {
    const id = $("#form-id").value;
    const current = assets.find(item => item.id === id);
    const selectedTarget = $("#form-rel-target").value;
    const selectedType = $("#form-rel-type").value;
    const existing = current?.relationships?.find(link => link.status === "Active" && link.type === selectedType && link.targetId === selectedTarget);
    const relationship = selectedTarget && !existing ? { type: selectedType, targetId: selectedTarget, source: $("#form-rel-source").value } : null;
    return {
      id: id || nextAssetId(), name: $("#form-name").value.trim(), type: $("#form-type").value, status: $("#form-status").value,
      address: $("#form-address").value.trim(), city: $("#form-city").value.trim(), country: $("#form-country").value.trim(),
      latitude: $("#form-lat").value.trim(), longitude: $("#form-lon").value.trim(),
      crs: $("#form-crs").value.trim(), locationSource: $("#form-location-source").value.trim(),
      sector: $("#form-sector").value.trim(), site: $("#form-site").value.trim(), description: $("#form-description").value.trim(),
      externalIdentifiers: $("#form-external-value").value.trim() ? [{ type: $("#form-external-type").value.trim() || "External reference", issuer: $("#form-external-issuer").value.trim(), value: $("#form-external-value").value.trim(), source: "User-entered demo data" }] : [],
      relationship, current, previousActive: current?.relationships?.find(link => link.status === "Active") || null
    };
  }

  function nextAssetId() {
    const highest = assets.reduce((max, asset) => {
      const match = asset.id.match(/^AST-(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 1000);
    return `AST-${highest + 1}`;
  }

  function submitAsset(event) {
    event.preventDefault();
    const record = getFormAsset();
    const errors = M.validateAsset(record, assets, record.current?.id || "");
    const feedback = $("#form-feedback");
    if (errors.length) {
      feedback.innerHTML = `<strong>Please correct the following:</strong><ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
      feedback.hidden = false;
      feedback.focus?.();
      return;
    }
    const now = new Date().toISOString();
    const relationshipChanged = record.previousActive && (record.previousActive.type !== $("#form-rel-type").value || record.previousActive.targetId !== $("#form-rel-target").value);
    const history = [...(record.current?.history || [])];
    if (record.current) history.push({ action: "Asset details updated", date: now.slice(0, 10), note: "Local demo audit event" });
    else history.push({ action: "Asset created", date: now.slice(0, 10), note: "Local demo audit event" });
    const relationships = (record.current?.relationships || []).map(link => relationshipChanged && link.id === record.previousActive.id ? { ...link, status: "Ended", to: now.slice(0, 10) } : link);
    if (record.relationship) relationships.push(M.normalizeRelationship(record.relationship, `REL-${Date.now()}`));
    const saved = {
      id: record.id, name: record.name, type: record.type, status: record.status, address: record.address, city: record.city, country: record.country,
      location: { latitude: Number(record.latitude), longitude: Number(record.longitude), crs: record.crs, source: record.locationSource || "User-entered demo data", capturedAt: record.current?.location?.capturedAt || now.slice(0, 10), precision: record.current?.location?.precision || "Unspecified" },
      sector: record.sector, site: record.site, description: record.description, externalIdentifiers: record.externalIdentifiers,
      instructions: record.current?.instructions || [], wipCount: record.current?.wipCount || 0, relationships, history,
      createdAt: record.current?.createdAt || now, updatedAt: now
    };
    if (record.current) assets = assets.map(item => item.id === record.id ? saved : item);
    else assets.push(saved);
    if (!persist()) return;
    selectedId = saved.id;
    dialog.close();
    renderList();
    showToast(record.current ? "Asset updated and saved in this browser." : "Asset created and saved in this browser.");
  }

  function endRelationship(linkId) {
    const asset = assets.find(item => item.id === selectedId);
    const link = asset?.relationships?.find(item => item.id === linkId && item.status === "Active");
    if (!link) return;
    if (asset.type === "Unit" && link.type === "part_of") {
      showToast("A Unit must retain an active part_of link to its enclosing Building.", "error");
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    asset.relationships = asset.relationships.map(item => item.id === linkId ? { ...item, status: "Ended", to: date } : item);
    asset.history = [...(asset.history || []), { action: "Asset relationship ended", date, note: `${link.type} → ${link.targetId}; prior link retained` }];
    if (persist()) {
      renderList();
      document.querySelector('[data-tab="connections"]')?.click();
      showToast("Relationship ended; its history is retained.");
    }
  }

  list.addEventListener("click", event => {
    const row = event.target.closest("[data-id]");
    if (row) { selectedId = row.dataset.id; renderList(); }
  });
  window.addEventListener("resize", applyDetailZoom);
  detail.addEventListener("click", event => {
    const zoomButton = event.target.closest("[data-zoom]");
    if (zoomButton) {
      if (zoomButton.dataset.zoom === "reset") detailZoom = 100;
      else detailZoom = Math.max(80, Math.min(140, detailZoom + (zoomButton.dataset.zoom === "in" ? 10 : -10)));
      applyDetailZoom();
      updateDetailZoomControls();
      return;
    }
    if (event.target.closest("[data-open-location-map]")) {
      const asset = assets.find(item => item.id === selectedId);
      if (asset) openFullLocationMap(asset);
      return;
    }
    const open = event.target.closest("[data-open]");
    if (open) { selectedId = open.dataset.open; renderList(); return; }
    const end = event.target.closest("[data-end]");
    if (end) { endRelationship(end.dataset.end); return; }
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      detail.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button === tab));
      detail.querySelectorAll(".tab-content").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab));
      return;
    }
    if (event.target.closest("#edit-button")) openForm(assets.find(item => item.id === selectedId));
  });
  $("#search-input").addEventListener("input", renderList);
  $("#type-filter").addEventListener("change", renderList);
  $("#status-filter").addEventListener("change", renderList);
  $("#create-button").addEventListener("click", () => openForm());
  $("#theme-toggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
  $("#reset-button").addEventListener("click", () => {
    if (!window.confirm("Reset this browser's Asset demo records to the original sample data? Your local changes will be removed.")) return;
    assets = M.getSampleAssets();
    selectedId = assets[0]?.id || "";
    try { localStorage.removeItem(M.STORAGE_KEY); } catch (error) { console.warn(error); }
    renderList();
    showToast("Sample data restored. Local changes were removed.");
  });
  $("#close-dialog").addEventListener("click", () => dialog.close());
  $("#cancel-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  $("#close-map-dialog").addEventListener("click", () => mapDialog.close());
  mapDialog.addEventListener("click", event => { if (event.target === mapDialog) mapDialog.close(); });
  mapDialog.addEventListener("close", () => {
    fullMap?.remove();
    fullMap = undefined;
  });
  form.addEventListener("submit", submitAsset);
  $("#form-type").addEventListener("change", updateUnitGuidance);
  $("#form-rel-type").addEventListener("change", () => updateRelationTargets($("#form-id").value));
  $("#form-rel-target").addEventListener("change", () => { if ($("#form-type").value === "Unit") $("#form-rel-type").value = "part_of"; });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#search-input").focus(); }
    if (event.key === "Escape") {
      if (mapDialog.open) mapDialog.close();
      else if (dialog.open) dialog.close();
    }
  });
  renderList();
})();
