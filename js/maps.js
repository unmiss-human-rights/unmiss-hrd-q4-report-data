/* ============================================================
   UNMISS HRD – Maps Page (Leaflet)
   ============================================================ */

// State centroid fallbacks (used when no lat/long in data)
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

let casualtyMap  = null;
let sgbvMap      = null;
let casMarkers   = [];
let sgbvMarkers  = [];

// ── Radius from victim count ──────────────────────────────────
function bubbleRadius(n) {
  if (n <= 0) return 0;
  return Math.max(6, Math.min(45, Math.sqrt(n) * 3.5));
}
function sgbvRadius(n) {
  if (n <= 0) return 0;
  return Math.max(6, Math.min(35, Math.sqrt(n) * 5));
}

// ── Perpetrator → colour ──────────────────────────────────────
function perpFill(p) {
  if (!p) return 'rgba(244,63,94,0.65)';
  const pl = p.toLowerCase();
  if (pl.includes('community')) return 'rgba(251,191,36,0.65)';
  if (pl.includes('conventional')) return 'rgba(129,140,248,0.65)';
  return 'rgba(52,211,153,0.65)';
}

// ── Violation → colour ────────────────────────────────────────
function violFill(key) {
  return {killed:'rgba(244,63,94,0.7)', injured:'rgba(251,146,60,0.7)',
          abducted:'rgba(192,132,252,0.7)', crsv:'rgba(52,211,153,0.7)',
          total:'rgba(56,189,248,0.6)'}[key] || 'rgba(56,189,248,0.6)';
}

// ── Popup HTML ────────────────────────────────────────────────
function casPopup(loc, violKey) {
  const total   = loc[violKey] || loc.total || 0;
  const locName = [loc.payam, loc.county, loc.state].filter(Boolean).join(' › ');
  return `
    <div class="popup-title">${locName || 'Unknown location'}</div>
    <div class="popup-row"><span>Victims (${violKey})</span><span style="color:#38bdf8">${fmt(total)}</span></div>
    <div class="popup-row"><span>Killed</span><span style="color:#f43f5e">${fmt(loc.killed||0)}</span></div>
    <div class="popup-row"><span>Injured</span><span style="color:#fb923c">${fmt(loc.injured||0)}</span></div>
    <div class="popup-row"><span>Abducted</span><span style="color:#c084fc">${fmt(loc.abducted||0)}</span></div>
    <div class="popup-row"><span>CRSV</span><span style="color:#34d399">${fmt(loc.crsv||0)}</span></div>
    <div class="popup-row" style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(99,132,200,0.2)">
      <span>Perpetrator</span><span style="color:#fbbf24;font-size:11px">${loc.perpetrator||'—'}</span>
    </div>`;
}

function sgbvPopup(loc) {
  const locName = [loc.county, loc.state].filter(Boolean).join(' › ');
  return `
    <div class="popup-title">${locName || 'Unknown location'}</div>
    <div class="popup-row"><span>SGBV Cases</span><span style="color:#f472b6">${fmt(loc.total||0)}</span></div>`;
}

// ── Build casualty map ────────────────────────────────────────
function buildCasualtyMap() {
  if (casualtyMap) return;
  casualtyMap = L.map('map', { center: MAP_CENTER, zoom: MAP_ZOOM });
  window._casualtyMap = casualtyMap;
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains:'abcd', maxZoom:18 }).addTo(casualtyMap);

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

// ── Update casualty map with filters ─────────────────────────
function updateCasualtyMap() {
  if (!casualtyMap) { buildCasualtyMap(); return; }

  // Remove old markers
  casMarkers.forEach(m => m.remove());
  casMarkers = [];

  const quarter  = document.getElementById('cas-quarter-filter')?.value  || 'Q4';
  const violKey  = document.getElementById('cas-violation-filter')?.value || 'total';
  const perpFilt = document.getElementById('cas-perp-filter')?.value     || 'all';

  // Choose data source
  let locations;
  if (quarter === 'Q4') {
    locations = D.q4_locations;
  } else if (quarter === 'all') {
    locations = D.all_locations;
  } else {
    locations = D.all_locations.filter(l => l.quarter === quarter);
  }

  // Apply perpetrator filter (only for Q4 which has perpetrator data)
  if (perpFilt !== 'all') {
    locations = locations.filter(l => l.perpetrator === perpFilt);
  }

  // Group by lat/long to merge duplicate positions
  const byPos = {};
  locations.forEach(loc => {
    const key = `${loc.lat},${loc.long}`;
    if (!byPos[key]) byPos[key] = { ...loc };
    else {
      ['total','killed','injured','abducted','crsv'].forEach(k => {
        byPos[key][k] = (byPos[key][k]||0) + (loc[k]||0);
      });
    }
  });

  const merged = Object.values(byPos).filter(l => (l[violKey]||0) > 0);

  let totalVics = 0, totalKilled = 0, totalInjured = 0;

  merged.forEach(loc => {
    const r = bubbleRadius(loc[violKey] || 0);
    if (r === 0) return;

    const fillColor = perpFilt !== 'all' ? perpFill(loc.perpetrator) : violFill(violKey);
    totalVics   += loc.total  || 0;
    totalKilled += loc.killed || 0;
    totalInjured+= loc.injured|| 0;

    const circle = L.circleMarker([loc.lat, loc.long], {
      radius: r,
      fillColor,
      color: 'rgba(255,255,255,0.25)',
      weight: 1,
      fillOpacity: 0.75,
    }).addTo(casualtyMap).bindPopup(casPopup(loc, violKey), {
      maxWidth: 240,
      className: 'dark-popup',
    });

    casMarkers.push(circle);
  });

  // Update sidebar stats
  const setEl = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl('map-loc-count',    merged.length);
  setEl('map-total-count',  fmt(totalVics));
  setEl('map-killed-count', fmt(totalKilled));
  setEl('map-injured-count',fmt(totalInjured));

  // Top hotspots
  const top5 = merged.sort((a,b)=>(b[violKey]||0)-(a[violKey]||0)).slice(0,5);
  const hEl = document.getElementById('map-top-hotspots');
  if (hEl) {
    hEl.innerHTML = top5.map((l,i) => {
      const name = [l.payam||l.county, l.state].filter(Boolean).join(', ');
      return `<div class="stat-row">
        <span class="stat-row-label" style="font-size:11px">${i+1}. ${name||'Unknown'}</span>
        <span class="stat-row-value" style="font-size:13px;color:#38bdf8">${fmt(l[violKey]||0)}</span>
      </div>`;
    }).join('');
  }
}

// ── Build SGBV map ────────────────────────────────────────────
function buildSGBVMap() {
  if (sgbvMap) return;
  sgbvMap = L.map('sgbv-map', { center: MAP_CENTER, zoom: MAP_ZOOM });
  window._sgbvMap = sgbvMap;
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains:'abcd', maxZoom:18 }).addTo(sgbvMap);

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

// ── Update SGBV map ───────────────────────────────────────────
function updateSGBVMap() {
  if (!sgbvMap) { buildSGBVMap(); return; }

  sgbvMarkers.forEach(m => m.remove());
  sgbvMarkers = [];

  const locs = D.sgbv.q4_locations || [];

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
  Object.entries(D.sgbv.q4_by_state).forEach(([state, sd]) => {
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

  // ── CRSV bubbles (teal) from main casualty data ───────────────
  const crsvByPos = {};
  (D.q4_locations || []).forEach(loc => {
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

  const setEl = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl('sgbv-loc-count',   locs.filter(l=>l.total>0).length);
  setEl('sgbv-total-count', fmt(D.sgbv.q4.total));
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

// ── Init on load ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Build casualty map if casualty panel is active (default)
  if (document.getElementById('casualty')?.classList.contains('active')) {
    buildCasualtyMap();
  }
  // If page was loaded with #sgbv hash, showMapTab already handles buildSGBVMap
});
