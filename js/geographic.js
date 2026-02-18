/* ============================================================
   UNMISS HRD – Geographic Analysis Page Charts
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

  const sts     = sortedStates();
  const counties = topCounties(20);
  const payams   = topPayams(20);

  // ── KPIs ──────────────────────────────────────────────────
  const topState = sts[0];
  const topStateData = d.q4_by_state[topState] || {};
  const topCountyEntry = counties[0];
  const topPayamEntry  = payams[0];

  setEl('kpi-top-state', topState);
  setEl('kpi-top-state-sub', `${fmt(topStateData.total||0)} victims · ${((topStateData.total||0)/q4.total*100).toFixed(1)}% of national`);
  setEl('kpi-top-county', topCountyEntry?.[0] || '—');
  setEl('kpi-top-county-sub', topCountyEntry ? `${fmt(topCountyEntry[1].total)} victims · ${topCountyEntry[1].state}` : '');
  setEl('kpi-top-payam', topPayamEntry?.[0] || '—');
  setEl('kpi-top-payam-sub', topPayamEntry ? `${fmt(topPayamEntry[1].total)} victims · ${topPayamEntry[1].county}` : '');
  setCount('kpi-counties', Object.keys(d.q4_by_county).length);
  setCount('kpi-payams',   Object.keys(d.q4_by_payam).length);

  // ── State total horizontal bar ────────────────────────────
  Plotly.newPlot('chart-state-total', [{
    type:'bar', orientation:'h',
    y: sts,
    x: sts.map(s => d.q4_by_state[s]?.total || 0),
    marker:{
      color: sts.map(s => stColor(s)),
      opacity: 0.85,
    },
    text: sts.map(s => fmt(d.q4_by_state[s]?.total||0)),
    textposition:'outside',
    hovertemplate:'<b>%{y}</b><br>Victims: %{x:,}<extra></extra>',
  }], {
    ...baseLayout({height:380}),
    margin:{t:20,r:60,b:40,l:175},
    yaxis:{automargin:true, tickfont:{size:11}},
    xaxis:{gridcolor:'rgba(99,132,200,0.1)'},
  }, plotlyConfig);

  // ── State % donut ─────────────────────────────────────────
  Plotly.newPlot('chart-state-pct', [
    donutTrace(sts, sts.map(s=>d.q4_by_state[s]?.total||0), sts.map(stColor), 0.45)
  ], {
    ...pieLayout(380),
    legend:{orientation:'v',x:1.02,y:0.5,font:{size:10}},
  }, plotlyConfig);

  // ── State × Violation stacked ─────────────────────────────
  const svTraces = vKeys.map((v,i) => ({
    type:'bar', name:vLabels[i],
    y: sts,
    x: sts.map(s => d.q4_by_state[s]?.[v] || 0),
    orientation:'h',
    marker:{color:[C.killed,C.injured,C.abducted,C.crsv][i]},
    hovertemplate:`<b>${vLabels[i]}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-state-violation', svTraces, {
    ...baseLayout({barmode:'stack', height:400}),
    margin:{t:20,r:20,b:40,l:175},
    yaxis:{automargin:true, tickfont:{size:11}},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:10}},
  }, plotlyConfig);

  // ── State × Perpetrator stacked ───────────────────────────
  const spTraces = PERPS.map(p => ({
    type:'bar', name:pShort(p),
    y: sts,
    x: sts.map(s => d.q4_by_state[s]?.by_perpetrator?.[p] || 0),
    orientation:'h',
    marker:{color:pColor(p)},
    hovertemplate:`<b>${pShort(p)}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-state-perpetrator', spTraces, {
    ...baseLayout({barmode:'stack', height:400}),
    margin:{t:20,r:20,b:40,l:175},
    yaxis:{automargin:true, tickfont:{size:11}},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:10}},
  }, plotlyConfig);

  // ── State × Gender stacked ────────────────────────────────
  const sgTraces = gKeys.map((k,i) => ({
    type:'bar', name:gLabels[i],
    y: sts,
    x: sts.map(s => d.q4_by_state[s]?.gender?.[k] || 0),
    orientation:'h',
    marker:{color:gCols[i]},
    hovertemplate:`<b>${gLabels[i]}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-state-gender', sgTraces, {
    ...baseLayout({barmode:'stack', height:400}),
    margin:{t:20,r:20,b:40,l:175},
    yaxis:{automargin:true, tickfont:{size:11}},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:10}},
  }, plotlyConfig);

  // ── State quarterly line — top 5 ─────────────────────────
  const top5 = sts.slice(0, 5);
  const sqLineTraces = top5.map(s => ({
    type:'scatter', mode:'lines+markers', name:s,
    x: QUARTERS,
    y: QUARTERS.map(q => d.quarterly_by_state[q]?.[s] || 0),
    line:{color:stColor(s), width:2.5},
    marker:{size:7, color:stColor(s)},
    hovertemplate:`<b>${s}</b><br>%{x}: %{y:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-state-quarterly-line', sqLineTraces, {
    ...baseLayout({height:400}),
    margin:{t:20,r:20,b:50,l:55},
    legend:{orientation:'h',x:0,y:-0.25,font:{size:10}},
  }, plotlyConfig);

  // ── State × Quarter heatmap ───────────────────────────────
  const heatZ = sts.map(s => QUARTERS.map(q => d.quarterly_by_state[q]?.[s] || 0));
  Plotly.newPlot('chart-state-quarter-heatmap', [{
    type:'heatmap',
    z: heatZ,
    x: QUARTERS,
    y: sts,
    colorscale:[
      [0,'rgba(6,11,24,1)'],[0.25,'rgba(56,189,248,0.3)'],
      [0.6,'rgba(251,191,36,0.6)'],[1,'rgba(244,63,94,1)']
    ],
    text: heatZ.map(row => row.map(v => v > 0 ? fmt(v) : '')),
    texttemplate:'%{text}',
    textfont:{size:12,color:'#fff'},
    showscale:true,
    colorbar:{tickfont:{color:C.textMuted,size:10},outlinecolor:'rgba(0,0,0,0)'},
    hovertemplate:'<b>%{y}</b><br>%{x}: %{z:,} victims<extra></extra>',
  }], {
    ...baseLayout({height:360}),
    margin:{t:20,r:70,b:50,l:185},
    xaxis:{...baseLayout().xaxis, gridcolor:'rgba(0,0,0,0)'},
    yaxis:{...baseLayout().yaxis, gridcolor:'rgba(0,0,0,0)', automargin:true, tickfont:{size:11}},
  }, plotlyConfig);

  // ── Top 15 counties bar ───────────────────────────────────
  Plotly.newPlot('chart-top-counties', [{
    type:'bar', orientation:'h',
    y: counties.map(([n])=>n),
    x: counties.map(([,v])=>v.total),
    marker:{color: counties.map(([,v])=>stColor(v.state)), opacity:0.85},
    text: counties.map(([,v])=>fmt(v.total)),
    textposition:'outside',
    hovertemplate:'<b>%{y}</b><br>Victims: %{x:,}<extra></extra>',
  }], {
    ...baseLayout({height:460}),
    margin:{t:20,r:60,b:30,l:145},
    yaxis:{automargin:true, tickfont:{size:10}},
    xaxis:{gridcolor:'rgba(99,132,200,0.1)'},
  }, plotlyConfig);

  // ── County violation breakdown (top 10) ───────────────────
  const top10c = topCounties(10);
  const cvTraces = vKeys.map((v,i) => ({
    type:'bar', name:vLabels[i],
    y: top10c.map(([n])=>n),
    x: top10c.map(([,d])=>d[v]||0),
    orientation:'h',
    marker:{color:[C.killed,C.injured,C.abducted,C.crsv][i]},
    hovertemplate:`<b>${vLabels[i]}</b><br>%{y}: %{x:,}<extra></extra>`,
  }));
  Plotly.newPlot('chart-county-violation', cvTraces, {
    ...baseLayout({barmode:'stack', height:360}),
    margin:{t:20,r:20,b:40,l:145},
    yaxis:{automargin:true, tickfont:{size:10}},
    legend:{orientation:'h',x:0,y:-0.12,font:{size:10}},
  }, plotlyConfig);

  // ── Top payams bar ────────────────────────────────────────
  Plotly.newPlot('chart-top-payams', [{
    type:'bar', orientation:'h',
    y: payams.map(([n])=>n),
    x: payams.map(([,v])=>v.total),
    marker:{color: payams.map(([,v])=>stColor(v.state)), opacity:0.85},
    text: payams.map(([,v])=>fmt(v.total)),
    textposition:'outside',
    hovertemplate:'<b>%{y}</b><br>%{customdata}<br>Victims: %{x:,}<extra></extra>',
    customdata: payams.map(([,v])=>`${v.county}, ${v.state}`),
  }], {
    ...baseLayout({height:480}),
    margin:{t:20,r:60,b:30,l:155},
    yaxis:{automargin:true, tickfont:{size:10}},
    xaxis:{gridcolor:'rgba(99,132,200,0.1)'},
  }, plotlyConfig);

  // ── Data table ────────────────────────────────────────────
  const tbl = document.getElementById('county-table');
  if(tbl) {
    tbl.innerHTML = `<thead><tr>
      <th class="rank">#</th><th>County</th><th>State</th>
      <th>Total</th><th>Killed</th><th>Injured</th><th>Abducted</th><th>CRSV</th>
    </tr></thead>
    <tbody>${counties.map(([name,v],i) => `<tr>
      <td class="rank">${i+1}</td>
      <td><span style="color:${stColor(v.state)};font-weight:600">${name}</span></td>
      <td style="color:${C.textMuted}">${v.state}</td>
      <td class="total-col">${fmt(v.total)}</td>
      <td style="color:${C.killed}">${fmt(v.killed||0)}</td>
      <td style="color:${C.injured}">${fmt(v.injured||0)}</td>
      <td style="color:${C.abducted}">${fmt(v.abducted||0)}</td>
      <td style="color:${C.crsv}">${fmt(v.crsv||0)}</td>
    </tr>`).join('')}</tbody>`;
  }

  // ── County bubble chart ───────────────────────────────────
  const allCounties = Object.entries(d.q4_by_county)
    .filter(([,v])=>v.total>0)
    .sort((a,b)=>b[1].total-a[1].total);

  Plotly.newPlot('chart-county-bubble', [{
    type:'scatter',
    mode:'markers+text',
    x: allCounties.map(([,v],i)=>i),
    y: allCounties.map(([,v])=>v.killed||0),
    text: allCounties.slice(0,12).map(([n])=>n).concat(allCounties.slice(12).map(()=>'')),
    textposition:'top center',
    textfont:{size:9, color:C.textMuted},
    marker:{
      size: allCounties.map(([,v])=>Math.sqrt(v.total)*4+6),
      color: allCounties.map(([,v])=>stColor(v.state)),
      opacity: 0.75,
      line:{color:C.bg, width:1},
    },
    customdata: allCounties.map(([n,v])=>[n, v.state, v.total, v.injured||0, v.abducted||0, v.crsv||0]),
    hovertemplate:`<b>%{customdata[0]}</b><br>State: %{customdata[1]}<br>Total: %{customdata[2]:,}<br>Killed: %{y:,}<br>Injured: %{customdata[3]:,}<extra></extra>`,
  }], {
    ...baseLayout({height:380}),
    xaxis:{...baseLayout().xaxis, title:'County rank (by total)', showgrid:false, showticklabels:false},
    yaxis:{...baseLayout().yaxis, title:'Killed'},
    margin:{t:20,r:20,b:50,l:60},
  }, plotlyConfig);

  // ── Insights ──────────────────────────────────────────────
  const st1 = sts[0], st2 = sts[1];
  const st1pct = ((d.q4_by_state[st1]?.total||0)/q4.total*100).toFixed(1);
  const st2pct = ((d.q4_by_state[st2]?.total||0)/q4.total*100).toFixed(1);

  setEl('insight-geo-1', `<ul class="insight-list">
    <li><strong class="highlight">${st1}</strong> is the most affected state with <strong class="highlight">${fmt(d.q4_by_state[st1]?.total||0)} victims</strong> — ${st1pct}% of national Q4 total.</li>
    <li><strong class="highlight">${st2}</strong> is second most affected with ${fmt(d.q4_by_state[st2]?.total||0)} victims (${st2pct}% of national).</li>
    <li>Top county: <strong class="highlight">${counties[0]?.[0]||'—'}</strong> with ${fmt(counties[0]?.[1]?.total||0)} victims in ${counties[0]?.[1]?.state||'—'}.</li>
    <li>Top payam: <strong class="highlight">${payams[0]?.[0]||'—'}</strong> with ${fmt(payams[0]?.[1]?.total||0)} victims in ${payams[0]?.[1]?.county||'—'}.</li>
  </ul>`);

  const q3st1 = d.quarterly_by_state['Q3']?.[st1] || 0;
  const st1chg = changePct(d.q4_by_state[st1]?.total||0, q3st1);
  setEl('insight-geo-2', `<ul class="insight-list">
    <li>${st1} saw a <strong class="highlight">${st1chg}</strong> change in victims from Q3 to Q4 — ${q3st1>0?`from ${fmt(q3st1)} to ${fmt(d.q4_by_state[st1]?.total||0)}`:'new data in Q4'}.</li>
    <li>Q4 documented casualties across <strong class="highlight">${Object.keys(d.q4_by_county).length} counties</strong> and <strong class="highlight">${Object.keys(d.q4_by_payam).length} payams</strong>.</li>
    <li>Northern Bahr el Ghazal has no Q4 data — an absence that may reflect access constraints rather than absence of violence.</li>
    <li>The five most affected states account for <strong class="highlight">${(sts.slice(0,5).reduce((s,st)=>s+(d.q4_by_state[st]?.total||0),0)/q4.total*100).toFixed(1)}%</strong> of all Q4 casualties.</li>
  </ul>`);

});
