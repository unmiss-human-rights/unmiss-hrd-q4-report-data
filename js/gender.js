/* ============================================================
   UNMISS HRD – Gender Analysis Page Charts
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const d  = D;
  const q4 = d.q4;
  const g  = q4.gender;
  const total = q4.total;

  const setCount = (id, n) => { const e = document.getElementById(id); if(e){e.dataset.count=n; animateCounter(e,n);} };
  const setEl    = (id, v)  => { const e = document.getElementById(id); if(e) e.innerHTML = v; };

  // ── KPIs ──────────────────────────────────────────────────
  setCount('kpi-male',     g.male);
  setCount('kpi-female',   g.female);
  setCount('kpi-boys',     g.boys);
  setCount('kpi-girls',    g.girls);
  setCount('kpi-children', g.boys + g.girls);

  setEl('kpi-male-pct',     `${(g.male/total*100).toFixed(1)}%`);
  setEl('kpi-female-pct',   `${(g.female/total*100).toFixed(1)}%`);
  setEl('kpi-boys-pct',     `${(g.boys/total*100).toFixed(1)}%`);
  setEl('kpi-girls-pct',    `${(g.girls/total*100).toFixed(1)}%`);
  setEl('kpi-children-pct', `${((g.boys+g.girls)/total*100).toFixed(1)}%`);

  // ── Overall Gender Pie ────────────────────────────────────
  Plotly.newPlot('chart-gender-pie', [
    donutTrace(
      ['Men','Women','Boys','Girls'],
      [g.male, g.female, g.boys, g.girls],
      [C.male, C.female, C.boys, C.girls], 0.5
    )
  ], {
    ...pieLayout(310),
    annotations:[{
      text:`<b>${fmt(total)}</b><br><span style="font-size:11px;color:${C.textMuted}">Total</span>`,
      x:0.5,y:0.5,showarrow:false,font:{color:C.text}
    }]
  }, plotlyConfig);

  // ── Gender within each violation (grouped bar) ────────────
  const vKeys   = ['killed','injured','abducted','crsv'];
  const vLabels = ['Killed','Injured','Abducted','CRSV'];
  const gKeys   = ['male','female','boys','girls'];
  const gLabels = ['Men','Women','Boys','Girls'];
  const gCols   = [C.male, C.female, C.boys, C.girls];

  const gByVTraces = gKeys.map((k,i) => ({
    type:'bar', name: gLabels[i],
    x: vLabels,
    y: vKeys.map(v => q4.by_violation_gender[v]?.[k] || 0),
    marker:{color: gCols[i]},
    hovertemplate:`<b>${gLabels[i]}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-gender-by-violation', gByVTraces, {
    ...baseLayout({barmode:'group', height:310}),
    margin:{t:20,r:12,b:50,l:50},
    legend:{orientation:'h',x:0,y:-0.28,font:{size:10}},
  }, plotlyConfig);

  // ── Leading harm per gender (horizontal bar each gender) ──
  const harmPerGender = gKeys.map((k,i) => {
    const vals = vKeys.map(v => q4.by_violation_gender[v]?.[k] || 0);
    const gTotal = vals.reduce((a,b)=>a+b,0);
    return {
      type:'bar', name: gLabels[i],
      y: vLabels,
      x: vals.map(v => gTotal ? +(v/gTotal*100).toFixed(1) : 0),
      orientation:'h',
      marker:{color: vKeys.map(v=>vColorByKey(v))},
      showlegend: false,
      text: vals.map(v => `${fmt(v)}`),
      textposition:'outside',
      hovertemplate:`<b>${gLabels[i]}</b><br>%{y}: %{x:.1f}%<extra></extra>`,
    };
  });
  // show one subplot-like view with facets using annotations
  // simplified: show for all genders stacked with % values
  const harmGenderTraces = gKeys.map((k,i) => ({
    type:'bar', name: gLabels[i],
    x: vLabels,
    y: vKeys.map(v => {
      const tot = gKeys.reduce((s,gk) => s + (q4.by_violation_gender[v]?.[gk]||0), 0);
      return tot ? +(( q4.by_violation_gender[v]?.[k]||0)/tot*100).toFixed(1) : 0;
    }),
    marker:{color: gCols[i]},
    hovertemplate:`<b>${gLabels[i]}</b><br>%{x}: %{y:.1f}%<extra></extra>`,
  }));
  Plotly.newPlot('chart-harm-by-gender', harmGenderTraces, {
    ...baseLayout({barmode:'stack', height:310}),
    yaxis:{...baseLayout().yaxis, title:'% share', ticksuffix:'%'},
    margin:{t:20,r:12,b:50,l:55},
    legend:{orientation:'h',x:0,y:-0.28,font:{size:10}},
  }, plotlyConfig);

  // ── Violation profile per gender — heatmap ────────────────
  const heatZ = gKeys.map(k => {
    const tot = vKeys.reduce((s,v) => s+(q4.by_violation_gender[v]?.[k]||0), 0);
    return vKeys.map(v => tot ? +(( q4.by_violation_gender[v]?.[k]||0)/tot*100).toFixed(1) : 0);
  });
  const heatColors = [
    [0.0, 'rgba(6,11,24,1)'],
    [0.3, 'rgba(56,189,248,0.3)'],
    [0.6, 'rgba(129,140,248,0.7)'],
    [1.0, 'rgba(244,63,94,1)'],
  ];
  Plotly.newPlot('chart-gender-violation-heatmap', [{
    type:'heatmap',
    z: heatZ,
    x: vLabels,
    y: gLabels,
    colorscale: heatColors,
    text: heatZ.map(row => row.map(v => `${v}%`)),
    texttemplate:'%{text}',
    textfont:{size:13, color:'#fff'},
    showscale: true,
    colorbar:{
      tickfont:{color:C.textMuted, size:10},
      outlinecolor:'rgba(0,0,0,0)',
      ticksuffix:'%',
    },
    hovertemplate:'<b>%{y}</b><br>%{x}: %{z:.1f}%<extra></extra>',
  }], {
    ...baseLayout({height:300}),
    margin:{t:20,r:60,b:50,l:70},
    xaxis:{...baseLayout().xaxis, gridcolor:'rgba(0,0,0,0)'},
    yaxis:{...baseLayout().yaxis, gridcolor:'rgba(0,0,0,0)'},
  }, plotlyConfig);

  // ── Radar chart ───────────────────────────────────────────
  const radarTraces = gKeys.map((k,i) => {
    const tot = vKeys.reduce((s,v) => s+(q4.by_violation_gender[v]?.[k]||0), 0);
    const vals = vKeys.map(v => tot ? +(( q4.by_violation_gender[v]?.[k]||0)/tot*100).toFixed(1) : 0);
    return {
      type:'scatterpolar',
      name: gLabels[i],
      r: [...vals, vals[0]],
      theta: [...vLabels, vLabels[0]],
      fill:'toself',
      line:{color: gCols[i], width:2},
      fillcolor: gCols[i]+'22',
      hovertemplate:`<b>${gLabels[i]}</b><br>%{theta}: %{r:.1f}%<extra></extra>`,
    };
  });
  Plotly.newPlot('chart-gender-radar', radarTraces, {
    ...baseLayout({height:300}),
    polar:{
      bgcolor:'rgba(0,0,0,0)',
      radialaxis:{visible:true, color:C.textMuted, gridcolor:'rgba(99,132,200,0.15)', ticksuffix:'%', tickfont:{size:9}},
      angularaxis:{color:C.textMuted, gridcolor:'rgba(99,132,200,0.15)'},
    },
    margin:{t:30,r:40,b:30,l:40},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:11}},
  }, plotlyConfig);

  // ── Gender by State stacked ───────────────────────────────
  const sts = sortedStates();
  const sgTraces = gKeys.map((k,i) => ({
    type:'bar', name:gLabels[i],
    y: sts,
    x: sts.map(s => d.q4_by_state[s]?.gender?.[k] || 0),
    orientation:'h',
    marker:{color:gCols[i]},
    hovertemplate:`<b>${gLabels[i]}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-state-gender-stacked', sgTraces, {
    ...baseLayout({barmode:'stack', height:380}),
    margin:{t:20,r:16,b:40,l:175},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:10}},
    yaxis:{automargin:true, tickfont:{size:11}},
  }, plotlyConfig);

  // ── Women & Children by state ─────────────────────────────
  const wcTraces = [
    { key:'female', label:'Women', col:C.female },
    { key:'boys',   label:'Boys',  col:C.boys   },
    { key:'girls',  label:'Girls', col:C.girls  },
  ].map(({key,label,col}) => ({
    type:'bar', name:label,
    y: sts,
    x: sts.map(s => d.q4_by_state[s]?.gender?.[key] || 0),
    orientation:'h',
    marker:{color:col},
    hovertemplate:`<b>${label}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-state-women-children', wcTraces, {
    ...baseLayout({barmode:'stack', height:380}),
    margin:{t:20,r:16,b:40,l:175},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:10}},
    yaxis:{automargin:true, tickfont:{size:11}},
  }, plotlyConfig);

  // ── Perpetrator × Gender stacked ─────────────────────────
  const perpLabels = PERPS.map(pShort);
  const pgTraces = gKeys.map((k,i) => ({
    type:'bar', name:gLabels[i],
    x: perpLabels,
    y: PERPS.map(p => d.q4_by_perpetrator[p]?.gender?.[k] || 0),
    marker:{color:gCols[i]},
    hovertemplate:`<b>${gLabels[i]}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-perp-gender-stacked', pgTraces, {
    ...baseLayout({barmode:'stack', height:310}),
    margin:{t:20,r:12,b:80,l:55},
    xaxis:{tickangle:-20,tickfont:{size:10}},
    legend:{orientation:'h',x:0,y:-0.35,font:{size:10}},
  }, plotlyConfig);

  // ── Perpetrator × Violation split by gender ───────────────
  // Show % of female+children for each perp group per violation
  const pvgTraces = PERPS.map((p,pi) => {
    const pd = d.q4_by_perpetrator[p];
    if(!pd) return null;
    return {
      type:'bar', name: pShort(p),
      x: vLabels,
      y: vKeys.map(v => {
        const tot = (pd.by_violation_gender?.[v]?.male||0) + (pd.by_violation_gender?.[v]?.female||0)
                  + (pd.by_violation_gender?.[v]?.boys||0) + (pd.by_violation_gender?.[v]?.girls||0);
        const wc  = (pd.by_violation_gender?.[v]?.female||0) + (pd.by_violation_gender?.[v]?.girls||0);
        return tot ? +(wc/tot*100).toFixed(1) : 0;
      }),
      marker:{color: pColor(p)},
      hovertemplate:`<b>${pShort(p)}</b><br>%{x}: %{y:.1f}% women+girls<extra></extra>`,
    };
  }).filter(Boolean);
  Plotly.newPlot('chart-perp-viol-gender', pvgTraces, {
    ...baseLayout({barmode:'group', height:310}),
    yaxis:{...baseLayout().yaxis, title:'% Women + Girls', ticksuffix:'%'},
    margin:{t:20,r:12,b:50,l:60},
    legend:{orientation:'h',x:0,y:-0.28,font:{size:10}},
  }, plotlyConfig);

  // ── Quarterly gender line chart ───────────────────────────
  const qgLineTraces = gKeys.map((k,i) => ({
    type:'scatter', mode:'lines+markers', name:gLabels[i],
    x: QUARTERS,
    y: QUARTERS.map(q => d.quarterly[q].gender[k] || 0),
    line:{color:gCols[i], width:2.5},
    marker:{size:7, color:gCols[i]},
    hovertemplate:`<b>${gLabels[i]}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-quarterly-gender-line', qgLineTraces, {
    ...baseLayout({height:300}),
    margin:{t:20,r:16,b:50,l:55},
    legend:{orientation:'h',x:0,y:-0.28,font:{size:10}},
  }, plotlyConfig);

  // ── Quarterly gender % stacked area ──────────────────────
  const qgPctTraces = gKeys.map((k,i) => ({
    type:'scatter', mode:'lines', stackgroup:'one', groupnorm:'percent',
    name:gLabels[i],
    x: QUARTERS,
    y: QUARTERS.map(q => d.quarterly[q].gender[k] || 0),
    line:{color:gCols[i], width:1.5},
    fillcolor: gCols[i]+'55',
    hovertemplate:`<b>${gLabels[i]}</b><br>%{x}: %{stackedpercent:.1f}%<extra></extra>`,
  }));
  Plotly.newPlot('chart-quarterly-gender-pct', qgPctTraces, {
    ...baseLayout({height:300}),
    yaxis:{...baseLayout().yaxis, ticksuffix:'%'},
    margin:{t:20,r:16,b:50,l:55},
    legend:{orientation:'h',x:0,y:-0.28,font:{size:10}},
  }, plotlyConfig);

  // ── Children: Boys vs Girls by violation ─────────────────
  const childVioTraces = [
    {k:'boys',  label:'Boys',  col:C.boys},
    {k:'girls', label:'Girls', col:C.girls},
  ].map(({k,label,col}) => ({
    type:'bar', name:label,
    x: vLabels,
    y: vKeys.map(v => q4.by_violation_gender[v]?.[k] || 0),
    marker:{color:col},
    hovertemplate:`<b>${label}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-children-violation', childVioTraces, {
    ...baseLayout({barmode:'group', height:280}),
    margin:{t:20,r:12,b:50,l:50},
    legend:{orientation:'h',x:0,y:-0.28,font:{size:10}},
  }, plotlyConfig);

  // ── Children by perpetrator ───────────────────────────────
  const childPerpTraces = [
    {k:'boys',  label:'Boys',  col:C.boys},
    {k:'girls', label:'Girls', col:C.girls},
  ].map(({k,label,col}) => ({
    type:'bar', name:label,
    x: perpLabels,
    y: PERPS.map(p => d.q4_by_perpetrator[p]?.gender?.[k] || 0),
    marker:{color:col},
    hovertemplate:`<b>${label}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-children-perp', childPerpTraces, {
    ...baseLayout({barmode:'stack', height:280}),
    margin:{t:20,r:12,b:80,l:50},
    xaxis:{tickangle:-20, tickfont:{size:10}},
    legend:{orientation:'h',x:0,y:-0.35,font:{size:10}},
  }, plotlyConfig);

  // ── Children by state (top 8) ─────────────────────────────
  const stsSorted = sortedStates();
  const childByState = stsSorted
    .map(s => ({
      state:s,
      boys:  d.q4_by_state[s]?.gender?.boys  || 0,
      girls: d.q4_by_state[s]?.gender?.girls || 0,
    }))
    .sort((a,b) => (b.boys+b.girls)-(a.boys+a.girls))
    .slice(0,8);

  const childStateTraces = [
    {k:'boys',  label:'Boys',  col:C.boys},
    {k:'girls', label:'Girls', col:C.girls},
  ].map(({k,label,col}) => ({
    type:'bar', name:label,
    y: childByState.map(r=>r.state),
    x: childByState.map(r=>r[k]),
    orientation:'h',
    marker:{color:col},
    hovertemplate:`<b>${label}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-children-state', childStateTraces, {
    ...baseLayout({barmode:'stack', height:280}),
    margin:{t:20,r:16,b:30,l:165},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:10}},
    yaxis:{automargin:true},
  }, plotlyConfig);

  // ── Insights ──────────────────────────────────────────────
  const topGender = Object.entries({
    Men:g.male, Women:g.female, Boys:g.boys, Girls:g.girls
  }).sort((a,b)=>b[1]-a[1])[0];
  const womenChildPct = ((g.female+g.boys+g.girls)/total*100).toFixed(1);
  const crsvFemPct = q4.by_violation_gender?.crsv
    ? (((q4.by_violation_gender.crsv.female||0)+(q4.by_violation_gender.crsv.girls||0))/
       Math.max(q4.crsv,1)*100).toFixed(1) : '—';

  document.getElementById('insight-gender-1').innerHTML = `<ul class="insight-list">
    <li><strong class="highlight">${topGender[0]}</strong> are the most affected gender with <strong class="highlight">${fmt(topGender[1])} victims</strong> (${(topGender[1]/total*100).toFixed(1)}% of total).</li>
    <li>Women and children combined represent <strong class="highlight">${womenChildPct}%</strong> of all Q4 victims.</li>
    <li>CRSV disproportionately affects women and girls: <strong class="highlight">${crsvFemPct}%</strong> of CRSV victims are female.</li>
    <li>Killing is the primary form of harm against <strong class="highlight">men</strong>, while women are more often subjected to CRSV.</li>
  </ul>`;

  const crsvGirls = q4.by_violation_gender?.crsv?.girls || 0;
  const abductBoys = q4.by_violation_gender?.abducted?.boys || 0;
  document.getElementById('insight-gender-2').innerHTML = `<ul class="insight-list">
    <li>Among children: <strong class="highlight">abduction</strong> is the leading harm for boys, while <strong class="highlight">CRSV</strong> is disproportionately perpetrated against girls.</li>
    <li>${fmt(crsvGirls)} girls were subjected to CRSV in Q4 — representing a grave protection failure.</li>
    <li>${fmt(abductBoys)} boys were abducted in Q4, often for forced labour or use as combatants.</li>
    <li>Quarterly trends show a <strong class="highlight">${changePct(g.female, d.quarterly['Q3'].gender?.female)}</strong> change in female victims from Q3 to Q4.</li>
  </ul>`;

});
