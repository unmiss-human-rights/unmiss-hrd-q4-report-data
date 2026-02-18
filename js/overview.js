/* ============================================================
   UNMISS HRD – Overview Page Charts
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  const d = D;
  const q4  = d.q4;
  const q3  = d.quarterly['Q3'];

  // ── KPI cards ─────────────────────────────────────────────
  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  const setCount = (id, n) => { const e = document.getElementById(id); if (e) { e.dataset.count = n; animateCounter(e, n); } };

  setCount('kpi-total',   q4.total);
  setCount('kpi-killed',  q4.killed);
  setCount('kpi-injured', q4.injured);
  setCount('kpi-abducted',q4.abducted);
  setCount('kpi-crsv',    q4.crsv);
  setCount('kpi-sgbv',    d.sgbv.q4.total);

  // Pct labels
  const mp = (n, t) => { const p = (n/t*100).toFixed(1); return `<span class="kpi-pct ${p>50?'up':'down'}">${p}%</span>`; };
  setEl('kpi-killed-pct',   (q4.killed/q4.total*100).toFixed(1)+'%');
  setEl('kpi-injured-pct',  (q4.injured/q4.total*100).toFixed(1)+'%');
  setEl('kpi-abducted-pct', (q4.abducted/q4.total*100).toFixed(1)+'%');
  setEl('kpi-crsv-pct',     (q4.crsv/q4.total*100).toFixed(1)+'%');

  // Q3 vs Q4 change
  const chgHtml = (v, p) => {
    if (!p) return '';
    const d = ((v-p)/p*100);
    const cls = d > 0 ? 'up' : 'down';
    return `<span class="change ${cls}">${d>0?'↑':'↓'} ${Math.abs(d).toFixed(1)}%</span>`;
  };
  setEl('kpi-total-change', chgHtml(q4.total, q3.total));

  // ── % Bars ────────────────────────────────────────────────
  const barsEl = document.getElementById('kpi-bars');
  if (barsEl) {
    const vItems = [
      { label: 'Killed',   val: q4.killed,   color: C.killed,   key: 'killed'   },
      { label: 'Injured',  val: q4.injured,  color: C.injured,  key: 'injured'  },
      { label: 'Abducted', val: q4.abducted, color: C.abducted, key: 'abducted' },
      { label: 'CRSV',     val: q4.crsv,     color: C.crsv,     key: 'crsv'     },
    ];
    barsEl.innerHTML = vItems.map(item => {
      const p = (item.val/q4.total*100).toFixed(1);
      return `
        <div class="progress-row">
          <div class="progress-label">${item.label}</div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${p}%;background:${item.color}"></div>
          </div>
          <div class="progress-val">${p}%</div>
        </div>`;
    }).join('');
  }

  // ── QoQ Indicators ────────────────────────────────────────
  const qoqEl = document.getElementById('qoq-indicators');
  if (qoqEl) {
    const items = [
      { label: 'Total Victims', cur: q4.total, prev: q3.total },
      { label: 'Killed',        cur: q4.killed,  prev: q3.killed  },
      { label: 'Injured',       cur: q4.injured,  prev: q3.injured },
      { label: 'Abducted',      cur: q4.abducted, prev: q3.abducted },
      { label: 'CRSV',          cur: q4.crsv,    prev: q3.crsv    },
    ];
    qoqEl.innerHTML = items.map(item => {
      const diff = item.prev ? ((item.cur - item.prev)/item.prev*100) : 0;
      const sign = diff > 0 ? '+' : '';
      const col  = diff > 0 ? C.killed : C.crsv;
      return `
        <div class="stat-row">
          <div class="stat-row-label">${item.label}</div>
          <div class="stat-row-value">${fmt(item.cur)}</div>
          <div style="font-size:12px;font-weight:700;color:${col};min-width:60px;text-align:right">
            ${sign}${diff.toFixed(1)}%
          </div>
        </div>`;
    }).join('');
  }

  // ── Violation Donut ───────────────────────────────────────
  Plotly.newPlot('chart-violation-donut', [
    donutTrace(
      ['Killed','Injured','Abducted','CRSV'],
      [q4.killed, q4.injured, q4.abducted, q4.crsv],
      [C.killed, C.injured, C.abducted, C.crsv],
      0.52
    )
  ], {
    ...pieLayout(290),
    annotations: [{
      text: `<b style="font-size:20px">${fmt(q4.total)}</b><br><span style="font-size:11px;color:${C.textMuted}">Victims</span>`,
      x: 0.5, y: 0.5, showarrow: false, font: { color: C.text }
    }]
  }, plotlyConfig);

  // ── Gender Donut ──────────────────────────────────────────
  const g = q4.gender;
  Plotly.newPlot('chart-gender-donut', [
    donutTrace(
      ['Men','Women','Boys','Girls'],
      [g.male, g.female, g.boys, g.girls],
      [C.male, C.female, C.boys, C.girls],
      0.52
    )
  ], {
    ...pieLayout(290),
    annotations: [{
      text: `<b style="font-size:20px">${fmt(q4.total)}</b><br><span style="font-size:11px;color:${C.textMuted}">Total</span>`,
      x: 0.5, y: 0.5, showarrow: false, font: { color: C.text }
    }]
  }, plotlyConfig);

  // ── Quarterly Grouped Bar ─────────────────────────────────
  const qLabels = ['Q1','Q2','Q3','Q4'];
  const qTraces = ['killed','injured','abducted','crsv'].map((v, i) => ({
    type: 'bar',
    name: v.charAt(0).toUpperCase()+v.slice(1),
    x: qLabels,
    y: qLabels.map(q => d.quarterly[q][v]),
    marker: { color: [C.killed,C.injured,C.abducted,C.crsv][i], opacity: 0.85 },
    hovertemplate: `<b>${v}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-quarterly-grouped', qTraces, {
    ...baseLayout({ barmode: 'group', height: 320 }),
    margin: { t: 20, r: 16, b: 50, l: 55 },
    legend: { orientation:'h', x:0, y:-0.22 },
  }, plotlyConfig);

  // ── Quarterly Stacked Area ────────────────────────────────
  const areaTraces = ['killed','injured','abducted','crsv'].map((v, i) => ({
    type: 'scatter',
    mode: 'lines',
    stackgroup: 'one',
    name: v.charAt(0).toUpperCase()+v.slice(1),
    x: qLabels,
    y: qLabels.map(q => d.quarterly[q][v]),
    line: { color: [C.killed,C.injured,C.abducted,C.crsv][i], width: 2 },
    fillcolor: [C.killed,C.injured,C.abducted,C.crsv][i].replace(')', ',0.25)').replace('rgb','rgba').replace('#',''),
    hovertemplate: `<b>${v}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  // fix fill colors using a simple approach
  const areaColors = [C.killed,C.injured,C.abducted,C.crsv];
  const areaTracesFixed = areaColors.map((col, i) => ({
    ...areaTraces[i],
    fill: 'tonexty',
    fillcolor: col + '30',
    line: { color: col, width: 2 },
  }));
  areaTracesFixed[0].fill = 'tozeroy';
  Plotly.newPlot('chart-quarterly-stacked', areaTracesFixed, {
    ...baseLayout({ height: 320 }),
    margin: { t: 20, r: 16, b: 50, l: 55 },
    legend: { orientation:'h', x:0, y:-0.22 },
  }, plotlyConfig);

  // ── Monthly Trend 2025 ────────────────────────────────────
  const mLabels = MONTHS.map((_,i) => MONTH_SHORT[i]);
  const q4Months = ['October','November','December'];

  const monthlyTraces = ['killed','injured','abducted','crsv'].map((v, i) => ({
    type: 'scatter',
    mode: 'lines+markers',
    name: v.charAt(0).toUpperCase()+v.slice(1),
    x: mLabels,
    y: MONTHS.map(m => d.monthly_2025[m]?.[v] || 0),
    line: { color: [C.killed,C.injured,C.abducted,C.crsv][i], width: 2.5 },
    marker: { size: 5, color: [C.killed,C.injured,C.abducted,C.crsv][i] },
    hovertemplate: `<b>${v}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));

  // Q4 highlight shape
  const q4Shape = {
    type: 'rect', xref: 'x', yref: 'paper',
    x0: 'Oct', x1: 'Dec',
    y0: 0, y1: 1,
    fillcolor: 'rgba(244,63,94,0.06)',
    line: { color: 'rgba(244,63,94,0.25)', width: 1 },
  };

  Plotly.newPlot('chart-monthly-trend', monthlyTraces, {
    ...baseLayout({ height: 340, shapes: [q4Shape] }),
    annotations: [{
      x: 'Nov', y: 1.05, xref: 'x', yref: 'paper',
      text: '◀ Q4 2025 ▶', showarrow: false,
      font: { size: 11, color: C.killed }, bgcolor: 'rgba(244,63,94,0.1)',
    }],
    margin: { t: 40, r: 16, b: 60, l: 55 },
    legend: { orientation:'h', x:0, y:-0.22 },
  }, plotlyConfig);

  // ── Perpetrator Donut ─────────────────────────────────────
  const perpData = PERPS.map(p => ({
    name: pShort(p), val: d.q4_by_perpetrator[p]?.total || 0, col: pColor(p)
  }));
  Plotly.newPlot('chart-perp-donut', [
    donutTrace(perpData.map(p=>p.name), perpData.map(p=>p.val), perpData.map(p=>p.col), 0.52)
  ], {
    ...pieLayout(290),
    annotations: [{
      text: `<b style="font-size:16px">${PERPS.length}</b><br><span style="font-size:10px;color:${C.textMuted}">Actor Types</span>`,
      x: 0.5, y: 0.5, showarrow: false, font: { color: C.text }
    }]
  }, plotlyConfig);

  // ── State Bar (stacked by violation) ─────────────────────
  const sts = sortedStates();
  const stVioTraces = ['killed','injured','abducted','crsv'].map((v,i) => ({
    type: 'bar',
    name: v.charAt(0).toUpperCase()+v.slice(1),
    y: sts,
    x: sts.map(s => d.q4_by_state[s]?.[v] || 0),
    orientation: 'h',
    marker: { color: [C.killed,C.injured,C.abducted,C.crsv][i] },
    hovertemplate: `<b>${v}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-state-bar', stVioTraces, {
    ...baseLayout({ barmode:'stack', height: 380 }),
    margin: { t: 20, r: 20, b: 40, l: 170 },
    xaxis: { title: 'Victims', gridcolor: 'rgba(99,132,200,0.1)' },
    yaxis: { tickfont: { size: 11 }, automargin: true },
    legend: { orientation:'h', x:0, y:-0.12 },
  }, plotlyConfig);

  // ── Historical Trend ──────────────────────────────────────
  const years = Object.keys(d.yearly_trend).sort();
  const perpKeys = ['community','conventional','opportunistic'];
  const perpNames = ['Community Militias','Conventional Parties','Unidentified/Opportunistic'];
  const perpCols  = [C.militia, C.conventional, C.opportunistic];

  const histTraces = [];
  years.forEach(yr => {
    const yrData = d.yearly_trend[yr];
    perpKeys.forEach((pk, pi) => {
      histTraces.push({
        type: 'scatter',
        mode: 'lines+markers',
        name: `${yr} – ${perpNames[pi]}`,
        x: MONTH_SHORT,
        y: MONTHS.map(m => yrData[m]?.[pk] || 0),
        line: {
          color: perpCols[pi],
          width: yr === '2025' ? 3 : 1.5,
          dash: yr === '2025' ? 'solid' : (yr === '2024' ? 'dot' : 'dash'),
        },
        marker: { size: yr==='2025' ? 6 : 4, color: perpCols[pi] },
        opacity: yr === '2025' ? 1 : 0.55,
        hovertemplate: `<b>${yr} ${perpNames[pi]}</b><br>%{x}: %{y:,}<extra></extra>`,
        legendgroup: yr,
      });
    });
  });

  Plotly.newPlot('chart-historical', histTraces, {
    ...baseLayout({ height: 380 }),
    margin: { t: 20, r: 20, b: 60, l: 55 },
    legend: { orientation:'h', x:0, y:-0.28, font:{ size:10 } },
  }, plotlyConfig);

  // ── Perpetrator Quarterly Grouped Bar ─────────────────────
  const perpQTraces = PERPS.map(p => ({
    type: 'bar',
    name: pShort(p),
    x: QUARTERS,
    y: QUARTERS.map(q => d.quarterly_by_perpetrator[q][p] || 0),
    marker: { color: pColor(p) },
    hovertemplate: `<b>${pShort(p)}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-perp-quarterly', perpQTraces, {
    ...baseLayout({ barmode:'group', height: 300 }),
    margin: { t: 20, r: 16, b: 50, l: 55 },
    legend: { orientation:'h', x:0, y:-0.28, font:{size:10} },
  }, plotlyConfig);

  // ── Quarterly Gender Stacked Bar ──────────────────────────
  const gKeys   = ['male','female','boys','girls'];
  const gLabels = ['Men','Women','Boys','Girls'];
  const gCols   = [C.male, C.female, C.boys, C.girls];
  const qGenderTraces = gKeys.map((k,i) => ({
    type: 'bar',
    name: gLabels[i],
    x: QUARTERS,
    y: QUARTERS.map(q => d.quarterly[q].gender[k] || 0),
    marker: { color: gCols[i] },
    hovertemplate: `<b>${gLabels[i]}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-quarterly-gender', qGenderTraces, {
    ...baseLayout({ barmode:'stack', height: 300 }),
    margin: { t: 20, r: 16, b: 50, l: 55 },
    legend: { orientation:'h', x:0, y:-0.28, font:{size:10} },
  }, plotlyConfig);

  // ── Insights ──────────────────────────────────────────────
  const topState = sortedStates()[0];
  const topStateData = d.q4_by_state[topState] || {};
  const q3Total = d.quarterly['Q3'].total;
  const chg = ((q4.total - q3Total)/q3Total*100).toFixed(1);
  const chgDir = q4.total < q3Total ? 'decrease' : 'increase';

  document.getElementById('insight-main').innerHTML = `
    <ul class="insight-list">
      <li>Q4 2025 recorded <strong class="highlight">${fmt(q4.total)} civilian victims</strong> — a <strong class="highlight">${Math.abs(chg)}% ${chgDir}</strong> from Q3 2025 (${fmt(q3Total)} victims).</li>
      <li>Killing remains the most prevalent form of harm at <strong class="highlight">${(q4.killed/q4.total*100).toFixed(1)}%</strong> of all victims, followed by injury (${(q4.injured/q4.total*100).toFixed(1)}%).</li>
      <li><strong class="highlight">${topState}</strong> is the most affected state with <strong class="highlight">${fmt(topStateData.total || 0)} victims</strong> — ${((topStateData.total||0)/q4.total*100).toFixed(1)}% of the national total.</li>
      <li>Men comprise <strong class="highlight">${(g.male/q4.total*100).toFixed(1)}%</strong> of all victims, while women and children together represent <strong class="highlight">${((g.female+g.boys+g.girls)/q4.total*100).toFixed(1)}%</strong>.</li>
    </ul>`;

  const topPerp = PERPS.reduce((a,b) => (d.q4_by_perpetrator[a]?.total||0) > (d.q4_by_perpetrator[b]?.total||0) ? a : b);
  const topPerpPct = ((d.q4_by_perpetrator[topPerp]?.total||0)/q4.total*100).toFixed(1);

  document.getElementById('insight-secondary').innerHTML = `
    <ul class="insight-list">
      <li><strong class="highlight">${pShort(topPerp)}</strong> are responsible for <strong class="highlight">${topPerpPct}%</strong> of all Q4 civilian casualties, continuing as the dominant perpetrator group.</li>
      <li>CRSV accounted for <strong class="highlight">${fmt(q4.crsv)} victims</strong> (${(q4.crsv/q4.total*100).toFixed(1)}%), with women and girls disproportionately affected.</li>
      <li>Q4 SGBV cases: <strong class="highlight">${d.sgbv.q4.total} documented survivors</strong>. Combined with CRSV, sexual violence remains critically underreported.</li>
      <li>The 2025 yearly total stands at <strong class="highlight">${fmt(d.quarterly.Q1.total + d.quarterly.Q2.total + d.quarterly.Q3.total + d.quarterly.Q4.total)} victims</strong> across all four quarters.</li>
    </ul>`;

});
