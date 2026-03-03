/* ============================================================
   UNMISS HRD – Maps Page (maps.html)
   ============================================================

   Leaflet-based maps: casualty map, SGBV map, perpetrator map.
   Uses CartoDB dark tiles, south-sudan.geojson for boundary.
   Filters: quarter (Q1–Q4/all), violation, perpetrator.
   Markers: circle size by victim count; colour by violation/perpetrator.
   Offset logic avoids overlapping markers at same location.

   Depends: D, Leaflet (L), utils (fmt, pColor)
   ============================================================ */

// State centroid fallbacks (used when lat/long missing in incident data)
const STATE_CENTROIDS = {
  'Warrap':                 { lat:  8.45, lng: 27.45 },
  'Central Equatoria':      { lat:  4.60, lng: 31.40 },
  'Unity':                  { lat:  9.00, lng: 29.60 },
  'Lakes':                  { lat:  7.00, lng: 29.55 },
  'Eastern Equatoria':      { lat:  4.50, lng: 33.50 },
  'Western Equatoria':      { lat:  5.50, lng: 28.50 },
  'Jonglei':                { lat:  7.50, lng: 32.50 },
  'Upper Nile':             { lat: 10.30, lng: 33.00 },
  'Western Bahr el Ghazal': { lat:  8.50, lng: 25.50 },
  'Northern Bahr el Ghazal':{ lat:  9.50, lng: 26.50 },
};

// ── Leaflet dark tile ─────────────────────────────────────────
const TILE_URL   = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR  = '© OpenStreetMap contributors © CARTO';
const MAP_CENTER = [7.5, 30.5];
const MAP_ZOOM   = 6;

// South Sudan bounds (from GeoJSON bbox: [minLng, minLat, maxLng, maxLat])
const SS_BOUNDS = L.latLngBounds([[3.51, 23.89], [12.25, 35.30]]);
function inSouthSudan(lat, lng) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return false;
  return SS_BOUNDS.contains([lat, lng]);
}

// South Sudan boundary — subtle fill + visible border for country prominence
const SS_BOUNDARY_STYLE = {
  fillColor: '#009EDB',
  fillOpacity: 0.09,
  color: '#4da6e8',
  weight: 2.5,
  opacity: 0.7,
  className: 'ss-boundary-layer',
};
function addSouthSudanBoundary(map) {
  fetch('assets/south-sudan.geojson')
    .then(r => r.json())
    .then(geojson => {
      L.geoJSON(geojson, {
        style: () => SS_BOUNDARY_STYLE,
        interactive: false,
      }).addTo(map);
    })
    .catch(() => {});
}

let casualtyMap  = null;
let sgbvMap      = null;
let perpMap      = null;
let casMarkers   = [];
let sgbvMarkers  = [];
let perpMarkers  = [];

/** Map victim count to circle radius (min 6, max 45). */
function bubbleRadius(n) {
  if (n <= 0) return 0;
  return Math.max(6, Math.min(45, Math.sqrt(n) * 3.5));
}
/** Map SGBV case count to circle radius (min 6, max 35). */
function sgbvRadius(n) {
  if (n <= 0) return 0;
  return Math.max(6, Math.min(35, Math.sqrt(n) * 5));
}

/** Return fill colour (rgba) for perpetrator group (for map circles). */
function perpFill(p) {
  if (!p) return 'rgba(244,63,94,0.65)';
  const pl = p.toLowerCase();
  if (pl.includes('community')) return 'rgba(251,191,36,0.65)';
  if (pl.includes('conventional')) return 'rgba(129,140,248,0.65)';
  return 'rgba(52,211,153,0.65)';
}

/** Return fill colour (rgba) for violation type (killed/injured/abducted/crsv). */
function violFill(key) {
  return {killed:'rgba(244,63,94,0.7)', injured:'rgba(251,146,60,0.7)',
          abducted:'rgba(192,132,252,0.7)', crsv:'rgba(52,211,153,0.7)',
          total:'rgba(0,158,219,0.6)'}[key] || 'rgba(0,158,219,0.6)';
}

// Offsets to separate multiple markers at same location (lat/lng delta)
const PERP_OFFSETS = {
  'Community-based Militias':      [0, 0],
  'Conventional Parties':          [0.018, 0.010],
  'Unidentified/Opportunistic':     [-0.018, 0.010],
};
/** Get [dLat, dLng] offset for perpetrator when multiple at same location. */
function offsetForPerp(perp, hasMultiple) {
  if (!hasMultiple) return [0, 0];
  const o = PERP_OFFSETS[perp || 'Unidentified/Opportunistic'];
  return o || [0, 0];
}

// Violation offsets for casualty map (when multiple violation types at same location)
const VIOL_OFFSETS = { killed:[0,0], injured:[0.018,0.010], abducted:[-0.018,0.010], crsv:[0.012,-0.012] };
/** Get [dLat, dLng] offset for violation type when multiple at same location. */
function offsetForViol(viol, hasMultiple) {
  if (!hasMultiple) return [0, 0];
  return VIOL_OFFSETS[viol] || [0, 0];
}

/** Return full perpetrator label for popups. */
function perpFullName(p) {
  if (!p) return 'Unidentified/Opportunistic';
  const pl = (p+'').toLowerCase();
  if (pl.includes('community')) return 'Community-based Militias';
  if (pl.includes('conventional')) return 'Conventional Parties';
  return 'Unidentified/Opportunistic';
}

/** Build casualty map popup HTML. */
function casPopup(loc, violKey) {
  const total   = loc[violKey] || loc.total || 0;
  const locName = [loc.payam, loc.county, loc.state].filter(Boolean).join(' › ');
  return `
    <div class="popup-title">${locName || 'Unknown location'}</div>
    <div class="popup-row"><span>Victims (${violKey})</span><span style="color:#009EDB">${fmt(total)}</span></div>
    <div class="popup-row"><span>Killed</span><span style="color:#f43f5e">${fmt(loc.killed||0)}</span></div>
    <div class="popup-row"><span>Injured</span><span style="color:#fb923c">${fmt(loc.injured||0)}</span></div>
    <div class="popup-row"><span>Abducted</span><span style="color:#c084fc">${fmt(loc.abducted||0)}</span></div>
    <div class="popup-row"><span>CRSV</span><span style="color:#34d399">${fmt(loc.crsv||0)}</span></div>
    <div class="popup-row" style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,158,219,0.25)">
      <span>Perpetrator</span><span style="color:${pColor(loc.perpetrator||'')};font-size:11px">${loc.perpetrator||'Unidentified/Opportunistic'}</span>
    </div>`;
}

/** Build SGBV map popup HTML. */
function sgbvPopup(loc) {
  const locName = [loc.county, loc.state].filter(Boolean).join(' › ');
  return `
    <div class="popup-title">${locName || 'Unknown location'}</div>
    <div class="popup-row"><span>SGBV Cases</span><span style="color:#f472b6">${fmt(loc.total||0)}</span></div>`;
}

/** Build perpetrator map popup HTML. */
function perpPopup(loc) {
  const locName = [loc.payam, loc.county, loc.state].filter(Boolean).join(' › ');
  const perp = loc.perpetrator || 'Unidentified/Opportunistic';
  return `
    <div class="popup-title">${locName || 'Unknown location'}</div>
    <div class="popup-row"><span>Perpetrator</span><span style="color:${pColor(perp)}">${perpFullName(perp)}</span></div>
    <div class="popup-row"><span>Victims</span><span style="color:#009EDB">${fmt(loc.total||0)}</span></div>
    <div class="popup-row"><span>Killed</span><span style="color:#f43f5e">${fmt(loc.killed||0)}</span></div>
    <div class="popup-row"><span>Injured</span><span style="color:#fb923c">${fmt(loc.injured||0)}</span></div>
    <div class="popup-row"><span>Abducted</span><span style="color:#c084fc">${fmt(loc.abducted||0)}</span></div>
    <div class="popup-row"><span>CRSV</span><span style="color:#34d399">${fmt(loc.crsv||0)}</span></div>`;
}

/** Initialize casualty map (tiles, boundary, state labels) and call updateCasualtyMap. */
function buildCasualtyMap() {
  if (casualtyMap) return;
  casualtyMap = L.map('map', { center: MAP_CENTER, zoom: MAP_ZOOM });
  window._casualtyMap = casualtyMap;
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains:'abcd', maxZoom:18 }).addTo(casualtyMap);
  addSouthSudanBoundary(casualtyMap);

  // State boundary labels (lightweight: just text markers at centroids)
  Object.entries(STATE_CENTROIDS).forEach(([name, pos]) => {
    L.marker([pos.lat, pos.lng], {
      icon: L.divIcon({
        className:'',
        html:`<div style="color:rgba(255,255,255,0.2);font-size:10px;font-weight:700;
                          white-space:nowrap;text-shadow:0 1px 3px #000;pointer-events:none">
                ${name.toUpperCase()}
              </div>`,
        iconAnchor:[0,0],
      }),
      interactive: false,
    }).addTo(casualtyMap);
  });

  updateCasualtyMap();
}

/** Rebuild casualty markers from D.q4_locations / D.all_locations, applying quarter/violation/perpetrator filters. */
function updateCasualtyMap() {
  if (!casualtyMap) { buildCasualtyMap(); return; }

  casMarkers.forEach(m => m.remove());
  casMarkers = [];

  const quarter  = document.getElementById('cas-quarter-filter')?.value  || 'Q4';
  const violKey  = document.getElementById('cas-violation-filter')?.value || 'total';
  const perpFilt = document.getElementById('cas-perp-filter')?.value     || 'all';

  let locations;
  if (quarter === 'Q4') {
    locations = D.q4_locations;
  } else if (quarter === 'all') {
    locations = D.all_locations;
  } else {
    locations = D.all_locations.filter(l => l.quarter === quarter);
  }

  if (perpFilt !== 'all') {
    locations = locations.filter(l => l.perpetrator === perpFilt);
  }
  locations = locations.filter(l => inSouthSudan(l.lat, l.long));

  // Group by position AND violation — one circle per violation type at each location
  const byPosViol = {};
  locations.forEach(loc => {
    const key = `${loc.lat},${loc.long}`;
    if (!byPosViol[key]) {
      byPosViol[key] = { payam: loc.payam, county: loc.county, state: loc.state, lat: loc.lat, long: loc.long, by_viol: {} };
    }
    const bv = byPosViol[key].by_viol;
    ['killed','injured','abducted','crsv'].forEach(k => {
      bv[k] = (bv[k]||0) + (loc[k]||0);
    });
  });

  const violKeys = ['killed','injured','abducted','crsv'];
  const activeViols = violKey === 'total' ? violKeys : [violKey];
  const locKeys = Object.keys(byPosViol);
  let totalVics = 0, totalKilled = 0, totalInjured = 0;
  const locTotals = [];

  locKeys.forEach(posKey => {
    const loc = byPosViol[posKey];
    const bv = loc.by_viol;
    const locTotal = (bv.killed||0)+(bv.injured||0)+(bv.abducted||0)+(bv.crsv||0);
    if (locTotal <= 0) return;

    const violsPresent = activeViols.filter(v => (bv[v]||0) > 0);
    const hasMultipleAtLoc = violKey === 'total' && violsPresent.length > 1;
    const popupData = { ...loc, killed: bv.killed||0, injured: bv.injured||0, abducted: bv.abducted||0, crsv: bv.crsv||0, total: locTotal, perpetrator: '—' };

    violsPresent.forEach(viol => {
      const count = bv[viol] || 0;
      if (count <= 0) return;
      const r = bubbleRadius(count);
      const [dLat, dLng] = offsetForViol(viol, hasMultipleAtLoc);
      const circle = L.circleMarker([loc.lat + dLat, loc.long + dLng], {
        radius: r,
        fillColor: violFill(viol),
        color: 'rgba(255,255,255,0.25)',
        weight: 1,
        fillOpacity: 0.75,
      }).addTo(casualtyMap).bindPopup(casPopup(popupData, viol), {
        maxWidth: 240,
        className: 'dark-popup',
      });
      casMarkers.push(circle);
    });

    const violVal = violKey === 'total' ? locTotal : (bv[violKey]||0);
    if (violVal <= 0) return;
    totalVics += locTotal;
    totalKilled += bv.killed || 0;
    totalInjured += bv.injured || 0;
    locTotals.push({ ...loc, violVal });
  });

  const setEl = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl('map-loc-count',    locTotals.length);
  setEl('map-total-count',  fmt(totalVics));
  setEl('map-killed-count', fmt(totalKilled));
  setEl('map-injured-count',fmt(totalInjured));

  const top5 = locTotals.sort((a,b)=>b.violVal-a.violVal).slice(0,5);
  const hEl = document.getElementById('map-top-hotspots');
  if (hEl) {
    hEl.innerHTML = top5.map((l,i) => {
      const name = [l.payam||l.county, l.state].filter(Boolean).join(', ');
      return `<div class="stat-row">
        <span class="stat-row-label" style="font-size:11px">${i+1}. ${name||'Unknown'}</span>
        <span class="stat-row-value" style="font-size:13px;color:#38bdf8">${fmt(l.violVal)}</span>
      </div>`;
    }).join('');
  }
}

/** Initialize SGBV map and update markers from D.sgbv.q4_locations / all_locations. */
function buildSGBVMap() {
  if (sgbvMap) return;
  sgbvMap = L.map('sgbv-map', { center: MAP_CENTER, zoom: MAP_ZOOM });
  window._sgbvMap = sgbvMap;
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains:'abcd', maxZoom:18 }).addTo(sgbvMap);
  addSouthSudanBoundary(sgbvMap);

  // State labels
  Object.entries(STATE_CENTROIDS).forEach(([name, pos]) => {
    L.marker([pos.lat, pos.lng], {
      icon: L.divIcon({
        className:'',
        html:`<div style="color:rgba(255,255,255,0.2);font-size:10px;font-weight:700;
                          white-space:nowrap;text-shadow:0 1px 3px #000;pointer-events:none">
                ${name.toUpperCase()}
              </div>`,
        iconAnchor:[0,0],
      }),
      interactive:false,
    }).addTo(sgbvMap);
  });

  updateSGBVMap();
}

/** Rebuild SGBV markers; also overlays CRSV from D.q4_locations for quarter. */
function updateSGBVMap() {
  if (!sgbvMap) { buildSGBVMap(); return; }

  sgbvMarkers.forEach(m => m.remove());
  sgbvMarkers = [];

  const quarter = document.getElementById('sgbv-quarter-filter')?.value || 'Q4';
  let locs;
  if (quarter === 'Q4') {
    locs = D.sgbv.q4_locations || [];
  } else if (quarter === 'all') {
    locs = D.sgbv.all_locations || [];
  } else {
    locs = (D.sgbv.all_locations || []).filter(l => l.quarter === quarter);
  }
  locs = locs.filter(l => inSouthSudan(l.lat, l.long));

  let totalCases = 0;

  locs.forEach(loc => {
    if (!loc.lat || !loc.long || !(loc.total > 0)) return;
    const r = sgbvRadius(loc.total);
    totalCases += loc.total;

    const circle = L.circleMarker([loc.lat, loc.long], {
      radius: r,
      fillColor: 'rgba(244,114,182,0.7)',
      color: 'rgba(255,255,255,0.3)',
      weight: 1,
      fillOpacity: 0.8,
    }).addTo(sgbvMap).bindPopup(sgbvPopup(loc), { maxWidth: 220 });

    sgbvMarkers.push(circle);
  });

  // Also add state-level bubbles for states with data but no county coordinates
  const coveredStates = new Set(locs.map(l=>l.state).filter(Boolean));
  const getStateEntries = () => {
    if (quarter === 'Q4') return Object.entries(D.sgbv.q4_by_state || {});
    const qs = D.sgbv.quarterly_by_state?.[quarter] || {};
    return Object.entries(qs).map(([s, v]) => [s, { total: v }]);
  };
  getStateEntries().forEach(([state, sd]) => {
    if (!coveredStates.has(state) && sd.total > 0) {
      const pos = STATE_CENTROIDS[state];
      if (!pos) return;
      const r = sgbvRadius(sd.total);
      totalCases += sd.total;
      const circle = L.circleMarker([pos.lat, pos.lng], {
        radius: r,
        fillColor: 'rgba(244,114,182,0.5)',
        color: 'rgba(244,114,182,0.4)',
        weight: 2,
        dashArray: '4',
        fillOpacity: 0.6,
      }).addTo(sgbvMap).bindPopup(
        `<div class="popup-title">${state} (State-level)</div>
         <div class="popup-row"><span>SGBV Cases</span><span style="color:#f472b6">${fmt(sd.total)}</span></div>`,
        { maxWidth: 200 }
      );
      sgbvMarkers.push(circle);
    }
  });

  // ── CRSV bubbles (teal) from main casualty data ─────────────────
  const crsvSource = (quarter === 'Q4')
    ? (D.q4_locations || [])
    : (quarter === 'all')
      ? (D.all_locations || [])
      : (D.all_locations || []).filter(l => l.quarter === quarter);
  const crsvByPos = {};
  crsvSource.forEach(loc => {
    if (!loc.crsv || loc.crsv <= 0) return;
    const key = `${loc.lat},${loc.long}`;
    if (!crsvByPos[key]) crsvByPos[key] = { ...loc, crsv: loc.crsv };
    else crsvByPos[key].crsv += loc.crsv;
  });

  let totalCrsv = 0;
  Object.values(crsvByPos).forEach(loc => {
    const r = sgbvRadius(loc.crsv);
    if (r === 0) return;
    totalCrsv += loc.crsv;
    const locName = [loc.payam || loc.county, loc.state].filter(Boolean).join(' › ');
    const circle = L.circleMarker([loc.lat, loc.long], {
      radius: r,
      fillColor: 'rgba(52,211,153,0.75)',
      color: 'rgba(255,255,255,0.3)',
      weight: 1,
      fillOpacity: 0.85,
    }).addTo(sgbvMap).bindPopup(
      `<div class="popup-title">${locName || 'Unknown location'}</div>
       <div class="popup-row"><span>CRSV Cases</span><span style="color:#34d399">${fmt(loc.crsv)}</span></div>`,
      { maxWidth: 220 }
    );
    sgbvMarkers.push(circle);
  });

  const sgbvTotal = quarter === 'Q4'
    ? (D.sgbv.q4?.total || 0)
    : (quarter === 'all')
      ? locs.reduce((s,l)=>s+(l.total||0),0)
      : (D.sgbv.quarterly?.[quarter] || locs.reduce((s,l)=>s+(l.total||0),0));
  const setEl = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl('sgbv-loc-count',   locs.filter(l=>l.total>0).length);
  setEl('sgbv-total-count', fmt(sgbvTotal));
  setEl('sgbv-crsv-count',  fmt(totalCrsv));

  // Top hotspots
  const top5 = [...locs].sort((a,b)=>b.total-a.total).slice(0,5);
  const hEl = document.getElementById('sgbv-top-hotspots');
  if (hEl) {
    hEl.innerHTML = top5.map((l,i) => {
      const name = [l.county, l.state].filter(Boolean).join(', ');
      return `<div class="stat-row">
        <span class="stat-row-label" style="font-size:11px">${i+1}. ${name||'Unknown'}</span>
        <span class="stat-row-value" style="font-size:13px;color:#f472b6">${fmt(l.total)}</span>
      </div>`;
    }).join('');
  }
}

/** Initialize perpetrator map; circles coloured by perpetrator group. */
function buildPerpetratorMap() {
  if (perpMap) return;
  perpMap = L.map('perp-map', { center: MAP_CENTER, zoom: MAP_ZOOM });
  window._perpMap = perpMap;
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains:'abcd', maxZoom:18 }).addTo(perpMap);
  addSouthSudanBoundary(perpMap);

  Object.entries(STATE_CENTROIDS).forEach(([name, pos]) => {
    L.marker([pos.lat, pos.lng], {
      icon: L.divIcon({
        className:'',
        html:`<div style="color:rgba(255,255,255,0.2);font-size:10px;font-weight:700;
                          white-space:nowrap;text-shadow:0 1px 3px #000;pointer-events:none">
                ${name.toUpperCase()}
              </div>`,
        iconAnchor:[0,0],
      }),
      interactive:false,
    }).addTo(perpMap);
  });

  updatePerpetratorMap();
}

/** Rebuild perpetrator markers; group by location × perpetrator with offsets. */
function updatePerpetratorMap() {
  if (!perpMap) { buildPerpetratorMap(); return; }

  perpMarkers.forEach(m => m.remove());
  perpMarkers = [];

  const quarter = document.getElementById('perp-quarter-filter')?.value || 'Q4';
  const perpFilt = document.getElementById('perp-perp-filter')?.value || 'all';

  let locations;
  if (quarter === 'Q4') {
    locations = D.q4_locations || [];
  } else if (quarter === 'all') {
    locations = D.all_locations || [];
  } else {
    locations = (D.all_locations || []).filter(l => l.quarter === quarter);
  }

  if (perpFilt !== 'all') {
    locations = locations.filter(l => l.perpetrator === perpFilt);
  }
  locations = locations.filter(l => inSouthSudan(l.lat, l.long));

  let militiaTotal = 0, convTotal = 0, oppTotal = 0;
  locations.forEach(loc => {
    const perp = loc.perpetrator || 'Unidentified/Opportunistic';
    const v = loc.total || 0;
    if (perp.includes('Community')) militiaTotal += v;
    else if (perp.includes('Conventional')) convTotal += v;
    else oppTotal += v;
  });

  // Use state centroid when lat/long missing
  locations = locations.map(loc => {
    if (loc.lat != null && loc.long != null) return loc;
    const pos = STATE_CENTROIDS[loc.state];
    if (pos) return { ...loc, lat: pos.lat, long: pos.lng };
    return null;
  }).filter(Boolean);

  // Group by position AND perpetrator — one circle per perpetrator at each location
  const byPosPerp = {};
  locations.forEach(loc => {
    const key = `${loc.lat},${loc.long}`;
    const perp = loc.perpetrator || 'Unidentified/Opportunistic';
    if (!byPosPerp[key]) {
      byPosPerp[key] = { payam: loc.payam, county: loc.county, state: loc.state, lat: loc.lat, long: loc.long, by_perp: {} };
    }
    const bp = byPosPerp[key].by_perp;
    if (!bp[perp]) bp[perp] = { total: 0, killed: 0, injured: 0, abducted: 0, crsv: 0 };
    ['total','killed','injured','abducted','crsv'].forEach(k => {
      bp[perp][k] = (bp[perp][k]||0) + (loc[k]||0);
    });
  });

  let totalVics = 0;
  const locTotals = [];

  Object.entries(byPosPerp).forEach(([posKey, loc]) => {
    const perps = Object.entries(loc.by_perp).filter(([,d]) => (d.total||0) > 0);
    const hasMultipleAtLoc = perpFilt === 'all' && perps.length > 1;
    let locTotal = 0;

    perps.forEach(([perp, data]) => {
      const count = data.total || 0;
      if (count <= 0) return;
      locTotal += count;
      totalVics += count;

      const r = bubbleRadius(count);
      const [dLat, dLng] = offsetForPerp(perp, hasMultipleAtLoc);
      const circle = L.circleMarker([loc.lat + dLat, loc.long + dLng], {
        radius: r,
        fillColor: perpFill(perp),
        color: 'rgba(255,255,255,0.25)',
        weight: 1,
        fillOpacity: 0.75,
      }).addTo(perpMap).bindPopup(perpPopup({ ...loc, ...data, perpetrator: perp }), {
        maxWidth: 240,
        className: 'dark-popup',
      });
      perpMarkers.push(circle);
    });

    locTotals.push({ ...loc, total: locTotal });
  });

  const setEl = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl('perp-loc-count', Object.keys(byPosPerp).length);
  setEl('perp-total-count', fmt(totalVics));
  setEl('perp-militia-count', fmt(militiaTotal));
  setEl('perp-conventional-count', fmt(convTotal));
  setEl('perp-opportunistic-count', fmt(oppTotal));

  const top5 = locTotals.sort((a,b)=>b.total-a.total).slice(0,5);
  const hEl = document.getElementById('perp-top-hotspots');
  if (hEl) {
    hEl.innerHTML = top5.map((l,i) => {
      const name = [l.payam||l.county, l.state].filter(Boolean).join(', ');
      const perpsAtLoc = Object.entries(l.by_perp || {}).filter(([,d])=>(d.total||0)>0).sort((a,b)=>(b[1].total||0)-(a[1].total||0));
      const perpSummary = perpsAtLoc.map(([p,d]) => `${perpFullName(p)}: ${fmt(d.total)}`).join(' · ');
      return `<div class="stat-row">
        <span class="stat-row-label" style="font-size:11px">${i+1}. ${name||'Unknown'}</span>
        <span class="stat-row-value" style="font-size:12px;color:var(--text-muted)">${perpSummary}</span>
      </div>`;
    }).join('');
  }
}

// Map download helpers: get map instance from wrapper, capture as PNG, export locations as CSV
function getMapFromWrapper(wrapper) {
  const mapEl = wrapper?.querySelector('#map, #perp-map, #sgbv-map');
  if (!mapEl) return null;
  const id = mapEl.id;
  if (id === 'map') return window._casualtyMap;
  if (id === 'perp-map') return window._perpMap;
  if (id === 'sgbv-map') return window._sgbvMap;
  return null;
}

function captureMapAsPNG(mapWrapper, filename) {
  if (typeof html2canvas === 'undefined') {
    console.warn('html2canvas not loaded');
    return;
  }
  const map = getMapFromWrapper(mapWrapper);
  const doCapture = () => {
    html2canvas(mapWrapper, { useCORS: true, allowTaint: true, backgroundColor: '#0c1f3a', scale: 1 })
      .then(canvas => {
        const link = document.createElement('a');
        link.download = (filename || 'map') + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      })
      .catch(err => console.warn('Map capture failed:', err));
  };

  if (map) {
    map.fitBounds(SS_BOUNDS, { padding: [20, 20], maxZoom: 8 });
    map.invalidateSize();
    setTimeout(doCapture, 500);
  } else {
    doCapture();
  }
}

function downloadMapData(type) {
  if (type === 'casualty') {
    const locs = D.q4_locations || [];
    const rows = [['lat','long','state','county','payam','total','killed','injured','abducted','crsv','perpetrator']];
    locs.forEach(l => rows.push([l.lat, l.long, l.state, l.county, l.payam, l.total, l.killed, l.injured, l.abducted, l.crsv, l.perpetrator]));
    if (typeof downloadCSV === 'function') {
      downloadCSV(rows, 'unmiss-q4-casualty-locations.csv');
    }
  } else if (type === 'sgbv') {
    const locs = D.sgbv?.q4_locations || [];
    const rows = [['lat','long','state','county','total']];
    locs.forEach(l => rows.push([l.lat, l.long, l.state, l.county, l.total]));
    if (typeof downloadCSV === 'function') {
      downloadCSV(rows, 'unmiss-q4-sgbv-locations.csv');
    }
  } else if (type === 'perp') {
    const quarter = document.getElementById('perp-quarter-filter')?.value || 'Q4';
    let locs;
    if (quarter === 'Q4') locs = D.q4_locations || [];
    else if (quarter === 'all') locs = D.all_locations || [];
    else locs = (D.all_locations || []).filter(l => l.quarter === quarter);
    const rows = [['lat','long','state','county','payam','total','killed','injured','abducted','crsv','perpetrator']];
    locs.forEach(l => rows.push([l.lat, l.long, l.state, l.county, l.payam, l.total, l.killed, l.injured, l.abducted, l.crsv, l.perpetrator]));
    if (typeof downloadCSV === 'function') {
      downloadCSV(rows, 'unmiss-perpetrator-locations.csv');
    }
  }
}

// ── Init on load ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Build casualty map if casualty panel is active (default)
  if (document.getElementById('casualty')?.classList.contains('active')) {
    buildCasualtyMap();
  }
  // If page was loaded with #sgbv hash, showMapTab already handles buildSGBVMap

  // Map download buttons
  const dlCas = document.getElementById('dl-casualty-map');
  const dlPerp = document.getElementById('dl-perp-map');
  const dlSgbv = document.getElementById('dl-sgbv-map');
  if (dlCas) {
    dlCas.onclick = () => {
      const wrap = document.querySelector('#casualty .map-wrapper');
      if (wrap) captureMapAsPNG(wrap, 'unmiss-q4-casualty-map');
    };
  }
  if (dlPerp) {
    dlPerp.onclick = () => {
      const wrap = document.querySelector('#perp-panel .map-wrapper');
      if (wrap) captureMapAsPNG(wrap, 'unmiss-perpetrator-map');
    };
  }
  if (dlSgbv) {
    dlSgbv.onclick = () => {
      const wrap = document.querySelector('#sgbv-panel .map-wrapper');
      if (wrap) captureMapAsPNG(wrap, 'unmiss-q4-sgbv-map');
    };
  }
  const dlCasData = document.getElementById('dl-casualty-data');
  const dlPerpData = document.getElementById('dl-perp-data');
  const dlSgbvData = document.getElementById('dl-sgbv-data');
  if (dlCasData) dlCasData.onclick = () => downloadMapData('casualty');
  if (dlPerpData) dlPerpData.onclick = () => downloadMapData('perp');
  if (dlSgbvData) dlSgbvData.onclick = () => downloadMapData('sgbv');
});
