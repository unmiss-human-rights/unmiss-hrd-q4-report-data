/* ============================================================
   UNMISS HRD – Perpetrators Page Charts
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const d  = D;
  const q4 = d.q4;

  const setCount = (id, n) => { const e = document.getElementById(id); if(e){e.dataset.count=n; animateCounter(e,n);} };
  const setEl    = (id, v) => { const e = document.getElementById(id); if(e) e.innerHTML = v; };

  const vKeys   = ['killed','injured','abducted','crsv'];
  const vLabels = ['Killed','Injured','Abducted','CRSV'];
  const gKeys   = ['male','female','boys','girls'];
  const gLabels = ['Men','Women','Boys','Girls'];
  const gCols   = [C.male, C.female, C.boys, C.girls];

  // ── KPIs ──────────────────────────────────────────────────
  PERPS.forEach(p => {
    const total = d.q4_by_perpetrator[p]?.total || 0;
    const key   = p.includes('Community') ? 'militia' : p.includes('Conventional') ? 'conventional' : 'opportunistic';
    setCount(`kpi-${key}`, total);
    setEl(`kpi-${key}-pct`, `${(total/q4.total*100).toFixed(1)}%`);
  });

  // ── Perpetrator Donut ─────────────────────────────────────
  const perpTotals = PERPS.map(p => d.q4_by_perpetrator[p]?.total || 0);
  Plotly.newPlot('chart-perp-donut', [
    donutTrace(PERPS.map(pShort), perpTotals, PERPS.map(pColor), 0.52)
  ], {
    ...pieLayout(310),
    annotations:[{
      text:`<b>${fmt(q4.total)}</b><br><span style="font-size:10px;color:${C.textMuted}">Victims</span>`,
      x:0.5,y:0.5,showarrow:false,font:{color:C.text}
    }]
  }, plotlyConfig);

  // ── Violation grouped by perpetrator ─────────────────────
  const pvGroupedTraces = vKeys.map((v,i) => ({
    type:'bar', name: vLabels[i],
    x: PERPS.map(pShort),
    y: PERPS.map(p => d.q4_by_perpetrator[p]?.[v] || 0),
    marker:{color:[C.killed,C.injured,C.abducted,C.crsv][i]},
    hovertemplate:`<b>${vLabels[i]}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-perp-violation-grouped', pvGroupedTraces, {
    ...baseLayout({barmode:'group', height:310}),
    margin:{t:20,r:12,b:90,l:55},
    xaxis:{tickangle:-20,tickfont:{size:10}},
    legend:{orientation:'h',x:0,y:-0.38,font:{size:10}},
  }, plotlyConfig);

  // ── Violation % per perpetrator (100% stacked) ────────────
  const pvPctTraces = vKeys.map((v,i) => ({
    type:'bar', name: vLabels[i],
    x: PERPS.map(pShort),
    y: PERPS.map(p => {
      const tot = d.q4_by_perpetrator[p]?.total || 1;
      return +((d.q4_by_perpetrator[p]?.[v]||0)/tot*100).toFixed(1);
    }),
    marker:{color:[C.killed,C.injured,C.abducted,C.crsv][i]},
    hovertemplate:`<b>${vLabels[i]}</b><br>%{x}: %{y:.1f}%<extra></extra>`,
  }));
  Plotly.newPlot('chart-perp-violation-pct', pvPctTraces, {
    ...baseLayout({barmode:'stack', height:310}),
    yaxis:{...baseLayout().yaxis, ticksuffix:'%'},
    margin:{t:20,r:12,b:90,l:55},
    xaxis:{tickangle:-20,tickfont:{size:10}},
    legend:{orientation:'h',x:0,y:-0.38,font:{size:10}},
  }, plotlyConfig);

  // ── State stacked by perpetrator ─────────────────────────
  const sts = sortedStates();
  const spTraces = PERPS.map(p => ({
    type:'bar', name: pShort(p),
    y: sts,
    x: sts.map(s => d.q4_by_state[s]?.by_perpetrator?.[p] || 0),
    orientation:'h',
    marker:{color:pColor(p)},
    hovertemplate:`<b>${pShort(p)}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-state-perp-stacked', spTraces, {
    ...baseLayout({barmode:'stack', height:400}),
    margin:{t:20,r:20,b:40,l:175},
    yaxis:{automargin:true,tickfont:{size:11}},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:10}},
  }, plotlyConfig);

  // ── State × Perpetrator Heatmap ───────────────────────────
  const heatZ = PERPS.map(p => sts.map(s => d.q4_by_state[s]?.by_perpetrator?.[p] || 0));
  Plotly.newPlot('chart-state-perp-heatmap', [{
    type:'heatmap',
    z: heatZ,
    x: sts,
    y: PERPS.map(pShort),
    colorscale:[
      [0,'rgba(6,11,24,1)'],[0.3,'rgba(251,191,36,0.4)'],
      [0.7,'rgba(251,146,60,0.7)'],[1,'rgba(244,63,94,1)']
    ],
    text: heatZ.map(row => row.map(v => v > 0 ? fmt(v) : '')),
    texttemplate:'%{text}',
    textfont:{size:10,color:'#fff'},
    showscale:true,
    colorbar:{tickfont:{color:C.textMuted,size:10},outlinecolor:'rgba(0,0,0,0)'},
    hovertemplate:'<b>%{y}</b><br>%{x}: %{z:,}<extra></extra>',
  }], {
    ...baseLayout({height:220}),
    margin:{t:20,r:60,b:100,l:165},
    xaxis:{...baseLayout().xaxis,tickangle:-35,tickfont:{size:10},gridcolor:'rgba(0,0,0,0)'},
    yaxis:{...baseLayout().yaxis,gridcolor:'rgba(0,0,0,0)',automargin:true,tickfont:{size:11}},
  }, plotlyConfig);

  // ── Treemap ───────────────────────────────────────────────
  const tmIds     = ['South Sudan'];
  const tmLabels  = ['South Sudan'];
  const tmParents = [''];
  const tmValues  = [q4.total];
  const tmColors  = [C.accent];

  PERPS.forEach(p => {
    const pId = pShort(p);
    tmIds.push(pId); tmLabels.push(pShort(p));
    tmParents.push('South Sudan');
    tmValues.push(d.q4_by_perpetrator[p]?.total || 0);
    tmColors.push(pColor(p));

    sts.forEach(s => {
      const v = d.q4_by_state[s]?.by_perpetrator?.[p] || 0;
      if (v > 0) {
        tmIds.push(`${pId}-${s}`);
        tmLabels.push(s);
        tmParents.push(pId);
        tmValues.push(v);
        tmColors.push(stColor(s));
      }
    });
  });

  Plotly.newPlot('chart-treemap', [{
    type:'treemap',
    ids: tmIds,
    labels: tmLabels,
    parents: tmParents,
    values: tmValues,
    branchvalues:'total',
    marker:{colors: tmColors, line:{color:C.bg, width:2}},
    texttemplate:'<b>%{label}</b><br>%{value:,}',
    textfont:{size:12, color:'#fff'},
    hovertemplate:'<b>%{label}</b><br>Victims: %{value:,}<br>%{percentRoot:.1%} of total<extra></extra>',
  }], {
    ...baseLayout({height:420}),
    margin:{t:20,r:10,b:10,l:10},
  }, plotlyConfig);

  // ── Quarterly grouped ─────────────────────────────────────
  const pqTraces = PERPS.map(p => ({
    type:'bar', name:pShort(p),
    x: QUARTERS,
    y: QUARTERS.map(q => d.quarterly_by_perpetrator[q][p] || 0),
    marker:{color:pColor(p)},
    hovertemplate:`<b>${pShort(p)}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-perp-quarterly-grouped', pqTraces, {
    ...baseLayout({barmode:'group', height:300}),
    margin:{t:20,r:16,b:50,l:55},
    legend:{orientation:'h',x:0,y:-0.28,font:{size:10}},
  }, plotlyConfig);

  // ── Quarterly % stacked area ──────────────────────────────
  const pqPctTraces = PERPS.map(p => ({
    type:'scatter', mode:'lines', stackgroup:'one', groupnorm:'percent',
    name:pShort(p),
    x: QUARTERS,
    y: QUARTERS.map(q => d.quarterly_by_perpetrator[q][p] || 0),
    line:{color:pColor(p), width:1.5},
    fillcolor: pColor(p)+'44',
    hovertemplate:`<b>${pShort(p)}</b><br>%{x}: %{stackedpercent:.1f}%<extra></extra>`,
  }));
  Plotly.newPlot('chart-perp-quarterly-pct', pqPctTraces, {
    ...baseLayout({height:300}),
    yaxis:{...baseLayout().yaxis,ticksuffix:'%'},
    margin:{t:20,r:16,b:50,l:55},
    legend:{orientation:'h',x:0,y:-0.28,font:{size:10}},
  }, plotlyConfig);

  // ── Top states per perpetrator (3 separate charts) ────────
  const perpChartIds = ['chart-militia-states','chart-conventional-states','chart-opportunistic-states'];
  PERPS.forEach((p, pi) => {
    const byState = sts.map(s => ({ state:s, val: d.q4_by_state[s]?.by_perpetrator?.[p] || 0 }))
      .sort((a,b) => b.val - a.val).slice(0, 7);
    Plotly.newPlot(perpChartIds[pi], [{
      type:'bar', orientation:'h',
      y: byState.map(r=>r.state),
      x: byState.map(r=>r.val),
      marker:{color: byState.map(r=>stColor(r.state)), opacity:0.85},
      text: byState.map(r=>fmt(r.val)),
      textposition:'outside',
      hovertemplate:`<b>%{y}</b><br>${pShort(p)}: %{x:,}<extra></extra>`,
    }], {
      ...baseLayout({height:280}),
      margin:{t:10,r:50,b:30,l:150},
      yaxis:{automargin:true,tickfont:{size:10}},
      xaxis:{gridcolor:'rgba(99,132,200,0.1)'},
    }, plotlyConfig);
  });

  // ── Gender by perpetrator ─────────────────────────────────
  const pgTraces = gKeys.map((k,i) => ({
    type:'bar', name:gLabels[i],
    x: PERPS.map(pShort),
    y: PERPS.map(p => d.q4_by_perpetrator[p]?.gender?.[k] || 0),
    marker:{color:gCols[i]},
    hovertemplate:`<b>${gLabels[i]}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-perp-gender', pgTraces, {
    ...baseLayout({barmode:'group', height:300}),
    margin:{t:20,r:12,b:90,l:55},
    xaxis:{tickangle:-15,tickfont:{size:10}},
    legend:{orientation:'h',x:0,y:-0.38,font:{size:10}},
  }, plotlyConfig);

  // ── Women + Children % by perpetrator ────────────────────
  const vulnData = PERPS.map(p => {
    const pd = d.q4_by_perpetrator[p];
    if(!pd) return {p,pct:0};
    const wc = (pd.gender?.female||0)+(pd.gender?.boys||0)+(pd.gender?.girls||0);
    return {p, pct: pd.total ? +(wc/pd.total*100).toFixed(1) : 0};
  });
  Plotly.newPlot('chart-perp-vulnerable', [{
    type:'bar',
    x: vulnData.map(r=>pShort(r.p)),
    y: vulnData.map(r=>r.pct),
    marker:{
      color: vulnData.map(r=>r.p).map(pColor),
      opacity:0.85,
    },
    text: vulnData.map(r=>`${r.pct}%`),
    textposition:'outside',
    hovertemplate:`<b>%{x}</b><br>Women + Children: %{y:.1f}%<extra></extra>`,
  }], {
    ...baseLayout({height:300}),
    yaxis:{...baseLayout().yaxis,ticksuffix:'%',range:[0,100]},
    margin:{t:20,r:20,b:90,l:55},
    xaxis:{tickangle:-15,tickfont:{size:10}},
  }, plotlyConfig);

  // ── Insights ──────────────────────────────────────────────
  const topPerp = PERPS.reduce((a,b)=>(d.q4_by_perpetrator[a]?.total||0)>(d.q4_by_perpetrator[b]?.total||0)?a:b);
  const topPerpData = d.q4_by_perpetrator[topPerp] || {};
  const topPerpPct  = (topPerpData.total/q4.total*100).toFixed(1);
  const topPerpKillPct = topPerpData.total ? (topPerpData.killed/topPerpData.total*100).toFixed(1) : '—';

  setEl('insight-perp-1', `<ul class="insight-list">
    <li><strong class="highlight">${pShort(topPerp)}</strong> are responsible for <strong class="highlight">${topPerpPct}%</strong> of all Q4 2025 civilian casualties (${fmt(topPerpData.total)} victims).</li>
    <li>Within this group, <strong class="highlight">${topPerpKillPct}%</strong> of their victims were killed — the most lethal form of harm.</li>
    <li>Q4 saw a ${changePct(d.quarterly_by_perpetrator['Q4'][topPerp], d.quarterly_by_perpetrator['Q3'][topPerp])} change in victims attributed to ${pShort(topPerp)} vs Q3.</li>
    <li>Warrap and Lakes states are consistently the most affected by community militia violence.</li>
  </ul>`);

  const convData = d.q4_by_perpetrator['Conventional Parties'] || {};
  const convTopState = sts.sort((a,b)=>(d.q4_by_state[b]?.by_perpetrator?.['Conventional Parties']||0)-(d.q4_by_state[a]?.by_perpetrator?.['Conventional Parties']||0))[0];
  setEl('insight-perp-2', `<ul class="insight-list">
    <li>Conventional parties to the armed conflict caused <strong class="highlight">${fmt(convData.total||0)} victims</strong> in Q4 (${((convData.total||0)/q4.total*100).toFixed(1)}% of total), primarily in <strong class="highlight">${convTopState}</strong>.</li>
    <li>CRSV by conventional parties: <strong class="highlight">${fmt(convData.crsv||0)}</strong> victims — primarily perpetrated by government security forces.</li>
    <li>Unidentified/opportunistic elements accounted for <strong class="highlight">${fmt(d.q4_by_perpetrator['Unidentified/Opportunistic']?.total||0)}</strong> victims — likely underreported due to attribution challenges.</li>
    <li>Across all quarters, community militias consistently represent the largest share of civilian harm.</li>
  </ul>`);

});
