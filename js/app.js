/* ==========================================================================
   The UC Open-Letter Network — application
   Vanilla JS + Cytoscape. Data: window.NET (network-data.js), window.NET_TEXTS.
   ========================================================================== */
(function(){
"use strict";
const NET=window.NET, L=NET.letters, LE=NET.letterEdges, P=NET.persons, PE=NET.personEdges,
      INC=NET.incidence, ORD=NET.orders, META=NET.meta, TXT=window.NET_TEXTS||{};
const letterById={}; L.forEach(l=>letterById[l.id]=l);
const personById={}; P.forEach(p=>personById[p.id]=p);
const LNAME=(function(){try{return cytoscape("layout","fcose")?"fcose":"cose";}catch(e){return "cose";}})();

/* ---------------- display names for every signer ---------------- */
const nameOf={};
Object.keys(INC.byLetter).forEach(sid=>INC.byLetter[sid].forEach(s=>{ if(!nameOf[s.id])nameOf[s.id]=s.name; }));
P.forEach(p=>nameOf[p.id]=p.name);

/* ---------------- themes ---------------- */
const THEMES={
  budget:    {label:"Budget & austerity",        color:"#5b8def"},
  protest:   {label:"Protest & policing",        color:"#e4604e"},
  governance:{label:"Governance & leadership",   color:"#93a0bd"},
  labor:     {label:"Labor & strikes",           color:"#f08c2e"},
  curriculum:{label:"Curriculum & admissions",   color:"#e3c93e"},
  jewish:    {label:"Jewish community & antisemitism", color:"#b07ad1"},
  cyber:     {label:"Cybersecurity & privacy",   color:"#6cc24a"},
  federal:   {label:"Federal pressure",          color:"#45c1a8"}
};
const THEME_BY_ID={
  "2009-06-15_ucsd-faculty-statement-budget-crisis":"budget",
  "2009-06-29_ucb-faculty-oppose-salary-cuts":"budget",
  "2009-07-03_ucsb-save-uc-letter":"budget",
  "2009-07-09_ucla-sociology-statement-budget-contraction":"budget",
  "2009-07-12_lakoff-letter-to-regents-endorsements":"budget",
  "2010-03-01_uci-faculty-support-march-4th":"budget",
  "2009-11-22_ucb-faculty-letter-birgeneau-police-violence":"protest",
  "2009-12-04_ucla-faculty-open-letter-block-police":"protest",
  "2010-04-20_ucb-faculty-petition-osc-charges":"protest",
  "2011-02-09_uci-faculty-drop-charges":"protest",
  "2024-05-01_no-police-actions-ucla":"protest",
  "2024-05-06_uc-faculty-staff-demand-ucla":"protest",
  "2024-05-10_ucla-sociology-response-gaza-encampment":"protest",
  "2024-05-13_ucsd-faculty-testimony-gaza-encampment":"protest",
  "2024_ucla-math-dept-statement-administration":"protest",
  "2011-11-30_katehi-has-faculty-support":"governance",
  "2024-05-27_ucsd-senate-no-confidence-khosla":"governance",
  "2024-05_ucsd-senate-confidence-khosla":"governance",
  "2020-02-10_ucsc-faculty-oppose-class-disruption-reporting":"labor",
  "2022-11-23_uc-faculty-pledge-solidarity-strike":"labor",
  "2024-05_uc-faculty-pledge-non-retaliation-uaw4811":"labor",
  "2015-02-25_ucla-daily-bruin-diversity-requirement":"curriculum",
  "2021-12_uc-faculty-replace-ca-math-framework":"curriculum",
  "2023_uc-faculty-open-letter-k12-mathematics":"curriculum",
  "uc-a-g-ethnic-studies-support":"curriculum",
  "2022-05-31_uc-faculty-letter-boars-ethnic-studies-h":"curriculum",
  "2026-05-25_uc-stem-faculty-sat-act-letter":"curriculum",
  "2024-05_ucla-jewish-faculty-staff-open-letter":"jewish",
  "2024-05-08_uc-faculty-for-integrity-letter-regents":"jewish",
  "2025_jewish-uc-faculty-letter-to-regents":"jewish",
  "2025_jews-in-defense-of-uc":"jewish",
  "2025-06-20_uc-faculty-letter-drake-trellix":"cyber",
  "2025-08-01_uc-faculty-letter-milliken-trellix":"cyber",
  "2025_delay-cybersecurity-mandate-petition":"cyber",
  "2025-04-15_berkeley-division-petition-special-meeting":"federal"
};
function themeKey(l){ return THEME_BY_ID[l.id]||"governance"; }
function themeOf(l){ return THEMES[themeKey(l)]; }
const LANE_ORDER=["budget","protest","governance","labor","curriculum","jewish","cyber","federal"];

const CAMPUS_COLORS={UCB:"#4f86f7",UCLA:"#2bb3c0",UCSD:"#e25b4f",UCD:"#caa53d",UCI:"#58b368",
  UCSB:"#b969d6",UCSC:"#f29844",UCR:"#8fb544",UCSF:"#d667a3",UCM:"#7b6fe0",UCOP:"#8b96a8","":"#8b96a8"};
const CAMPUS_NAMES={UCB:"Berkeley",UCLA:"UCLA",UCSD:"San Diego",UCD:"Davis",UCI:"Irvine",UCSB:"Santa Barbara",
  UCSC:"Santa Cruz",UCR:"Riverside",UCSF:"San Francisco",UCM:"Merced",UCOP:"UCOP"};

function eraColor(y){ if(!y) return "#9aa0ab"; if(y<=2012) return "#5b8def"; if(y<=2022) return "#9a7ad1";
  if(y<=2024) return "#e4604e"; return "#f0b429"; }
function scopeColor(s){ s=(s||"").toLowerCase(); if(s.startsWith("system")) return "#45c1a8";
  const c=(s||"").toUpperCase().split(/[ /(]/)[0]; return CAMPUS_COLORS[c]||"#8b96a8"; }
function letterColor(l,mode){ if(mode==="year")return eraColor(l.year); if(mode==="campus_scope")return scopeColor(l.campus_scope); return themeOf(l).color; }

function shortTitle(l){ let t=l.title.replace(/^(Letter from|Letter|An Open Letter|Open Letter|Statement of the undersigned members of the|Statement|Petition|Submission:?)[^A-Za-z0-9]*/i,"");
  t=t.split(/[:—(]/)[0].trim(); if(t.length>34)t=t.slice(0,32)+"…"; return ((l.year?l.year+" · ":"")+t); }
function esc(s){ return (s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
function fmtN(n){ return (n||0).toLocaleString("en-US"); }
function dateOf(l){ const d=l.date_iso||"2009-01-01"; const p=d.split("-").map(Number);
  return new Date(p[0], (p[1]||7)-1, p[2]||15); }
function confBadge(l){ const c=(l.date_confidence||"").toLowerCase();
  if(!c||c==="unchanged"||c==="exact") return c?'<span class="conf exact">date: exact</span>':'';
  return `<span class="conf ${c==="approx"?"approx":"reported"}">date: ${esc(c)}</span>`; }
const totalSigs=L.reduce((a,l)=>a+l.n_signatories,0);

/* ---------------- css var access / theming ---------------- */
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function setSiteTheme(t){ document.documentElement.setAttribute("data-theme",t);
  try{localStorage.setItem("ucol-theme",t);}catch(e){}
  document.getElementById("ic-moon").style.display = t==="light"?"none":"";
  document.getElementById("ic-sun").style.display  = t==="light"?"":"none";
  if(cy1){ cy1.style(styleLetters()); cy1.style().update(); }
  if(cy2){ cy2.style(buildCyStyle()); cy2.style().update(); }
  if(cy3){ cy3.style(stylePeople()); cy3.style().update(); }
  if(inited.matrix)drawMatrix();
  if(inited.timeline)drawTimeline();
  if(inited.letters&&cy1)refreshLetters();
}
document.getElementById("theme-toggle").onclick=()=>{
  setSiteTheme(document.documentElement.getAttribute("data-theme")==="light"?"dark":"light"); };

/* ---------------- tooltip ---------------- */
const tipEl=document.getElementById("tooltip");
function showTip(html,e){ tipEl.innerHTML=html; tipEl.hidden=false;
  const vw=window.innerWidth, vh=window.innerHeight;
  let x=(e.clientX||0)+14, y=(e.clientY||0)+14;
  tipEl.style.left="0px"; tipEl.style.top="0px";
  const r=tipEl.getBoundingClientRect();
  if(x+r.width>vw-12)x=vw-r.width-12; if(y+r.height>vh-12)y=(e.clientY||0)-r.height-10;
  tipEl.style.left=x+"px"; tipEl.style.top=y+"px"; }
function hideTip(){ tipEl.hidden=true; }

/* ---------------- side panel ---------------- */
const pEmpty=document.getElementById("panel-empty"), pBody=document.getElementById("panel-body");
const panelEl=document.getElementById("panel");
const narrowQ=(window.matchMedia?window.matchMedia("(max-width:1100px)"):{matches:false});
document.getElementById("panel-close").onclick=()=>panelEl.classList.remove("open");
function setPanel(html){ pEmpty.hidden=true; pBody.hidden=false; pBody.innerHTML=html;
  if(narrowQ.matches)panelEl.classList.add("open");
  pBody.querySelectorAll("[data-letter]").forEach(el=>el.onclick=()=>selectLetter(el.dataset.letter,true));
  pBody.querySelectorAll("[data-person]").forEach(el=>el.onclick=()=>selectPerson(el.dataset.person,true));
  const b=pBody.querySelector("[data-bip]"); if(b)b.onclick=()=>{switchView("bipartite"); focusLetter(b.dataset.bip);};
  const r=pBody.querySelector("[data-read]"); if(r)r.onclick=()=>openReader(r.dataset.read);
}
function mixBarHTML(l){
  const mix=l.campus_mix||{}; const tot=Object.values(mix).reduce((a,b)=>a+b,0);
  if(!tot) return "";
  const top=Object.entries(mix).sort((a,b)=>b[1]-a[1]);
  const head=top.slice(0,6); const rest=top.slice(6).reduce((a,e)=>a+e[1],0);
  let bar='<div class="mixbar">', key='';
  head.forEach(([c,n])=>{ bar+=`<i style="width:${(100*n/tot).toFixed(1)}%;background:${CAMPUS_COLORS[c]||"#8b96a8"}" title="${esc(c)}: ${n}"></i>`; });
  if(rest)bar+=`<i style="width:${(100*rest/tot).toFixed(1)}%;background:#717c8e" title="other: ${rest}"></i>`;
  bar+='</div>';
  key='<div class="mixkey">'+head.map(([c,n])=>`<b style="color:${CAMPUS_COLORS[c]||"inherit"}">${esc(c)}</b> ${Math.round(100*n/tot)}%`).join(" · ")+(rest?` · other ${Math.round(100*rest/tot)}%`:"")+'</div>';
  return bar+key;
}
function letterPanel(id){ const l=letterById[id]; if(!l)return;
  const tk=themeOf(l);
  const ov=LE.filter(e=>e.source===id||e.target===id).map(e=>({o:e.source===id?e.target:e.source,s:e.shared}))
    .sort((a,b)=>b.s-a.s).slice(0,8);
  let h=`<div><span class="chip" style="color:${tk.color};border-color:${tk.color}55;background:${tk.color}18">${esc(tk.label)}</span></div>`;
  h+=`<h2>${esc(l.title)}</h2>`;
  h+=`<div class="sub">${esc(l.date_display||l.date_iso)}${confBadge(l)}</div>`;
  h+=`<div class="kv"><b>type</b> ${esc(l.type)} · <b>stance</b> ${esc(l.stance)}</div>`;
  h+=`<div class="kv"><b>scope</b> ${esc(l.campus_scope)}${l.addressee?` · <b>to</b> ${esc(l.addressee)}`:""}</div>`;
  h+=`<div class="kv"><b>signatures</b> ${fmtN(l.n_signatories)}</div>`;
  h+=mixBarHTML(l);
  if(l.context)h+=`<div class="secttl">Background</div><div class="ctx">${esc(l.context)}</div>`;
  if(l.outcome)h+=`<div class="secttl">What followed</div><div class="ctx outcome">${esc(l.outcome)}</div>`;
  h+=`<div class="panel-actions">`+(l.has_text?`<button class="btn primary" data-read="${id}">Read the letter</button>`:"")+
     `<button class="btn" data-bip="${id}">Signers in explorer</button></div>`;
  if(ov.length){ h+=`<div class="secttl">Most-overlapping letters</div><ul>`;
    ov.forEach(o=>{h+=`<li data-letter="${o.o}">${esc(shortTitle(letterById[o.o]))} <span class="tag">${o.s} shared</span></li>`;});
    h+=`</ul>`; }
  if((l.links||[]).length){ h+=`<div class="secttl">Sources & coverage</div><div class="linklist">`;
    l.links.forEach(k=>{h+=`<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.label)} ↗</a>`;}); h+=`</div>`; }
  else if(l.source_url)h+=`<div class="secttl">Source</div><div class="linklist"><a href="${esc(l.source_url)}" target="_blank" rel="noopener">source ↗</a></div>`;
  setPanel(h); }
function personPanel(id){ const p=personById[id]||{id,name:nameOf[id]||id,letters:(INC.byPerson[id]||[]),campus_primary:""};
  const ls=(p.letters||INC.byPerson[id]||[]);
  let h=`<h2>${esc(p.name||nameOf[id]||id)}</h2>
  <div class="sub">${esc(CAMPUS_NAMES[p.campus_primary]||p.campus_primary||"")}${p.dept?" · "+esc(p.dept):""} · signed ${ls.length} letter${ls.length>1?"s":""}</div><ul>`;
  ls.forEach(sid=>{const l=letterById[sid]; if(l)h+=`<li data-letter="${sid}"><span style="color:${themeOf(l).color}">●</span> ${l.date_iso||""} — ${esc(shortTitle(l))}</li>`;});
  h+=`</ul>`; setPanel(h); }
function edgePanel(a,b){
  const pa=personById[a]||{name:nameOf[a]||a}, pb=personById[b]||{name:nameOf[b]||b};
  const sa=new Set(INC.byPerson[a]||[]); const shared=(INC.byPerson[b]||[]).filter(x=>sa.has(x))
    .sort((x,y)=>String((letterById[x]||{}).date_iso||"").localeCompare(String((letterById[y]||{}).date_iso||"")));
  let h=`<h2>Shared letters</h2><div class="sub">${esc(pa.name)} ↔ ${esc(pb.name)}</div>
  <div class="kv"><b>co-signed</b> ${shared.length} letters</div><ul>`;
  shared.forEach(sid=>{const l=letterById[sid]; if(l) h+=`<li data-letter="${sid}"><span style="color:${themeOf(l).color}">●</span> ${l.date_iso||"—"} — ${esc(shortTitle(l))}</li>`;});
  setPanel(h+"</ul>");
}

/* ---------------- selection ---------------- */
const state={view:"timeline",metric:"shared",minShared:1,colorMode:"theme"};
function selectLetter(id){ state.sel={t:"L",id}; letterPanel(id);
  if(cy1)highlightEgo(cy1,id);
  if(state.view==="matrix")drawMatrix();
  if(inited.timeline)timelineHighlight(id); }
function selectPerson(id){ state.sel={t:"P",id}; personPanel(id); if(cy3&&cy3.$id(id).length)highlightEgo(cy3,id); }
function highlightEgo(cy,id){ const n=cy.$id(id); cy.elements().addClass("faded");
  if(n.length){ n.removeClass("faded"); n.closedNeighborhood().removeClass("faded"); n.addClass("sel"); } }
function clearFade(cy){ cy.elements().removeClass("faded sel"); }

/* ---------------- cytoscape shared style ---------------- */
function buildCyStyle(){
  const label=cssVar("--node-label"), outline=cssVar("--node-outline"),
        edge=cssVar("--line-strong")||"rgba(150,160,185,.3)", sel=cssVar("--sel")||"#7db5ff";
  return [
    {selector:"node",style:{"label":"data(label)","color":label,"text-outline-color":outline,"text-outline-width":1.6,
      "font-size":"10.5px","font-family":"Inter, sans-serif","text-wrap":"wrap","text-max-width":"95px",
      "text-valign":"center","text-halign":"center","background-color":"data(color)","border-width":0.5,"border-color":"rgba(0,0,0,.4)"}},
    {selector:"edge",style:{"line-color":edge,"curve-style":"haystack","opacity":0.5}},
    {selector:".faded",style:{"opacity":0.05,"text-opacity":0.03}},
    {selector:".sel",style:{"border-width":3,"border-color":sel}},
    {selector:"node.L",style:{"shape":"round-rectangle","font-size":"12px","border-width":1.2,"border-color":"rgba(0,0,0,.45)","text-outline-width":1.8}},
    {selector:"node.Pp",style:{"shape":"ellipse","width":15,"height":15,"font-size":"9.5px"}},
    {selector:"node.Pp.multi",style:{"border-width":2,"border-color":label}}
  ];
}

/* ================================ TIMELINE ================================ */
let tlShowEvents=true;
const EVENTS=[
 {date:"2009-07-16",label:"Regents declare fiscal emergency; furloughs approved"},
 {date:"2009-11-19",label:"Regents approve 32% fee increase; Wheeler Hall & UCLA protests"},
 {date:"2010-03-04",label:"Statewide Day of Action for public education"},
 {date:"2011-11-18",label:"UC Davis pepper-spray incident"},
 {date:"2020-02-28",label:"UCSC dismisses ~54 striking grad workers"},
 {date:"2022-11-14",label:"48,000 UC academic workers begin strike"},
 {date:"2023-07-12",label:"Revised CA Math Framework adopted"},
 {date:"2024-04-25",label:"UCLA encampment established"},
 {date:"2024-04-30",label:"Night attack on UCLA encampment"},
 {date:"2024-05-02",label:"Police clear UCLA encampment — 200+ arrests"},
 {date:"2024-05-06",label:"UCSD encampment cleared — 64 arrests"},
 {date:"2024-05-20",label:"UAW 4811 stand-up strike begins"},
 {date:"2025-08-08",label:"$1B federal demand on UCLA reported"},
 {date:"2026-06-05",label:"BOARS takes up the STEM testing letter"}];
function timelineHighlight(id){
  document.querySelectorAll(".tl-node").forEach(g=>{
    g.classList.toggle("sel",g.dataset.id===id);
  });
}
function drawTimeline(){
  const wrap=document.getElementById("timeline-wrap");
  const W=Math.max(900,wrap.clientWidth-8);
  const padL=170,padR=40,padT=46,padB=60;
  const lanes=LANE_ORDER.filter(k=>L.some(l=>themeKey(l)===k));
  const availH=wrap.clientHeight||0;
  const laneH=availH>200?Math.max(46,Math.min(72,Math.floor((availH-padT-padB-8)/lanes.length))):64;
  const H=padT+lanes.length*laneH+padB;
  const t0=new Date(2008,9,1), t1=new Date(2026,11,1);
  const span=t1-t0;
  const x=d=>padL+( (d-t0)/span )*(W-padL-padR);
  const bg1=cssVar("--bg1")||"#0c1322";
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  // year grid
  for(let y=2009;y<=2026;y++){ const xx=x(new Date(y,0,1));
    s+=`<line class="tl-grid" x1="${xx}" y1="${padT-18}" x2="${xx}" y2="${H-padB+14}"/>`;
    s+=`<text class="tl-year" x="${xx+4}" y="${padT-24}">${y}</text>`; }
  // lane bands + labels
  lanes.forEach((k,i)=>{ const yy=padT+i*laneH;
    if(i%2===0)s+=`<rect x="${padL-160}" y="${yy}" width="${W-padL-padR+160+20}" height="${laneH}" fill="${i%2?'none':'rgba(128,148,190,0.045)'}" rx="8"/>`;
    s+=`<text class="tl-lane-label" x="${padL-160}" y="${yy+laneH/2+3}" fill="${THEMES[k].color}">${esc(THEMES[k].label)}</text>`; });
  // events
  if(tlShowEvents){ EVENTS.forEach((ev,i)=>{ const p=ev.date.split("-").map(Number), xd=x(new Date(p[0],p[1]-1,p[2]||15));
      const yb=H-padB+26;
      s+=`<g class="tl-ev" data-ev="${i}"><line x1="${xd}" y1="${padT-12}" x2="${xd}" y2="${yb-7}"/>`+
         `<path d="M ${xd} ${yb-6} l 4.2 4.2 -4.2 4.2 -4.2 -4.2 Z"/></g>`; }); }
  // letters
  const placed=[]; // per lane: array of {x,r}
  lanes.forEach(()=>placed.push([]));
  const sorted=L.slice().sort((a,b)=>dateOf(a)-dateOf(b));
  sorted.forEach(l=>{
    const li=lanes.indexOf(themeKey(l));
    const cx=x(dateOf(l)); const r=Math.min(Math.max(5,Math.sqrt(l.n_signatories)*0.62),laneH*0.46+4);
    let cy=padT+li*laneH+laneH/2, k=0;
    for(const p of placed[li]){ if(Math.abs(p.x-cx)<(p.r+r+3)){ k++; } }
    if(k)cy+= (k%2? -1:1)*Math.min(laneH/2-r-1, (Math.ceil(k/2))*(r*0.85+4));
    placed[li].push({x:cx,r});
    const col=themeOf(l).color;
    s+=`<g class="tl-node" data-id="${l.id}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" fill-opacity="0.88" stroke="${bg1}" stroke-width="1.5"/>`;
    if(l.n_signatories>=600){ const anch=cx>W-180?"end":(cx<padL+180?"start":"middle");
      s+=`<text class="tl-label" x="${cx}" y="${cy-r-5}" text-anchor="${anch}">${esc(shortTitle(l).replace(/^\d{4} · /,""))}</text>`; }
    s+=`</g>`;
  });
  s+=`</svg>`;
  wrap.innerHTML=s;
  // interactions
  wrap.querySelectorAll(".tl-node").forEach(g=>{
    const l=letterById[g.dataset.id];
    g.addEventListener("mousemove",ev=>showTip(
      `<b>${esc(l.title)}</b><div class="tsub">${esc(l.date_display||l.date_iso)} · ${esc(themeOf(l).label)}</div>`+
      `<div class="tsub">${fmtN(l.n_signatories)} signatures${l.has_text?" · full text ⇢ double-click":""}</div>`,ev));
    g.addEventListener("mouseleave",hideTip);
    g.addEventListener("click",()=>selectLetter(l.id));
    g.addEventListener("dblclick",()=>openReader(l.id));
  });
  wrap.querySelectorAll(".tl-ev").forEach(g=>{
    const ev=EVENTS[+g.dataset.ev];
    g.addEventListener("mousemove",e=>showTip(`<b>${esc(ev.date)}</b><div class="tsub">${esc(ev.label)}</div>`,e));
    g.addEventListener("mouseleave",hideTip);
  });
  if(state.sel&&state.sel.t==="L")timelineHighlight(state.sel.id);
}
document.getElementById("tl-events").onchange=e=>{tlShowEvents=e.target.checked;drawTimeline();};

/* ================================ LETTER NETWORK ================================ */
let cy1=null;
function styleLetters(){ return buildCyStyle().concat([
  {selector:"node",style:{"width":n=>24+Math.sqrt(n.data("sig"))*3,"height":n=>24+Math.sqrt(n.data("sig"))*3}},
  {selector:"edge",style:{"width":e=>edgeWidth(e),"display":e=>e.data("shared")>=state.minShared?"element":"none"}}
]); }
function initLetters(){
  cy1=cytoscape({container:document.getElementById("cy-letters"),
    elements:[
      ...L.map(l=>({data:{id:l.id,label:shortTitle(l),color:letterColor(l,state.colorMode),sig:l.n_signatories}})),
      ...LE.map(e=>({data:{id:"le_"+e.source+"_"+e.target,source:e.source,target:e.target,shared:e.shared,jaccard:e.jaccard,overlap:e.overlap}}))
    ],
    style:styleLetters(),
    layout:{name:LNAME,animate:false,quality:"default",idealEdgeLength:95,nodeRepulsion:9500},
    wheelSensitivity:0.2});
  cy1.on("tap","node",e=>selectLetter(e.target.id()));
  cy1.on("dbltap","node",e=>openReader(e.target.id()));
  cy1.on("tap",e=>{ if(e.target===cy1){clearFade(cy1);} });
  cy1.on("mouseover","node",e=>{const l=letterById[e.target.id()];
    showTip(`<b>${esc(l.title)}</b><div class="tsub">${esc(l.date_display||l.date_iso)} · ${esc(themeOf(l).label)}</div><div class="tsub">${fmtN(l.n_signatories)} signatures</div>`,e.originalEvent);});
  cy1.on("mouseover","edge",e=>{const d=e.target.data();
    showTip(`<b>${d.shared}</b> shared signers<div class="tsub">Jaccard ${d.jaccard} · overlap ${d.overlap}</div>`,e.originalEvent);});
  cy1.on("mouseout",hideTip); cy1.on("pan zoom",hideTip);
  buildLegend();
}
function edgeWidth(e){ const m=state.metric; const v=e.data(m);
  if(m==="shared")return Math.max(0.4,Math.sqrt(v)*0.9); return 0.6+v*8; }
function refreshLetters(){ if(!cy1)return;
  cy1.nodes().forEach(n=>n.data("color",letterColor(letterById[n.id()],state.colorMode)));
  cy1.style().update(); buildLegend(); }
function relayout1(kind){ let opt;
  if(kind==="concentric")opt={name:"concentric",concentric:n=>letterById[n.id()].year||2000,levelWidth:()=>1,minNodeSpacing:30,animate:false};
  else if(kind==="circle")opt={name:"circle",animate:false,sort:(a,b)=>(letterById[a.id()].date_iso||"").localeCompare(letterById[b.id()].date_iso||"")};
  else opt={name:LNAME,animate:false,idealEdgeLength:95,nodeRepulsion:9500};
  cy1.layout(opt).run(); }
function buildLegend(){ const el=document.getElementById("legend-letters"); let items;
  if(state.colorMode==="theme")items=LANE_ORDER.map(k=>[THEMES[k].label,THEMES[k].color]);
  else if(state.colorMode==="year")items=[["2009–2012","#5b8def"],["2013–2022","#9a7ad1"],["2023–2024","#e4604e"],["2025–2026","#f0b429"]];
  else items=[["systemwide","#45c1a8"],["UCB","#4f86f7"],["UCLA","#2bb3c0"],["UCSD","#e25b4f"],["UCSC","#f29844"],["other","#8b96a8"]];
  el.innerHTML='<div class="ttl">node colour · size = signatures</div>'+
    items.map(([k,c])=>`<div class="row"><span class="sw" style="background:${c}"></span>${esc(k)}</div>`).join(""); }

/* ================================ MATRIX ================================ */
const sharedLU={}, jacLU={};
LE.forEach(e=>{ (sharedLU[e.source]=sharedLU[e.source]||{})[e.target]=e.shared; (sharedLU[e.target]=sharedLU[e.target]||{})[e.source]=e.shared;
  (jacLU[e.source]=jacLU[e.source]||{})[e.target]=e.jaccard; (jacLU[e.target]=jacLU[e.target]||{})[e.source]=e.jaccard; });
let mxOrder="cluster", mxMetric="shared";
function orderTopic(){ return L.slice().sort((a,b)=>{ const ka=LANE_ORDER.indexOf(themeKey(a)), kb=LANE_ORDER.indexOf(themeKey(b));
    return ka-kb || String(a.date_iso).localeCompare(String(b.date_iso)); }).map(l=>l.id); }
function drawMatrix(){
  const ids=(mxOrder==="topic"?orderTopic():(ORD[mxOrder]||ORD.date)), n=ids.length, svg=document.getElementById("matrix");
  const cell=21, padL=216, padT=216, W=padL+n*cell+24, H=padT+n*cell+24;
  const maxShared=Math.max(1,...LE.map(e=>e.shared));
  const cellRGB=cssVar("--cell-rgb")||"96,156,255", empty=cssVar("--cell-empty")||"rgba(148,163,190,.07)";
  svg.setAttribute("width",W); svg.setAttribute("height",H); svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  let out="";
  ids.forEach((id,i)=>{ const l=letterById[id], yy=padT+i*cell+cell-6;
    out+=`<text x="${padL-7}" y="${yy}" text-anchor="end" font-size="10" data-row="${id}">${esc(shortTitle(l).slice(0,32))}</text>`;
    out+=`<text transform="translate(${padL+i*cell+14},${padT-7}) rotate(-55)" font-size="10" data-col="${id}">${esc(shortTitle(l).slice(0,32))}</text>`; });
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){ const a=ids[i],b=ids[j]; let fill;
    if(i===j){ fill=themeOf(letterById[a]).color; }
    else { const sv=(sharedLU[a]&&sharedLU[a][b])||0; const jv=(jacLU[a]&&jacLU[a][b])||0;
      const t=mxMetric==="shared"?(sv/maxShared):jv;
      fill=sv===0?empty:`rgba(${cellRGB},${(0.13+0.87*Math.sqrt(t)).toFixed(3)})`; }
    const sel=state.sel&&state.sel.t==="L"&&(state.sel.id===a||state.sel.id===b);
    out+=`<rect x="${padL+j*cell}" y="${padT+i*cell}" width="${cell-1.5}" height="${cell-1.5}" rx="3" fill="${fill}" `+
      `stroke="${sel?cssVar("--sel"):"none"}" data-a="${a}" data-b="${b}" style="cursor:pointer"></rect>`; }
  svg.innerHTML=out;
  const rows=svg.querySelectorAll("[data-row]"), cols=svg.querySelectorAll("[data-col]");
  function mark(a,b){ rows.forEach(t=>t.classList.toggle("hl",t.dataset.row===a));
                      cols.forEach(t=>t.classList.toggle("hl",t.dataset.col===b)); }
  svg.querySelectorAll("rect").forEach(r=>{ const a=r.dataset.a,b=r.dataset.b;
    r.addEventListener("mousemove",ev=>{ mark(a,b);
      if(a===b){showTip(`<b>${esc(letterById[a].title)}</b><div class="tsub">${fmtN(letterById[a].n_signatories)} signatures</div>`,ev);return;}
      const sv=(sharedLU[a]&&sharedLU[a][b])||0, jv=(jacLU[a]&&jacLU[a][b])||0;
      showTip(`<b>${esc(shortTitle(letterById[a]))}</b> ∩ <b>${esc(shortTitle(letterById[b]))}</b><div class="tsub">${sv} shared signers · Jaccard ${jv}</div>`,ev); });
    r.addEventListener("mouseleave",()=>{hideTip();mark(null,null);});
    r.addEventListener("click",()=>{ if(a===b){switchView("bipartite");focusLetter(a);} else {switchView("bipartite");focusIntersection(a,b);} }); });
  svg.querySelectorAll("[data-row],[data-col]").forEach(t=>t.addEventListener("click",()=>selectLetter(t.dataset.row||t.dataset.col)));
}

/* ================================ BIPARTITE ================================ */
let cy2=null, bpCap=80;
function initBip(){ cy2=cytoscape({container:document.getElementById("cy-bip"),elements:[],
  style:buildCyStyle(),layout:{name:LNAME,animate:false},wheelSensitivity:0.2});
  cy2.on("tap","node.L",e=>{expandLetter(e.target.id());letterPanel(e.target.id());});
  cy2.on("tap","node.Pp",e=>{expandPerson(e.target.id());personPanel(e.target.id());});
  cy2.on("mouseover","node.Pp",e=>{const pp=personById[e.target.id()];showTip(`<b>${esc(e.target.data("label"))}</b>${pp&&pp.dept?`<div class="tsub">${esc(pp.dept)}</div>`:""}<div class="tsub">signed ${(INC.byPerson[e.target.id()]||[]).length} letters</div>`,e.originalEvent);});
  cy2.on("mouseover","node.L",e=>{const l=letterById[e.target.id()];showTip(`<b>${esc(l?l.title:e.target.id())}</b>`,e.originalEvent);});
  cy2.on("mouseout",hideTip);
}
function bipAddLetter(id){ if(cy2.$id(id).length)return; const l=letterById[id];
  cy2.add({group:"nodes",classes:"L",data:{id,label:shortTitle(l)||id,color:themeOf(l).color}}); }
function bipAddPerson(pid,name,campus){ if(cy2.$id(pid).length)return; const multi=(INC.byPerson[pid]||[]).length>=2;
  cy2.add({group:"nodes",classes:"Pp"+(multi?" multi":""),data:{id:pid,label:name||nameOf[pid]||pid,color:CAMPUS_COLORS[campus]||"#8b96a8"}}); }
function bipLink(l,p){ const id="b_"+l+"__"+p; if(cy2.$id(id).length)return; cy2.add({group:"edges",data:{id,source:l,target:p}}); }
function byConn(sg){ return sg.slice().sort((a,b)=>((INC.byPerson[b.id]||[]).length-(INC.byPerson[a.id]||[]).length)); }
function focusLetter(id){ if(!cy2)initBip(); cy2.elements().remove(); bipAddLetter(id);
  const sg=byConn(INC.byLetter[id]||[]); sg.slice(0,bpCap).forEach(s=>{bipAddPerson(s.id,s.name,s.campus);bipLink(id,s.id);});
  bipRun(); document.getElementById("bp-letter").value=id;
  const multi=sg.filter(s=>(INC.byPerson[s.id]||[]).length>1).length;
  setPanel(`<h2>${esc(letterById[id].title)}</h2><div class="sub">showing ${Math.min(bpCap,sg.length)} of ${fmtN(sg.length)} signers — most-connected first</div><div class="ctx">${multi} of these signers also signed other letters (shown first, with a ring); click one to add those letters. Raise "max signers shown" to include more.</div>`); }
function expandLetter(id){ const sg=byConn(INC.byLetter[id]||[]); sg.slice(0,bpCap).forEach(s=>{bipAddPerson(s.id,s.name,s.campus);bipLink(id,s.id);}); bipRun(); }
function expandPerson(pid){ const ls=(INC.byPerson[pid]||[]); ls.forEach(sid=>{ if(letterById[sid]){bipAddLetter(sid);bipLink(sid,pid);} }); bipRun(); }
function focusIntersection(a,b){ if(!cy2)initBip(); cy2.elements().remove(); bipAddLetter(a); bipAddLetter(b);
  const sb=new Set((INC.byLetter[b]||[]).map(s=>s.id)); const both=(INC.byLetter[a]||[]).filter(s=>sb.has(s.id));
  both.slice(0,bpCap*2).forEach(s=>{bipAddPerson(s.id,s.name,s.campus);bipLink(a,s.id);bipLink(b,s.id);}); bipRun();
  setPanel(`<h2>Shared signers</h2><div class="sub">${esc(shortTitle(letterById[a]))} ∩ ${esc(shortTitle(letterById[b]))}</div><div class="kv"><b>${both.length}</b> people signed both${both.length>bpCap*2?` (showing ${bpCap*2})`:""}.</div>`); }
function bipRun(){ cy2.layout({name:LNAME,animate:false,idealEdgeLength:60,nodeRepulsion:6000}).run(); cy2.fit(undefined,30); }

/* ================================ PEOPLE ================================ */
let cy3=null, ppNode=4, ppEdge=5, ppSpace=5;
function stylePeople(){ return buildCyStyle().concat([
  {selector:"node",style:{"width":n=>14+Math.sqrt(n.data("k"))*6,"height":n=>14+Math.sqrt(n.data("k"))*6,
    "label":n=>n.data("k")>=6?n.data("label"):"","font-size":"9.5px"}},
  {selector:"node.sel",style:{"label":"data(label)"}},
  {selector:"edge",style:{"width":e=>0.4+(e.data("w")||1)*0.7,"opacity":0.32}}]); }
function initPeople(){ cy3=cytoscape({container:document.getElementById("cy-people"),elements:[],
  style:stylePeople(),
  layout:{name:LNAME,animate:false},wheelSensitivity:0.2});
  cy3.on("tap","node",e=>selectPerson(e.target.id()));
  cy3.on("tap","edge",e=>{const d=e.target.data(); edgePanel(d.source,d.target);});
  cy3.on("mouseover","edge",e=>showTip("co-signed "+e.target.data("w")+" letters · click for the list",e.originalEvent));
  cy3.on("tap",e=>{if(e.target===cy3)clearFade(cy3);});
  cy3.on("mouseover","node",e=>{const p=personById[e.target.id()];
    showTip(`<b>${esc(p.name)}</b><div class="tsub">${esc(CAMPUS_NAMES[p.campus_primary]||p.campus_primary||"")}${p.dept?" · "+esc(p.dept):""} · ${p.n_letters} letters</div>`,e.originalEvent);});
  cy3.on("mouseout",hideTip);
  renderConnectors();
}
function renderPeople(){ if(!cy3)initPeople();
  const nodes=P.filter(p=>p.n_letters>=ppNode);
  const idset=new Set(nodes.map(p=>p.id));
  let edges=[];
  for(const e of PE){ const a=P[e[0]],b=P[e[1]],w=e[2];
    if(w>=ppEdge&&a&&b&&idset.has(a.id)&&idset.has(b.id)) edges.push([a.id,b.id,w]); }
  let capped=false; const CAP=7000;
  if(edges.length>CAP){ edges.sort((x,y)=>y[2]-x[2]); edges=edges.slice(0,CAP); capped=true; }
  cy3.elements().remove();
  cy3.add(nodes.map(p=>({data:{id:p.id,label:p.name,color:CAMPUS_COLORS[p.campus_primary]||"#8b96a8",k:p.n_letters}})));
  cy3.add(edges.map(e=>({data:{id:"pe_"+e[0]+"_"+e[1],source:e[0],target:e[1],w:e[2]}})));
  layoutPeople(); peopleLegend(nodes,edges.length,capped);
}
function peopleLayoutOpts(randomize){ var x=ppSpace; return {name:LNAME,animate:false,
  nodeRepulsion:1000*x*x, idealEdgeLength:14*x*x, nodeSeparation:10*x*x,
  gravity:0.04, gravityRange:6, packComponents:false, numIter:2500, randomize:randomize}; }
function layoutPeople(){ cy3.layout(peopleLayoutOpts(true)).run(); cy3.fit(undefined,40); }
function relayoutRepulsion(){ if(cy3&&cy3.nodes().length) cy3.layout(peopleLayoutOpts(false)).run(); }
function peopleLegend(nodes,nedges,capped){ const order=["UCB","UCD","UCI","UCLA","UCM","UCR","UCSD","UCSF","UCSB","UCSC",""];
  const present=[...new Set(nodes.map(p=>p.campus_primary))].filter(c=>c in CAMPUS_COLORS).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  const el=document.getElementById("legend-people"); if(!el)return;
  el.innerHTML='<div class="ttl">colour = campus · size = letters signed</div>'+
    present.map(c=>`<div class="row"><span class="sw" style="background:${CAMPUS_COLORS[c]}"></span>${c?(c+" — "+(CAMPUS_NAMES[c]||"")):"unknown"}</div>`).join("")+
    `<div class="row" style="margin-top:6px">${nodes.length} people · ${fmtN(nedges)} ties${capped?" (strongest shown)":""}</div>`; }
function renderConnectors(){ const tb=document.getElementById("connectors-body");
  const rows=P; tb.innerHTML=rows.map((p,i)=>{
    const ls=p.letters.map(s=>letterById[s]).filter(Boolean).map(l=>l.year).filter(Boolean);
    const span=ls.length?Math.min(...ls)+"–"+Math.max(...ls):"";
    return `<tr data-person="${p.id}"><td>${i+1}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.campus_primary)}</td><td>${esc(p.dept||"")}</td><td style="text-align:center">${p.n_letters}</td><td>${span}</td></tr>`;}).join("");
  tb.querySelectorAll("tr").forEach(tr=>tr.onclick=()=>{ selectPerson(tr.dataset.person); });
}

/* ================================ CATALOGUE ================================ */
let catSort="date_desc", catSearch="";
function renderCatalogue(){
  const wrap=document.getElementById("catalogue-wrap"); if(!wrap)return;
  const q=catSearch.toLowerCase();
  let rows=L.slice();
  if(q) rows=rows.filter(l=>((l.title||"")+" "+(l.topic||"")+" "+(l.addressee||"")+" "+(l.type||"")+" "+themeOf(l).label).toLowerCase().includes(q));
  const cmp={date_desc:(a,b)=>String(b.date_iso||"0").localeCompare(String(a.date_iso||"0")),
    date:(a,b)=>String(a.date_iso||"9").localeCompare(String(b.date_iso||"9")),
    signers:(a,b)=>b.n_signatories-a.n_signatories,
    title:(a,b)=>String(a.title).localeCompare(String(b.title))};
  rows.sort(cmp[catSort]||cmp.date_desc);
  const cc=document.getElementById("cat-count"); if(cc) cc.textContent=rows.length+" of "+L.length+" letters";
  const maxN=Math.max(...L.map(l=>l.n_signatories));
  wrap.innerHTML=rows.map(l=>{
    const tk=themeOf(l); const d=dateOf(l);
    const mon=d.toLocaleString("en-US",{month:"short"});
    return `<div class="cat-card" data-letter="${l.id}">
      <div class="cat-date"><b>${l.year||"—"}</b>${esc(mon)}<br/><span style="font-size:10px;color:var(--ink-faint)">${esc((l.type||"").replace(/_/g," "))}</span></div>
      <div class="cat-main">
        <h3>${esc(l.title)}</h3>
        <div class="meta"><span class="dot" style="background:${tk.color}"></span>${esc(tk.label)}
          · ${esc(l.campus_scope)}${l.addressee?` · to ${esc(l.addressee)}`:""}
          · ${esc(l.date_display||l.date_iso)}</div>
      </div>
      <div class="cat-side">
        <span class="n">${fmtN(l.n_signatories)}</span> <span class="nl">signatures</span>
        <div class="bar"><i style="width:${Math.max(2,100*l.n_signatories/maxN).toFixed(1)}%;background:${tk.color}"></i></div>
        <div class="badges">${l.has_text?'<span class="b full">full text</span>':'<span class="b">roster only</span>'}${(l.links||[]).length?`<span class="b">${l.links.length} sources</span>`:""}</div>
      </div>
    </div>`;
  }).join("");
  wrap.querySelectorAll(".cat-card").forEach(c=>c.onclick=()=>openReader(c.dataset.letter));
}

/* ================================ READER ================================ */
const reader=document.getElementById("reader");
function mdLite(src){
  let t=esc(src);
  t=t.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  t=t.replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>");
  t=t.replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s).,;:!?<]|$)/g,"$1<em>$2</em>");
  t=t.replace(/(^|[\s(>])_([^_\n]+)_(?=[\s).,;:!?<]|$)/g,"$1<em>$2</em>");
  const blocks=t.split(/\n{2,}/).map(b=>{
    const s=b.trim(); if(!s)return "";
    if(/^#{1,4}\s/.test(s))return "<h4>"+s.replace(/^#{1,4}\s*/,"")+"</h4>";
    if(/^([-*]\s)/.test(s))return "<ul>"+s.split(/\n/).map(li=>"<li>"+li.replace(/^[-*]\s*/,"")+"</li>").join("")+"</ul>";
    return "<p>"+s.replace(/\n/g,"<br/>")+"</p>";
  });
  return blocks.join("");
}
function openReader(id){
  const l=letterById[id]; if(!l)return;
  const tk=themeOf(l);
  document.getElementById("rd-chips").innerHTML=
    `<span class="chip" style="color:${tk.color};border-color:${tk.color}55;background:${tk.color}18">${esc(tk.label)}</span>`+
    `<span class="chip" style="color:var(--ink-dim)">${esc((l.type||"").replace(/_/g," "))}</span>`+
    `<span class="chip" style="color:var(--ink-dim)">${esc(l.campus_scope)}</span>`;
  document.getElementById("rd-title").textContent=l.title;
  document.getElementById("rd-when").innerHTML=`${esc(l.date_display||l.date_iso)}${confBadge(l)} · ${fmtN(l.n_signatories)} signatures${l.addressee?` · addressed to ${esc(l.addressee)}`:""}`;
  const txt=TXT[id];
  document.getElementById("rd-text").innerHTML = txt? mdLite(txt) :
    `<div class="notext">The full text of this item isn't stored in the corpus${l.id==="2025_delay-cybersecurity-mandate-petition"?" — by design: this petition's roster accompanies the June 20 and August 1, 2025 Trellix letters, which carry the argument and are both in this collection":""}. ${l.source_url?`See the <a href="${esc(l.source_url)}" target="_blank" rel="noopener">original source ↗</a>.`:""}</div>`;
  const ov=LE.filter(e=>e.source===id||e.target===id).map(e=>({o:e.source===id?e.target:e.source,s:e.shared}))
    .sort((a,b)=>b.s-a.s).slice(0,6);
  let m="";
  if(l.context)m+=`<div class="secttl">Background</div><div class="ctx">${esc(l.context)}</div>`;
  if(l.outcome)m+=`<div class="secttl">What followed</div><div class="ctx outcome">${esc(l.outcome)}</div>`;
  m+=`<div class="secttl">Signatures</div><div class="kv">${fmtN(l.n_signatories)} recorded${l.n_reported&&String(l.n_reported)!==String(l.n_signatories)?` (${esc(String(l.n_reported))} reported)`:""}</div>`+mixBarHTML(l);
  if(ov.length){ m+=`<div class="secttl">Shares signers with</div>`;
    ov.forEach(o=>{m+=`<div class="ovl" data-rd-letter="${o.o}">${esc(shortTitle(letterById[o.o]))} <span class="tag">${o.s}</span></div>`;}); }
  if((l.links||[]).length){ m+=`<div class="secttl">Sources & coverage</div>`;
    l.links.forEach(k=>{m+=`<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.label)} ↗</a>`;}); }
  if(l.source_url)m+=`<div class="secttl">Original</div><a href="${esc(l.source_url)}" target="_blank" rel="noopener">source document ↗</a>`;
  m+=`<div class="panel-actions" style="margin-top:16px"><button class="btn" id="rd-explore">Signers in explorer</button><button class="btn" id="rd-network">View in network</button></div>`;
  const meta=document.getElementById("rd-meta"); meta.innerHTML=m;
  meta.querySelectorAll("[data-rd-letter]").forEach(el=>el.onclick=()=>openReader(el.dataset.rdLetter));
  const ex=document.getElementById("rd-explore"); if(ex)ex.onclick=()=>{closeReader();switchView("bipartite");focusLetter(id);};
  const nw=document.getElementById("rd-network"); if(nw)nw.onclick=()=>{closeReader();switchView("letters");selectLetter(id);};
  meta.scrollTop=0; document.querySelector("#reader .sheet-text").scrollTop=0;
  reader.classList.add("open");
  try{history.replaceState(null,"","#/letter/"+encodeURIComponent(id));}catch(e){}
  selectLetterSoft(id);
}
function selectLetterSoft(id){ state.sel={t:"L",id}; letterPanel(id); if(inited.timeline)timelineHighlight(id); }
function closeReader(){ reader.classList.remove("open");
  try{history.replaceState(null,"",location.pathname+location.search);}catch(e){} }
reader.querySelectorAll("[data-close]").forEach(el=>el.onclick=closeReader);

/* ================================ SEARCH ================================ */
const searchOv=document.getElementById("search-overlay"), sIn=document.getElementById("search-input"), sRes=document.getElementById("search-results");
let sIdx=null, sHl=0;
function buildSearchIndex(){ if(sIdx)return;
  sIdx=[];
  L.forEach(l=>sIdx.push({t:"L",id:l.id,name:l.title,sub:(l.date_display||l.date_iso)+" · "+fmtN(l.n_signatories)+" signatures",color:themeOf(l).color,q:(l.title+" "+l.topic+" "+(l.addressee||"")).toLowerCase()}));
  Object.keys(INC.byPerson).forEach(nn=>{ const k=INC.byPerson[nn].length, p=personById[nn];
    sIdx.push({t:"P",id:nn,name:nameOf[nn]||nn,sub:(p&&p.campus_primary?p.campus_primary+" · ":"")+k+" letter"+(k>1?"s":""),k,
      color:CAMPUS_COLORS[(p&&p.campus_primary)||""]||"#8b96a8",q:(nameOf[nn]||nn).toLowerCase()}); });
}
function openSearch(){ buildSearchIndex(); searchOv.classList.add("open"); sIn.value=""; sRes.innerHTML=""; sHl=0; setTimeout(()=>sIn.focus(),30); }
function closeSearch(){ searchOv.classList.remove("open"); }
searchOv.querySelectorAll("[data-close]").forEach(el=>el.onclick=closeSearch);
document.getElementById("open-search").onclick=openSearch;
function runSearch(){
  const q=sIn.value.trim().toLowerCase();
  if(q.length<2){ sRes.innerHTML='<div class="sr muted" style="cursor:default">Type at least two characters…</div>'; return; }
  const hits=[];
  for(const it of sIdx){ const i=it.q.indexOf(q); if(i>=0){ hits.push({it,score:(it.t==="L"?-200:0)+i-(it.k||0)*2}); } }
  hits.sort((a,b)=>a.score-b.score);
  const top=hits.slice(0,14);
  sRes.innerHTML= top.length? top.map((h,i)=>`<div class="sr${i===0?" hl":""}" data-i="${i}" data-t="${h.it.t}" data-id="${esc(h.it.id)}">
      <span class="dot" style="background:${h.it.color}"></span><b>${esc(h.it.name)}</b>
      <span style="color:var(--ink-faint)">${esc(h.it.sub)}</span><span class="k">${h.it.t==="L"?"letter":"person"}</span></div>`).join("")
    : '<div class="sr" style="cursor:default">No matches.</div>';
  sHl=0;
  sRes.querySelectorAll(".sr[data-id]").forEach(el=>el.onclick=()=>{ pick(el.dataset.t,el.dataset.id); });
}
function pick(t,id){ closeSearch();
  if(t==="L"){ openReader(id); }
  else { selectPerson(id); if(state.view!=="people"&&state.view!=="bipartite"){switchView("bipartite"); if(!cy2)initBip(); cy2.elements().remove(); expandPerson(id);} }
}
sIn.addEventListener("input",runSearch);
sIn.addEventListener("keydown",e=>{
  const items=[...sRes.querySelectorAll(".sr[data-id]")]; if(!items.length)return;
  if(e.key==="ArrowDown"){e.preventDefault();sHl=Math.min(items.length-1,sHl+1);}
  else if(e.key==="ArrowUp"){e.preventDefault();sHl=Math.max(0,sHl-1);}
  else if(e.key==="Enter"){e.preventDefault();const el=items[sHl];if(el)pick(el.dataset.t,el.dataset.id);return;}
  items.forEach((el,i)=>el.classList.toggle("hl",i===sHl));
});
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){ e.preventDefault(); openSearch(); }
  else if(e.key==="Escape"){ if(searchOv.classList.contains("open"))closeSearch(); else if(reader.classList.contains("open"))closeReader(); else panelEl.classList.remove("open"); }
});

/* ================================ tabs / boot ================================ */
const views={timeline:drawTimeline,letters:initLetters,matrix:()=>drawMatrix(),bipartite:initBip,people:renderPeople,catalogue:renderCatalogue};
const inited={};
function switchView(v){ state.view=v;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===v));
  document.querySelectorAll(".view").forEach(s=>s.classList.toggle("active",s.id==="view-"+v));
  if(!inited[v]){ inited[v]=true; if(views[v])views[v](); }
  else if(v==="matrix")drawMatrix();
  else if(v==="catalogue")renderCatalogue();
  else if(v==="timeline")drawTimeline();
  setTimeout(()=>{ if(v==="letters"&&cy1){cy1.resize();cy1.fit(undefined,30);}
    if(v==="bipartite"&&cy2){cy2.resize();cy2.fit(undefined,30);}
    if(v==="people"&&cy3){cy3.resize();cy3.fit(undefined,30);} },30);
}
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>switchView(t.dataset.view));

/* controls */
document.getElementById("lt-metric").onchange=e=>{state.metric=e.target.value; if(cy1)cy1.style().update();};
document.getElementById("lt-min").oninput=e=>{state.minShared=+e.target.value; document.getElementById("lt-minval").textContent=e.target.value; if(cy1)cy1.style().update();};
document.getElementById("lt-layout").onchange=e=>relayout1(e.target.value);
document.getElementById("lt-color").onchange=e=>{state.colorMode=e.target.value; refreshLetters();};
document.getElementById("lt-search").oninput=e=>{ const q=e.target.value.toLowerCase(); if(!cy1)return;
  if(!q){clearFade(cy1);return;} const m=cy1.nodes().filter(n=>letterById[n.id()].title.toLowerCase().includes(q));
  cy1.elements().addClass("faded"); m.removeClass("faded"); if(m.length===1)selectLetter(m[0].id()); };
document.getElementById("mx-order").onchange=e=>{mxOrder=e.target.value;drawMatrix();};
document.getElementById("mx-metric").onchange=e=>{mxMetric=e.target.value;drawMatrix();};
const bpSel=document.getElementById("bp-letter");
L.slice().sort((a,b)=>(a.date_iso||"").localeCompare(b.date_iso||"")).forEach(l=>{const o=document.createElement("option");o.value=l.id;o.textContent=shortTitle(l);bpSel.appendChild(o);});
bpSel.onchange=e=>{ if(e.target.value)focusLetter(e.target.value); };
document.getElementById("bp-clear").onclick=()=>{ if(cy2)cy2.elements().remove(); bpSel.value=""; };
document.getElementById("bp-cap").oninput=e=>{bpCap=+e.target.value;document.getElementById("bp-capval").textContent=e.target.value;};
document.getElementById("pp-node").oninput=e=>{ppNode=+e.target.value;document.getElementById("pp-nodeval").textContent=e.target.value;renderPeople();};
document.getElementById("pp-edge").oninput=e=>{ppEdge=+e.target.value;document.getElementById("pp-edgeval").textContent=e.target.value;renderPeople();};
var _ppSp=document.getElementById("pp-space");_ppSp.oninput=e=>{ppSpace=+e.target.value;document.getElementById("pp-spaceval").textContent=e.target.value;};_ppSp.onchange=()=>relayoutRepulsion();
document.getElementById("pp-search").oninput=e=>{ const q=e.target.value.toLowerCase(); if(!cy3)return;
  if(!q){clearFade(cy3);return;} const m=cy3.nodes().filter(n=>personById[n.id()].name.toLowerCase().includes(q));
  cy3.elements().addClass("faded"); m.removeClass("faded"); if(m.length>=1)selectPerson(m[0].id()); };
document.getElementById("cat-sort").onchange=e=>{catSort=e.target.value;renderCatalogue();};
document.getElementById("cat-search").oninput=e=>{catSearch=e.target.value;renderCatalogue();};
document.getElementById("data-note-toggle").onclick=e=>{e.preventDefault();const d=document.getElementById("about-note");d.hidden=!d.hidden;};
document.addEventListener("click",e=>{ const d=document.getElementById("about-note");
  if(!d.hidden && !d.contains(e.target) && e.target.id!=="data-note-toggle") d.hidden=true; });

/* footer + stats */
document.getElementById("meta-line").textContent=`${META.n_letters} letters · ${fmtN(totalSigs)} signature records · ${fmtN(META.n_persons_total)} unique signers · ${fmtN(META.n_bridgers_ge2)} signed ≥2`;
document.getElementById("build-line").textContent="Context dossiers verified June 2026";
function countUp(el,target,dur){ const t0=performance.now();
  function f(t){ const k=Math.min(1,(t-t0)/dur); el.textContent=fmtN(Math.round(target*(k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2)));
    if(k<1)requestAnimationFrame(f); } requestAnimationFrame(f); }
countUp(document.getElementById("st-letters"),META.n_letters,700);
countUp(document.getElementById("st-sigs"),totalSigs,1000);
countUp(document.getElementById("st-people"),META.n_persons_total,1000);
countUp(document.getElementById("st-repeat"),META.n_bridgers_ge2,900);

/* resizers */
function setupResizers(){
  const panel=document.getElementById("panel"), conn=document.getElementById("connectors");
  function refit(){ if(cy1)cy1.resize(); if(cy2)cy2.resize(); if(cy3)cy3.resize(); }
  function drag(handle,get,set){ if(!handle)return;
    handle.addEventListener("mousedown",e=>{ e.preventDefault(); const sx=e.clientX, sw=get();
      document.body.style.userSelect="none"; document.body.style.cursor="col-resize";
      function mv(ev){ set(sw-(ev.clientX-sx)); refit(); }
      function up(){ document.removeEventListener("mousemove",mv); document.removeEventListener("mouseup",up); document.body.style.userSelect=""; document.body.style.cursor=""; refit(); }
      document.addEventListener("mousemove",mv); document.addEventListener("mouseup",up); }); }
  drag(document.getElementById("panel-resizer"), ()=>panel.offsetWidth, w=>{panel.style.width=Math.max(0,Math.min(720,w))+"px";});
  drag(document.getElementById("conn-resizer"), ()=>conn.offsetWidth, w=>{w=Math.max(0,Math.min(820,w));conn.style.flex="0 0 "+w+"px";conn.style.width=w+"px";});
}
setupResizers();
window.addEventListener("resize",()=>{ if(state.view==="timeline"&&inited.timeline)drawTimeline(); });

/* boot: theme, hash route, default view */
(function boot(){
  let th="dark"; try{th=localStorage.getItem("ucol-theme")||"dark";}catch(e){}
  document.documentElement.setAttribute("data-theme",th);
  document.getElementById("ic-moon").style.display = th==="light"?"none":"";
  document.getElementById("ic-sun").style.display  = th==="light"?"":"none";
  switchView("timeline");
  const h=decodeURIComponent(location.hash||"");
  const m=h.match(/^#\/letter\/(.+)$/);
  if(m&&letterById[m[1]]) setTimeout(()=>openReader(m[1]),150);
})();
})();
