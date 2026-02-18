/* ============================================================
   UNMISS HRD Q4 2025 – Shared Utilities & Chart Config
   ============================================================ */

// ── Colour System ────────────────────────────────────────────
const C = {
  bg:         '#060b18',
  bgCard:     '#0c1428',
  bgCard2:    '#111e38',
  text:       '#e2e8f7',
  textMuted:  '#7a91b8',
  textDim:    '#4a5e82',
  border:     'rgba(99,132,200,0.18)',
  accent:     '#38bdf8',
  accent2:    '#818cf8',

  killed:    '#f43f5e',
  injured:   '#fb923c',
  abducted:  '#c084fc',
  crsv:      '#34d399',

  male:   '#60a5fa',
  female: '#f472b6',
  boys:   '#93c5fd',
  girls:  '#f9a8d4',

  militia:       '#fbbf24',
  conventional:  '#818cf8',
  opportunistic: '#34d399',

  states: {
    'Warrap':                    '#f43f5e',
    'Central Equatoria':         '#c084fc',
    'Unity':                     '#60a5fa',
    'Lakes':                     '#34d399',
    'Eastern Equatoria':         '#fb923c',
    'Western Equatoria':         '#2dd4bf',
    'Jonglei':                   '#a78bfa',
    'Upper Nile':                '#94a3b8',
    'Western Bahr el Ghazal':    '#f59e0b',
    'Northern Bahr el Ghazal':   '#ec4899',
  },

  quarters: { Q1: '#60a5fa', Q2: '#fbbf24', Q3: '#fb923c', Q4: '#f43f5e' },

  violationColors: () => [C.killed, C.injured, C.abducted, C.crsv],
  genderColors:    () => [C.male, C.female, C.boys, C.girls],
  perpColors:      () => [C.militia, C.conventional, C.opportunistic],
  stateColors:     () => Object.values(C.states),
};

// ── Plotly Base Layout ───────────────────────────────────────
const baseLayout = (overrides = {}) => ({
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font: { color: C.textMuted, family: 'Inter, system-ui, sans-serif', size: 12 },
  xaxis: {
    gridcolor:  'rgba(99,132,200,0.1)',
    color:      C.textMuted,
    linecolor:  'rgba(99,132,200,0.2)',
    tickfont:   { size: 11 },
    zeroline: false,
  },
  yaxis: {
    gridcolor:  'rgba(99,132,200,0.1)',
    color:      C.textMuted,
    linecolor:  'rgba(99,132,200,0.2)',
    tickfont:   { size: 11 },
    zeroline: false,
  },
  legend: {
    bgcolor: 'rgba(0,0,0,0)',
    bordercolor: 'rgba(0,0,0,0)',
    font: { size: 11, color: C.textMuted },
    orientation: 'h',
    x: 0, y: -0.18,
  },
  margin: { t: 30, r: 16, b: 50, l: 60 },
  hovermode: 'closest',
  hoverlabel: {
    bgcolor: C.bgCard2,
    bordercolor: 'rgba(99,132,200,0.4)',
    font: { size: 12, color: C.text },
  },
  ...overrides,
});

const plotlyConfig = { displayModeBar: false, responsive: true };

// Helper to make chart
function makeChart(id, traces, layout, config = {}) {
  Plotly.newPlot(id, traces, { ...baseLayout(), ...layout }, { ...plotlyConfig, ...config });
}

// ── Data Helpers ─────────────────────────────────────────────
const D = UNMISS_DATA;

const VIOLATIONS = ['Killed', 'Injured', 'Abducted', 'CRSV'];
const QUARTERS   = ['Q1', 'Q2', 'Q3', 'Q4'];
const STATES     = [
  'Warrap', 'Central Equatoria', 'Unity', 'Lakes', 'Eastern Equatoria',
  'Western Equatoria', 'Jonglei', 'Upper Nile', 'Western Bahr el Ghazal',
  'Northern Bahr el Ghazal',
];
const PERPS = [
  'Community-based Militias',
  'Conventional Parties',
  'Unidentified/Opportunistic',
];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const GENDER_KEYS  = ['male','female','boys','girls'];
const GENDER_LABELS= ['Men','Women','Boys','Girls'];

// Shorthand accessors
const q4   = () => D.q4;
const q4St = (st) => D.q4_by_state[st] || { total:0, killed:0, injured:0, abducted:0, crsv:0, gender:{} };
const qAll = (q)  => D.quarterly[q];

function pct(part, whole) {
  if (!whole) return '0%';
  return (part / whole * 100).toFixed(1) + '%';
}
function pctNum(part, whole) {
  if (!whole) return 0;
  return +(part / whole * 100).toFixed(1);
}
function fmt(n) { return (n||0).toLocaleString(); }
function changeVsQ3(val) {
  const q3 = D.quarterly['Q3']?.total || 1;
  const diff = ((val - q3) / q3 * 100).toFixed(1);
  return diff > 0 ? `+${diff}%` : `${diff}%`;
}
function changePct(val, prev) {
  if (!prev) return '—';
  const diff = ((val - prev) / prev * 100).toFixed(1);
  return diff > 0 ? `+${diff}%` : `${diff}%`;
}

// ── Animated Counter ─────────────────────────────────────────
function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const startVal = 0;
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startVal + (target - startVal) * eased);
    el.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        animateCounter(el, target);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
  });
}

// ── Change indicator HTML ─────────────────────────────────────
function changeHtml(val, prev) {
  if (!prev) return '<span class="change neutral">—</span>';
  const diff = ((val - prev) / prev * 100).toFixed(1);
  const cls = diff > 0 ? 'up' : 'down';
  const arrow = diff > 0 ? '↑' : '↓';
  return `<span class="change ${cls}">${arrow} ${Math.abs(diff)}%</span>`;
}

// ── Quarter color ─────────────────────────────────────────────
function qColor(q) { return C.quarters[q] || C.accent; }

// ── State color ───────────────────────────────────────────────
function stColor(state) { return C.states[state] || C.textMuted; }

// ── Violation color ───────────────────────────────────────────
function vColor(v) {
  return { Killed: C.killed, Injured: C.injured, Abducted: C.abducted, CRSV: C.crsv }[v] || C.accent;
}
function vColorByKey(k) {
  return { killed: C.killed, injured: C.injured, abducted: C.abducted, crsv: C.crsv }[k] || C.accent;
}

// ── Perpetrator color ─────────────────────────────────────────
function pColor(p) {
  if (p.includes('Community')) return C.militia;
  if (p.includes('Conventional')) return C.conventional;
  return C.opportunistic;
}

// ── Perpetrator short name ────────────────────────────────────
function pShort(p) {
  if (p.includes('Community')) return 'Community Militias';
  if (p.includes('Conventional')) return 'Conventional Parties';
  return 'Unidentified/Opportunistic';
}

// ── Sort states by Q4 total ───────────────────────────────────
function sortedStates() {
  return STATES
    .filter(s => D.q4_by_state[s])
    .sort((a,b) => (D.q4_by_state[b]?.total||0) - (D.q4_by_state[a]?.total||0));
}

// ── Top N counties ────────────────────────────────────────────
function topCounties(n = 15) {
  return Object.entries(D.q4_by_county)
    .sort((a,b) => b[1].total - a[1].total)
    .slice(0, n);
}

// ── Top N payams ──────────────────────────────────────────────
function topPayams(n = 15) {
  return Object.entries(D.q4_by_payam)
    .sort((a,b) => b[1].total - a[1].total)
    .slice(0, n);
}

// ── Insert KPI card value ─────────────────────────────────────
function setKpi(id, val) {
  const el = document.getElementById(id);
  if (el) el.dataset.count = val;
}

// ── Active nav highlighting ────────────────────────────────────
function highlightNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === 'index.html' && href === 'index.html') ||
        (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ── Shared plotly bar layout helpers ─────────────────────────
function hBarLayout(title, height = 380) {
  return baseLayout({
    title: { text: title, font: { size: 13, color: C.textMuted }, x: 0 },
    xaxis: {
      gridcolor: 'rgba(99,132,200,0.1)', color: C.textMuted,
      tickfont: { size: 11 }, zeroline: false,
    },
    yaxis: {
      gridcolor: 'rgba(0,0,0,0)', color: C.text,
      tickfont: { size: 11 }, automargin: true, zeroline: false,
    },
    height,
    margin: { t: 30, r: 16, b: 30, l: 150 },
    legend: { orientation: 'h', x: 0, y: -0.12 },
  });
}

function vBarLayout(title, height = 360) {
  return baseLayout({
    title: { text: title, font: { size: 13, color: C.textMuted }, x: 0 },
    height,
    margin: { t: 30, r: 16, b: 80, l: 50 },
    legend: { orientation: 'h', x: 0, y: -0.22 },
  });
}

function pieLayout(height = 340) {
  return baseLayout({
    height,
    margin: { t: 20, r: 10, b: 30, l: 10 },
    legend: { orientation: 'v', x: 1.02, y: 0.5, font: { size: 11 } },
  });
}

// ── Generate donut trace ─────────────────────────────────────
function donutTrace(labels, values, colors, hole = 0.52, name = '') {
  return {
    type: 'pie',
    hole,
    labels,
    values,
    marker: { colors, line: { color: C.bg, width: 2 } },
    textinfo: 'percent',
    textfont: { size: 12, color: C.text },
    hovertemplate: '<b>%{label}</b><br>%{value:,}<br>%{percent}<extra></extra>',
    pull: values.map(() => 0.02),
    name,
  };
}

// ── Generate stacked bar traces ───────────────────────────────
function stackedBarTraces(categories, seriesData) {
  // seriesData: [{name, values, color}]
  return seriesData.map(s => ({
    type: 'bar',
    name: s.name,
    x: categories,
    y: s.values,
    marker: { color: s.color },
    hovertemplate: `<b>${s.name}</b><br>%{x}<br>%{y:,}<extra></extra>`,
    barmode: 'stack',
  }));
}

// ── Render insight list ───────────────────────────────────────
function renderInsights(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<ul class="insight-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
}

// Init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  highlightNav();
  initCounters();
});
