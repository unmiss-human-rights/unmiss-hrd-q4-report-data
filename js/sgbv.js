/* ============================================================
   UNMISS HRD – SGBV Analysis Page Charts
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const d    = D;
  const s    = d.sgbv;
  const sq4  = s.q4;
  const q4   = d.q4;

  const setCount = (id, n) => { const e = document.getElementById(id); if(e){e.dataset.count=n; animateCounter(e,n);} };
  const setEl    = (id, v) => { const e = document.getElementById(id); if(e) e.innerHTML = v; };

  const annualSGBV = QUARTERS.reduce((sum,q) => sum + (s.quarterly[q]||0), 0);

  // ── KPIs ──────────────────────────────────────────────────
  setCount('kpi-sgbv-q4',    sq4.total);
  setCount('kpi-crsv-q4',    q4.crsv);
  setCount('kpi-sgbv-women', sq4.gender?.female || 0);
  setCount('kpi-sgbv-girls', sq4.gender?.girls  || 0);
  setCount('kpi-sgbv-annual', annualSGBV);

  const q3sgbv = s.quarterly['Q3'] || 0;
  setEl('kpi-sgbv-q4-chg', `${changePct(sq4.total, q3sgbv)} vs Q3`);
  setEl('kpi-sgbv-women-pct', `${sq4.total?((sq4.gender?.female||0)/sq4.total*100).toFixed(1):0}% of SGBV survivors`);
  setEl('kpi-sgbv-girls-pct', `${sq4.total?((sq4.gender?.girls||0)/sq4.total*100).toFixed(1):0}% of SGBV survivors`);

  // ── SGBV vs CRSV donut ────────────────────────────────────
  Plotly.newPlot('chart-sgbv-crsv-donut', [
    donutTrace(['SGBV','CRSV'], [sq4.total, q4.crsv], [C.female, C.crsv], 0.52)
  ], {
    ...pieLayout(290),
    annotations:[{
      text:`<b>${fmt(sq4.total+q4.crsv)}</b><br><span style="font-size:10px;color:${C.textMuted}">Total</span>`,
      x:0.5,y:0.5,showarrow:false,font:{color:C.text}
    }]
  }, plotlyConfig);

  // ── SGBV vs CRSV quarterly ────────────────────────────────
  Plotly.newPlot('chart-sgbv-crsv-quarterly', [
    {
      type:'bar', name:'SGBV',
      x: QUARTERS, y: QUARTERS.map(q => s.quarterly[q]||0),
      marker:{color:C.female},
      hovertemplate:'<b>SGBV</b><br>%{x}: %{y:,}<extra></extra>',
    },
    {
      type:'bar', name:'CRSV',
      x: QUARTERS, y: QUARTERS.map(q => d.crsv_sgbv[q]?.crsv||0),
      marker:{color:C.crsv},
      hovertemplate:'<b>CRSV</b><br>%{x}: %{y:,}<extra></extra>',
    },
  ], {
    ...baseLayout({barmode:'group', height:290}),
    margin:{t:20,r:16,b:50,l:55},
    legend:{orientation:'h',x:0,y:-0.3},
  }, plotlyConfig);

  // ── SGBV gender donut ─────────────────────────────────────
  const sg = sq4.gender || {};
  Plotly.newPlot('chart-sgbv-gender', [
    donutTrace(
      ['Women','Girls','Men','Boys'],
      [sg.female||0, sg.girls||0, sg.male||0, sg.boys||0],
      [C.female, C.girls, C.male, C.boys], 0.52
    )
  ], {
    ...pieLayout(290),
    annotations:[{
      text:`<b>${fmt(sq4.total)}</b><br><span style="font-size:10px;color:${C.textMuted}">Survivors</span>`,
      x:0.5,y:0.5,showarrow:false,font:{color:C.text}
    }]
  }, plotlyConfig);

  // ── SGBV by state ─────────────────────────────────────────
  const sgbvStates = Object.entries(s.q4_by_state)
    .sort((a,b)=>b[1].total-a[1].total);
  const sgbvStateNames = sgbvStates.map(([n])=>n);

  Plotly.newPlot('chart-sgbv-state', [
    {
      type:'bar', orientation:'h',
      y: sgbvStateNames,
      x: sgbvStates.map(([,v])=>v.total),
      marker:{color: sgbvStateNames.map(s=>stColor(s)), opacity:0.85},
      text: sgbvStates.map(([,v])=>fmt(v.total)),
      textposition:'outside',
      hovertemplate:'<b>%{y}</b><br>SGBV: %{x:,}<extra></extra>',
    }
  ], {
    ...baseLayout({height:340}),
    margin:{t:20,r:60,b:30,l:165},
    yaxis:{automargin:true, tickfont:{size:11}},
    xaxis:{gridcolor:'rgba(99,132,200,0.1)'},
  }, plotlyConfig);

  // ── SGBV by perpetrator ───────────────────────────────────
  const sgPerp = PERPS.map(p => s.q4_by_perpetrator[p]||0);
  Plotly.newPlot('chart-sgbv-perp', [
    donutTrace(PERPS.map(pShort), sgPerp, PERPS.map(pColor), 0.5)
  ], {
    ...pieLayout(340),
    legend:{orientation:'v',x:1.02,y:0.5,font:{size:10}},
  }, plotlyConfig);

  // ── CRSV vs SGBV by state (grouped bar) ──────────────────
  const allSts = STATES.filter(s =>
    (d.q4_by_state[s]?.crsv||0) > 0 || (D.sgbv.q4_by_state[s]?.total||0) > 0
  ).sort((a,b) =>
    ((d.q4_by_state[b]?.crsv||0)+(D.sgbv.q4_by_state[b]?.total||0)) -
    ((d.q4_by_state[a]?.crsv||0)+(D.sgbv.q4_by_state[a]?.total||0))
  );
  Plotly.newPlot('chart-state-crsv-sgbv', [
    {
      type:'bar', name:'CRSV',
      x: allSts, y: allSts.map(st=>d.q4_by_state[st]?.crsv||0),
      marker:{color:C.crsv},
      hovertemplate:'<b>CRSV</b><br>%{x}: %{y:,}<extra></extra>',
    },
    {
      type:'bar', name:'SGBV',
      x: allSts, y: allSts.map(st=>D.sgbv.q4_by_state[st]?.total||0),
      marker:{color:C.female},
      hovertemplate:'<b>SGBV</b><br>%{x}: %{y:,}<extra></extra>',
    },
  ], {
    ...baseLayout({barmode:'group', height:320}),
    margin:{t:20,r:20,b:90,l:55},
    xaxis:{tickangle:-30, tickfont:{size:11}},
    legend:{orientation:'h',x:0,y:-0.3},
  }, plotlyConfig);

  // ── Support service mini donuts (helper) ──────────────────
  function serviceMiniPie(containerId, data, label, color) {
    const yes = data?.yes || 0, no = data?.no || 0;
    const total = yes + no || 1;
    Plotly.newPlot(containerId, [
      donutTrace(['Yes','No'], [yes, no], [color, C.bgCard2], 0.6)
    ], {
      ...pieLayout(220),
      annotations:[{
        text:`<b>${(yes/total*100).toFixed(0)}%</b><br><span style="font-size:10px;color:${C.textMuted}">Yes</span>`,
        x:0.5,y:0.5,showarrow:false,font:{color:C.text,size:16}
      }],
      margin:{t:10,r:10,b:30,l:10},
      showlegend:false,
    }, plotlyConfig);
  }

  serviceMiniPie('chart-medical',       sq4.medical_care, 'Medical',       '#22d3ee');
  serviceMiniPie('chart-psychosocial',  sq4.psychosocial, 'Psychosocial',  '#818cf8');
  serviceMiniPie('chart-reported',      sq4.reported,     'Reported',      '#fbbf24');
  serviceMiniPie('chart-arrested',      sq4.arrested,     'Arrested',      '#f43f5e');
  serviceMiniPie('chart-pregnancy',     sq4.pregnancy,    'Pregnancy',     '#f472b6');

  // ── Services all-in-one bar ───────────────────────────────
  const svcLabels = ['Medical Care','Psychosocial','Reported','Arrested','Pregnancy'];
  const svcColors = ['#22d3ee','#818cf8','#fbbf24','#f43f5e','#f472b6'];
  const svcKeys   = ['medical_care','psychosocial','reported','arrested','pregnancy'];
  const svcYes = svcKeys.map(k => sq4[k]?.yes || 0);
  const svcNo  = svcKeys.map(k => sq4[k]?.no  || 0);
  const svcTotal= svcYes.map((y,i) => Math.max(y+svcNo[i],1));
  const svcPct  = svcYes.map((y,i) => +(y/svcTotal[i]*100).toFixed(1));

  Plotly.newPlot('chart-services-bar', [
    {
      type:'bar',
      x: svcLabels,
      y: svcPct,
      marker:{color:svcColors, opacity:0.85},
      text: svcPct.map(v=>`${v}%`),
      textposition:'outside',
      hovertemplate:'<b>%{x}</b><br>%{y:.1f}% yes<extra></extra>',
    }
  ], {
    ...baseLayout({height:300}),
    yaxis:{...baseLayout().yaxis,ticksuffix:'%',range:[0,100]},
    margin:{t:20,r:20,b:60,l:55},
    xaxis:{tickfont:{size:11}},
  }, plotlyConfig);

  // ── SGBV trend (monthly + quarterly) ─────────────────────
  Plotly.newPlot('chart-sgbv-trend', [
    {
      type:'scatter', mode:'lines+markers', name:'Monthly SGBV',
      x: MONTH_SHORT,
      y: MONTHS.map(m => s.monthly[m]||0),
      line:{color:C.female, width:2.5},
      marker:{size:7, color:C.female},
      fill:'tozeroy', fillcolor:C.female+'20',
      hovertemplate:'<b>SGBV</b><br>%{x}: %{y:,}<extra></extra>',
    }
  ], {
    ...baseLayout({height:300}),
    margin:{t:20,r:20,b:50,l:55},
    shapes:[{
      type:'rect', xref:'x', yref:'paper',
      x0:'Oct', x1:'Dec', y0:0, y1:1,
      fillcolor:'rgba(244,63,94,0.06)',
      line:{color:'rgba(244,63,94,0.25)',width:1}
    }],
    annotations:[{
      x:'Nov', y:1.05, xref:'x', yref:'paper',
      text:'◀ Q4 ▶', showarrow:false,
      font:{size:10, color:C.killed}, bgcolor:'rgba(244,63,94,0.1)',
    }],
  }, plotlyConfig);

  // ── SGBV state × quarter heatmap ─────────────────────────
  const sgbvAllSts = STATES.filter(st => QUARTERS.some(q=>(s.quarterly_by_state[q]?.[st]||0)>0));
  const sheatZ = sgbvAllSts.map(st => QUARTERS.map(q => s.quarterly_by_state[q]?.[st]||0));
  Plotly.newPlot('chart-sgbv-state-quarter', [{
    type:'heatmap',
    z: sheatZ,
    x: QUARTERS,
    y: sgbvAllSts,
    colorscale:[
      [0,'rgba(6,11,24,1)'],[0.3,'rgba(244,114,182,0.3)'],
      [0.7,'rgba(244,114,182,0.7)'],[1,'rgba(244,63,94,1)']
    ],
    text: sheatZ.map(row=>row.map(v=>v>0?fmt(v):'')),
    texttemplate:'%{text}',
    textfont:{size:12,color:'#fff'},
    showscale:true,
    colorbar:{tickfont:{color:C.textMuted,size:10},outlinecolor:'rgba(0,0,0,0)'},
    hovertemplate:'<b>%{y}</b><br>%{x}: %{z:,} SGBV cases<extra></extra>',
  }], {
    ...baseLayout({height:300}),
    margin:{t:20,r:70,b:50,l:185},
    xaxis:{...baseLayout().xaxis, gridcolor:'rgba(0,0,0,0)'},
    yaxis:{...baseLayout().yaxis, gridcolor:'rgba(0,0,0,0)', automargin:true, tickfont:{size:11}},
  }, plotlyConfig);

  // ── Services by state ─────────────────────────────────────
  const stateServiceData = Object.entries(s.q4_by_state)
    .filter(([,v])=>v.total>0)
    .sort((a,b)=>b[1].total-a[1].total);
  const ssNames = stateServiceData.map(([n])=>n);
  const medPct  = stateServiceData.map(([,v])=>{
    const yes=v.medical_care?.yes||0, no=v.medical_care?.no||0;
    return (yes+no)>0?+(yes/(yes+no)*100).toFixed(1):0;
  });
  const repPct  = stateServiceData.map(([,v])=>{
    const yes=v.reported?.yes||0, no=v.reported?.no||0;
    return (yes+no)>0?+(yes/(yes+no)*100).toFixed(1):0;
  });
  Plotly.newPlot('chart-state-services', [
    {
      type:'bar', name:'Medical Care %', x:ssNames, y:medPct,
      marker:{color:'#22d3ee', opacity:0.85},
      hovertemplate:'<b>Medical</b><br>%{x}: %{y:.1f}%<extra></extra>',
    },
    {
      type:'bar', name:'Reported to Authorities %', x:ssNames, y:repPct,
      marker:{color:'#fbbf24', opacity:0.85},
      hovertemplate:'<b>Reported</b><br>%{x}: %{y:.1f}%<extra></extra>',
    },
  ], {
    ...baseLayout({barmode:'group', height:300}),
    yaxis:{...baseLayout().yaxis, ticksuffix:'%', range:[0,105]},
    margin:{t:20,r:20,b:60,l:55},
    xaxis:{tickangle:-25, tickfont:{size:11}},
    legend:{orientation:'h',x:0,y:-0.3},
  }, plotlyConfig);

  // ── Insights ──────────────────────────────────────────────
  const topSgbvState = sgbvStateNames[0] || '—';
  const topSgbvTotal = s.q4_by_state[topSgbvState]?.total || 0;
  const femaleGirlPct = sq4.total ? (((sg.female||0)+(sg.girls||0))/sq4.total*100).toFixed(1) : '—';
  const medPctNat = sq4.total ? (sq4.medical_care?.yes||0)/sq4.total*100 : 0;
  const repPctNat = sq4.total ? (sq4.reported?.yes||0)/sq4.total*100 : 0;
  const arrPctNat = sq4.total ? (sq4.arrested?.yes||0)/sq4.total*100 : 0;

  setEl('insight-sgbv-1', `<ul class="insight-list">
    <li>Q4 2025 saw <strong class="highlight">${fmt(sq4.total)} SGBV survivors</strong> documented — a ${changePct(sq4.total, q3sgbv)} change from Q3 (${fmt(q3sgbv)}).</li>
    <li>Women and girls represent <strong class="highlight">${femaleGirlPct}%</strong> of all Q4 SGBV survivors — confirming women and girls face disproportionate sexual violence.</li>
    <li><strong class="highlight">${topSgbvState}</strong> is the most affected state with <strong class="highlight">${fmt(topSgbvTotal)}</strong> documented SGBV cases in Q4.</li>
    <li>Annual 2025 total: <strong class="highlight">${fmt(annualSGBV)} SGBV cases</strong> across all four quarters — significantly underreported.</li>
  </ul>`);

  setEl('insight-sgbv-2', `<ul class="insight-list">
    <li>Only <strong class="highlight">${medPctNat.toFixed(1)}%</strong> of Q4 SGBV survivors received medical care — a critical protection gap in a resource-constrained context.</li>
    <li>Only <strong class="highlight">${repPctNat.toFixed(1)}%</strong> reported violence to authorities, and only <strong class="highlight">${arrPctNat.toFixed(1)}%</strong> of cases resulted in perpetrator arrest — reflecting near-total impunity.</li>
    <li>${fmt(sq4.pregnancy?.yes||0)} cases resulted in pregnancy — a severe and lasting harm requiring comprehensive response services.</li>
    <li>Combined SGBV + CRSV victims in Q4: <strong class="highlight">${fmt(sq4.total + q4.crsv)}</strong> — but actual figures are likely much higher given systematic underreporting.</li>
  </ul>`);

});
