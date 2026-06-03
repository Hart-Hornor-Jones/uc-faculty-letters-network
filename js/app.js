(function(){
"use strict";
const NET=window.NET, L=NET.letters, LE=NET.letterEdges, P=NET.persons, PE=NET.personEdges,
      INC=NET.incidence, ORD=NET.orders, META=NET.meta;
const letterById={}; L.forEach(l=>letterById[l.id]=l);
const personById={}; P.forEach(p=>personById[p.id]=p);
const LNAME=(function(){try{return cytoscape("layout","fcose")?"fcose":"cose";}catch(e){return "cose";}})();

/* ---------- encodings ---------- */
function theme(t){ t=(t||"").toLowerCase();
  if(t.includes("cyber")) return "Cybersecurity";
  if(t.includes("labor")||t.includes("strike")) return "Labor / strike";
  if(t.includes("admission")||t.includes("testing")||t.includes("boars")) return "Admissions";
  if(t.includes("gaza")||t.includes("police")||t.includes("protest")||t.includes("encampment")) return "Protest / policing";
  if(t.includes("budget")||t.includes("compensation")||t.includes("salary")||t.includes("pension")||t.includes("furlough")||t.includes("mission")) return "Budget / funding";
  if(t.includes("antisemit")||t.includes("jewish")) return "Antisemitism / Jewish faculty";
  if(t.includes("federal")||t.includes("academic freedom")) return "Academic freedom / federal";
  return "Other"; }
const THEME_COLORS={"Budget / funding":"#4e79a7","Protest / policing":"#e15759","Labor / strike":"#f28e2b",
  "Antisemitism / Jewish faculty":"#b07aa1","Academic freedom / federal":"#76b7b2","Cybersecurity":"#59a14f",
  "Admissions":"#edc948","Other":"#9c9c9c"};
const CAMPUS_COLORS={UCB:"#2b6cb0",UCD:"#b7791f",UCI:"#2f855a",UCLA:"#c05621",UCM:"#6b46c1",UCR:"#047481",
  UCSD:"#9b2c2c",UCSF:"#2c7a7b",UCSB:"#b83280",UCSC:"#4c51bf","":"#718096"};
function eraColor(y){ if(!y) return "#9c9c9c"; if(y<=2012) return "#5b8def"; if(y<=2022) return "#8e6fd8";
  if(y==2024) return "#e0607e"; return "#e8a33d"; }
function scopeColor(s){ s=(s||"").toLowerCase(); if(s.startsWith("system")) return "#76b7b2";
  return CAMPUS_COLORS[(s||"").toUpperCase().split(" ")[0]]||"#9c9c9c"; }
function letterColor(l,mode){ if(mode==="year")return eraColor(l.year); if(mode==="campus_scope")return scopeColor(l.campus_scope); return THEME_COLORS[theme(l.topic)]; }
function shortTitle(l){ let t=l.title.replace(/^(Letter|An Open Letter|Open Letter|Statement|Petition)[^A-Za-z0-9]*/i,""); t=t.split(/[:—\(]/)[0].trim(); if(t.length>30)t=t.slice(0,28)+"…"; return ((l.year?l.year+" ":"")+t); }
const totalSigs=L.reduce((a,l)=>a+l.n_signatories,0);

/* ---------- tooltip ---------- */
const tipEl=document.getElementById("tooltip");
function showTip(html,e){ tipEl.innerHTML=html; tipEl.hidden=false;
  const x=(e.clientX||0)+12, y=(e.clientY||0)+12; tipEl.style.left=x+"px"; tipEl.style.top=y+"px"; }
function hideTip(){ tipEl.hidden=true; }

/* ---------- side panel ---------- */
const pEmpty=document.getElementById("panel-empty"), pBody=document.getElementById("panel-body");
function setPanel(html){ pEmpty.hidden=true; pBody.hidden=false; pBody.innerHTML=html;
  pBody.querySelectorAll("[data-letter]").forEach(el=>el.onclick=()=>selectLetter(el.dataset.letter,true));
  pBody.querySelectorAll("[data-person]").forEach(el=>el.onclick=()=>selectPerson(el.dataset.person,true));
  const b=pBody.querySelector("#go-bip"); if(b)b.onclick=()=>{switchView("bipartite"); focusLetter(b.dataset.id);};
}
function letterPanel(id){ const l=letterById[id]; if(!l)return;
  const ov=LE.filter(e=>e.source===id||e.target===id).map(e=>({o:e.source===id?e.target:e.source,s:e.shared}))
    .sort((a,b)=>b.s-a.s).slice(0,10);
  let h=`<h2>${esc(l.title)}</h2><div class="sub">${l.date_iso||"undated"} · ${esc(l.type)} · ${esc(l.stance)}</div>`;
  h+=`<div class="kv"><b>topic</b> ${esc(l.topic)}</div><div class="kv"><b>scope</b> ${esc(l.campus_scope)}</div>`;
  h+=`<div class="kv"><b>signatories</b> ${l.n_signatories.toLocaleString()}</div><div class="kv"><b>text</b> ${esc(l.text_status)}</div>`;
  if(l.source_url)h+=`<div class="kv"><a href="${esc(l.source_url)}" target="_blank" rel="noopener">source &#8599;</a></div>`;
  h+=`<p><button class="btn" id="go-bip" data-id="${id}">Open signers in bipartite explorer</button></p>`;
  h+=`<h2 style="font-size:13px">Most-overlapping letters</h2><ul>`;
  ov.forEach(o=>{h+=`<li data-letter="${o.o}">${esc(shortTitle(letterById[o.o]))} <span class="tag">${o.s} shared</span></li>`;});
  h+=`</ul>`; setPanel(h); }
function personPanel(id){ const p=personById[id]||{id,name:id,letters:(INC.byPerson[id]||[]),campus_primary:""};
  const ls=(p.letters||INC.byPerson[id]||[]);
  let h=`<h2>${esc(p.name||id)}</h2><div class="sub">${esc(p.campus_primary||"")}${p.dept?" · "+esc(p.dept):""} · signed ${ls.length} letters</div><ul>`;
  ls.forEach(sid=>{const l=letterById[sid]; if(l)h+=`<li data-letter="${sid}">${l.date_iso||""} — ${esc(shortTitle(l))}</li>`;});
  h+=`</ul>`; setPanel(h); }
function esc(s){ return (s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }

/* ---------- selection sync ---------- */
const state={view:"letters",metric:"shared",minShared:1,colorMode:"theme"};
function selectLetter(id){ state.sel={t:"L",id}; letterPanel(id); if(cy1)highlightEgo(cy1,id);
  if(state.view==="matrix")drawMatrix(); }
function selectPerson(id){ state.sel={t:"P",id}; personPanel(id); if(cy3&&cy3.$id(id).length)highlightEgo(cy3,id); }
function highlightEgo(cy,id){ const n=cy.$id(id); cy.elements().addClass("faded");
  if(n.length){ n.removeClass("faded"); n.closedNeighborhood().removeClass("faded"); n.addClass("sel"); } }
function clearFade(cy){ cy.elements().removeClass("faded sel"); }

/* ---------- shared cy style ---------- */
function baseStyle(){ return [
  {selector:"node",style:{"label":"data(label)","color":"#111","text-outline-color":"#fff","text-outline-width":1.4,"font-size":"11px","text-wrap":"wrap","text-max-width":"95px",
     "text-valign":"center","text-halign":"center","background-color":"data(color)","border-width":0.5,"border-color":"rgba(0,0,0,0.35)"}},
  {selector:"edge",style:{"line-color":"#000","curve-style":"haystack","opacity":0.28}},
  {selector:".faded",style:{"opacity":0.06,"text-opacity":0.04}},
  {selector:".sel",style:{"border-width":3,"border-color":"#1a73e8"}},
  {selector:"node.L",style:{"shape":"round-rectangle","color":"#111","font-size":"13px","border-width":1,"border-color":"#222"}},
  {selector:"node.Pp",style:{"shape":"ellipse","width":15,"height":15,"font-size":"10px"}},{selector:"node.Pp.multi",style:{"border-width":2,"border-color":"#111"}}
];}

/* ===================== LETTERS ===================== */
let cy1=null;
function initLetters(){
  cy1=cytoscape({container:document.getElementById("cy-letters"),
    elements:[
      ...L.map(l=>({data:{id:l.id,label:shortTitle(l),color:letterColor(l,state.colorMode),sig:l.n_signatories}})),
      ...LE.map(e=>({data:{id:"le_"+e.source+"_"+e.target,source:e.source,target:e.target,shared:e.shared,jaccard:e.jaccard,overlap:e.overlap}}))
    ],
    style:baseStyle().concat([
      {selector:"node",style:{"width":n=>22+Math.sqrt(n.data("sig"))*3,"height":n=>22+Math.sqrt(n.data("sig"))*3}},
      {selector:"edge",style:{"width":e=>edgeWidth(e),"display":e=>e.data("shared")>=state.minShared?"element":"none"}}
    ]),
    layout:{name:LNAME,animate:false,quality:"default",idealEdgeLength:90,nodeRepulsion:9000},
    wheelSensitivity:0.2});
  cy1.on("tap","node",e=>selectLetter(e.target.id()));
  cy1.on("tap",e=>{ if(e.target===cy1){clearFade(cy1);} });
  cy1.on("mouseover","node",e=>{const l=letterById[e.target.id()];
    showTip(`<b>${esc(l.title)}</b><br>${l.date_iso||""} · ${esc(l.topic)}<br>${l.n_signatories.toLocaleString()} signatories`,e.originalEvent);});
  cy1.on("mouseover","edge",e=>{const d=e.target.data();
    showTip(`${d.shared} shared signers · Jaccard ${d.jaccard} · overlap ${d.overlap}`,e.originalEvent);});
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
  else opt={name:LNAME,animate:false,idealEdgeLength:90,nodeRepulsion:9000};
  cy1.layout(opt).run(); }
function buildLegend(){ const el=document.getElementById("legend-letters"); let items;
  if(state.colorMode==="theme")items=Object.entries(THEME_COLORS);
  else if(state.colorMode==="year")items=[["≤2012","#5b8def"],["2013–2022","#8e6fd8"],["2024","#e0607e"],["2025–26","#e8a33d"]];
  else items=[["systemwide","#76b7b2"],["UCB","#2b6cb0"],["UCLA","#c05621"],["UCSD","#9b2c2c"],["UCSC","#4c51bf"],["other","#9c9c9c"]];
  el.innerHTML="<div style='font-weight:600;margin-bottom:4px'>node colour · size = #signatories</div>"+
    items.map(([k,c])=>`<div class="row"><span class="sw" style="background:${c}"></span>${esc(k)}</div>`).join(""); }

/* ===================== MATRIX ===================== */
const sharedLU={}, jacLU={};
LE.forEach(e=>{ (sharedLU[e.source]=sharedLU[e.source]||{})[e.target]=e.shared; (sharedLU[e.target]=sharedLU[e.target]||{})[e.source]=e.shared;
  (jacLU[e.source]=jacLU[e.source]||{})[e.target]=e.jaccard; (jacLU[e.target]=jacLU[e.target]||{})[e.source]=e.jaccard; });
let mxOrder="cluster", mxMetric="shared";
function drawMatrix(){
  const ids=ORD[mxOrder]||ORD.date, n=ids.length, svg=document.getElementById("matrix");
  const cell=20, padL=210, padT=210, W=padL+n*cell+20, H=padT+n*cell+20;
  const maxShared=Math.max(1,...LE.map(e=>e.shared));
  svg.setAttribute("width",W); svg.setAttribute("height",H); svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  const NS="http://www.w3.org/2000/svg"; let out="";
  ids.forEach((id,i)=>{ const l=letterById[id], yy=padT+i*cell+cell-6;
    out+=`<text x="${padL-6}" y="${yy}" text-anchor="end" font-size="10" fill="#111" data-row="${id}" style="cursor:pointer">${esc(trunc(shortTitle(l),30))}</text>`;
    out+=`<text transform="translate(${padL+i*cell+14},${padT-6}) rotate(-55)" font-size="10" fill="#111" data-col="${id}" style="cursor:pointer">${esc(trunc(shortTitle(l),30))}</text>`; });
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){ const a=ids[i],b=ids[j]; let fill,val;
    if(i===j){ fill=letterColor(letterById[a],"theme"); val="self ("+letterById[a].n_signatories+")"; }
    else { const sv=(sharedLU[a]&&sharedLU[a][b])||0; const jv=(jacLU[a]&&jacLU[a][b])||0;
      val=mxMetric==="shared"?sv:jv; const t=mxMetric==="shared"?(sv/maxShared):jv;
      fill=sv===0?"#eef1f5":`rgba(106,166,255,${0.12+0.88*Math.sqrt(t)})`; }
    const sel=state.sel&&state.sel.t==="L"&&(state.sel.id===a||state.sel.id===b);
    out+=`<rect x="${padL+j*cell}" y="${padT+i*cell}" width="${cell-1}" height="${cell-1}" fill="${fill}" `+
      `stroke="${sel?"#1a73e8":"none"}" data-a="${a}" data-b="${b}" style="cursor:pointer"></rect>`; }
  svg.innerHTML=out;
  svg.querySelectorAll("rect").forEach(r=>{ const a=r.dataset.a,b=r.dataset.b;
    r.addEventListener("mousemove",ev=>{ if(a===b){showTip(`<b>${esc(shortTitle(letterById[a]))}</b><br>${letterById[a].n_signatories} signatories`,ev);return;}
      const sv=(sharedLU[a]&&sharedLU[a][b])||0, jv=(jacLU[a]&&jacLU[a][b])||0;
      showTip(`<b>${esc(shortTitle(letterById[a]))}</b> &cap; <b>${esc(shortTitle(letterById[b]))}</b><br>${sv} shared signers · Jaccard ${jv}`,ev); });
    r.addEventListener("mouseleave",hideTip);
    r.addEventListener("click",()=>{ if(a===b){switchView("bipartite");focusLetter(a);} else {switchView("bipartite");focusIntersection(a,b);} }); });
  svg.querySelectorAll("[data-row],[data-col]").forEach(t=>t.addEventListener("click",()=>selectLetter(t.dataset.row||t.dataset.col)));
}
function trunc(s,n){ return s.length>n?s.slice(0,n-1)+"…":s; }

/* ===================== BIPARTITE ===================== */
let cy2=null, bpCap=80;
function initBip(){ cy2=cytoscape({container:document.getElementById("cy-bip"),elements:[],
  style:baseStyle(),layout:{name:LNAME,animate:false},wheelSensitivity:0.2});
  cy2.on("tap","node.L",e=>{expandLetter(e.target.id());letterPanel(e.target.id());});
  cy2.on("tap","node.Pp",e=>{expandPerson(e.target.id());personPanel(e.target.id());});
  cy2.on("mouseover","node.Pp",e=>{const pp=personById[e.target.id()];showTip(`<b>${esc(e.target.data("label"))}</b>${pp&&pp.dept?"<br>"+esc(pp.dept):""}<br>signed ${(INC.byPerson[e.target.id()]||[]).length} letters`,e.originalEvent);});
  cy2.on("mouseover","node.L",e=>showTip(`<b>${esc(letterById[e.target.id()]?letterById[e.target.id()].title:e.target.id())}</b>`,e.originalEvent));
  cy2.on("mouseout",hideTip);
}
function bipAddLetter(id){ if(cy2.$id(id).length)return; const l=letterById[id];
  cy2.add({group:"nodes",classes:"L",data:{id,label:shortTitle(l)||id,color:THEME_COLORS[theme(l.topic)]}}); }
function bipAddPerson(pid,name,campus){ if(cy2.$id(pid).length)return; const multi=(INC.byPerson[pid]||[]).length>=2;
  cy2.add({group:"nodes",classes:"Pp"+(multi?" multi":""),data:{id:pid,label:name||(personById[pid]&&personById[pid].name)||pid,color:CAMPUS_COLORS[campus]||"#718096"}}); }
function bipLink(l,p){ const id="b_"+l+"__"+p; if(cy2.$id(id).length)return; cy2.add({group:"edges",data:{id,source:l,target:p}}); }
function byConn(sg){ return sg.slice().sort((a,b)=>((INC.byPerson[b.id]||[]).length-(INC.byPerson[a.id]||[]).length)); }
function focusLetter(id){ if(!cy2)initBip(); cy2.elements().remove(); bipAddLetter(id);
  const sg=byConn(INC.byLetter[id]||[]); sg.slice(0,bpCap).forEach(s=>{bipAddPerson(s.id,s.name,s.campus);bipLink(id,s.id);});
  bipRun(); document.getElementById("bp-letter").value=id;
  const multi=sg.filter(s=>(INC.byPerson[s.id]||[]).length>1).length;
  setPanel(`<h2>${esc(letterById[id].title)}</h2><div class="sub">showing ${Math.min(bpCap,sg.length)} of ${sg.length} signers — most-connected first</div><p class="muted">${multi} of these signers also signed other letters (shown first, with a dark ring); click one to add those letters. Raise “Max signers shown” to include more.</p>`); }
function expandLetter(id){ const sg=byConn(INC.byLetter[id]||[]); sg.slice(0,bpCap).forEach(s=>{bipAddPerson(s.id,s.name,s.campus);bipLink(id,s.id);}); bipRun(); }
function expandPerson(pid){ const ls=(INC.byPerson[pid]||[]); ls.forEach(sid=>{ if(letterById[sid]){bipAddLetter(sid);bipLink(sid,pid);} }); bipRun(); }
function focusIntersection(a,b){ if(!cy2)initBip(); cy2.elements().remove(); bipAddLetter(a); bipAddLetter(b);
  const sb=new Set((INC.byLetter[b]||[]).map(s=>s.id)); const both=(INC.byLetter[a]||[]).filter(s=>sb.has(s.id));
  both.slice(0,bpCap*2).forEach(s=>{bipAddPerson(s.id,s.name,s.campus);bipLink(a,s.id);bipLink(b,s.id);}); bipRun();
  setPanel(`<h2>Shared signers</h2><div class="sub">${esc(shortTitle(letterById[a]))} &cap; ${esc(shortTitle(letterById[b]))}</div><div class="kv"><b>${both.length}</b> people signed both${both.length>bpCap*2?` (showing ${bpCap*2})`:""}.</div>`); }
function bipRun(){ cy2.layout({name:LNAME,animate:false,idealEdgeLength:60,nodeRepulsion:6000}).run(); cy2.fit(undefined,30); }

/* ===================== PEOPLE ===================== */
let cy3=null, ppNode=4, ppEdge=5, ppSpace=5;
function initPeople(){ cy3=cytoscape({container:document.getElementById("cy-people"),elements:[],
  style:baseStyle().concat([{selector:"node",style:{"width":n=>15+Math.sqrt(n.data("k"))*6,"height":n=>15+Math.sqrt(n.data("k"))*6}},{selector:"edge",style:{"width":e=>0.4+(e.data("w")||1)*0.7}}]),
  layout:{name:LNAME,animate:false},wheelSensitivity:0.2});
  cy3.on("tap","node",e=>selectPerson(e.target.id()));
  cy3.on("tap","edge",e=>{const d=e.target.data(); edgePanel(d.source,d.target);});
  cy3.on("mouseover","edge",e=>showTip("co-signed "+e.target.data("w")+" letters · click the line for the list",e.originalEvent));
  cy3.on("tap",e=>{if(e.target===cy3)clearFade(cy3);});
  cy3.on("mouseover","node",e=>{const p=personById[e.target.id()];
    showTip(`<b>${esc(p.name)}</b><br>${esc(p.campus_primary||"")}${p.dept?" · "+esc(p.dept):""} · ${p.n_letters} letters`,e.originalEvent);});
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
  cy3.add(nodes.map(p=>({data:{id:p.id,label:p.name,color:CAMPUS_COLORS[p.campus_primary]||"#718096",k:p.n_letters}})));
  cy3.add(edges.map(e=>({data:{id:"pe_"+e[0]+"_"+e[1],source:e[0],target:e[1],w:e[2]}})));
  layoutPeople(); peopleLegend(nodes,edges.length,capped);
}
function peopleLayoutOpts(randomize){ var x=ppSpace; return {name:LNAME,animate:false,
  nodeRepulsion:1000*x*x, idealEdgeLength:14*x*x, nodeSeparation:10*x*x,
  gravity:0.04, gravityRange:6, packComponents:false, numIter:2500, randomize:randomize}; }
function layoutPeople(){ cy3.layout(peopleLayoutOpts(true)).run(); cy3.fit(undefined,40); }
function relayoutRepulsion(){ if(cy3&&cy3.nodes().length) cy3.layout(peopleLayoutOpts(false)).run(); }
function edgePanel(a,b){
  const pa=personById[a]||{name:a}, pb=personById[b]||{name:b};
  const sa=new Set(INC.byPerson[a]||[]); const shared=(INC.byPerson[b]||[]).filter(x=>sa.has(x))
    .sort((x,y)=>String((letterById[x]||{}).date_iso||"").localeCompare(String((letterById[y]||{}).date_iso||"")));
  let h=`<h2>Shared letters</h2><div class="sub">${esc(pa.name)} &harr; ${esc(pb.name)}</div>`;
  h+=`<div class="kv"><b>co-signed</b> ${shared.length} letters</div><ul>`;
  shared.forEach(sid=>{const l=letterById[sid]; if(l) h+=`<li data-letter="${sid}">${l.date_iso||"—"} — ${esc(shortTitle(l))}</li>`;});
  setPanel(h+"</ul>");
}
function peopleLegend(nodes,nedges,capped){ const order=["UCB","UCD","UCI","UCLA","UCM","UCR","UCSD","UCSF","UCSB","UCSC",""];
  const present=[...new Set(nodes.map(p=>p.campus_primary))].filter(c=>c in CAMPUS_COLORS).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  const el=document.getElementById("legend-people"); if(!el)return;
  el.innerHTML="<div style='font-weight:600;margin-bottom:4px'>colour = campus · size = #letters</div>"+
    present.map(c=>`<div class="row"><span class="sw" style="background:${CAMPUS_COLORS[c]}"></span>${c||"unknown"}</div>`).join("")+
    `<div class="row" style="margin-top:5px">${nodes.length} people · ${nedges} ties${capped?" (strongest shown)":""}</div>`; }
function renderConnectors(){ const tb=document.getElementById("connectors-body");
  const rows=P; tb.innerHTML=rows.map((p,i)=>{
    const ls=p.letters.map(s=>letterById[s]).filter(Boolean).map(l=>l.year).filter(Boolean);
    const span=ls.length?Math.min(...ls)+"–"+Math.max(...ls):"";
    return `<tr data-person="${p.id}"><td>${i+1}</td><td>${esc(p.name)}</td><td>${esc(p.campus_primary)}</td><td>${esc(p.dept||"")}</td><td>${p.n_letters}</td><td>${span}</td></tr>`;}).join("");
  tb.querySelectorAll("tr").forEach(tr=>tr.onclick=()=>{ selectPerson(tr.dataset.person); });
}

/* ===================== tabs / init ===================== */
const views={letters:initLetters,matrix:()=>drawMatrix(),bipartite:initBip,people:renderPeople,catalogue:renderCatalogue};
const inited={};
function switchView(v){ state.view=v;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===v));
  document.querySelectorAll(".view").forEach(s=>s.classList.toggle("active",s.id==="view-"+v));
  if(!inited[v]){ inited[v]=true; if(views[v])views[v](); }
  else if(v==="matrix")drawMatrix();
  else if(v==="catalogue")renderCatalogue();
  setTimeout(()=>{ if(v==="letters"&&cy1){cy1.resize();cy1.fit(undefined,30);}
    if(v==="bipartite"&&cy2){cy2.resize();cy2.fit(undefined,30);}
    if(v==="people"&&cy3){cy3.resize();cy3.fit(undefined,30);} },30);
}
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>switchView(t.dataset.view));

/* controls */
document.getElementById("lt-metric").onchange=e=>{state.metric=e.target.value; if(cy1)cy1.style().update();};
const minR=document.getElementById("lt-min");
minR.oninput=e=>{state.minShared=+e.target.value; document.getElementById("lt-minval").textContent=e.target.value; if(cy1)cy1.style().update();};
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
document.getElementById("data-note-toggle").onclick=e=>{e.preventDefault();const d=document.getElementById("data-note");d.hidden=!d.hidden;};
document.getElementById("meta-line").textContent=`${META.n_letters} letters · ${totalSigs.toLocaleString()} signature records · ${META.n_persons_total.toLocaleString()} unique signers · ${META.n_bridgers_ge2.toLocaleString()} signed ≥2`;

/* boot */
switchView("people");

/* ===================== CATALOGUE ===================== */
let catSort="date", catSearch="";
function renderCatalogue(){
  const wrap=document.getElementById("catalogue-wrap"); if(!wrap)return;
  const q=catSearch.toLowerCase();
  let rows=L.slice();
  if(q) rows=rows.filter(l=>((l.title||"")+" "+(l.topic||"")+" "+(l.addressee||"")+" "+(l.type||"")).toLowerCase().includes(q));
  const cmp={date:(a,b)=>String(b.date_iso||"0").localeCompare(String(a.date_iso||"0")),
    signers:(a,b)=>b.n_signatories-a.n_signatories,
    type:(a,b)=>String(a.type).localeCompare(String(b.type)),
    title:(a,b)=>String(a.title).localeCompare(String(b.title))};
  rows.sort(cmp[catSort]||cmp.date);
  const cc=document.getElementById("cat-count"); if(cc) cc.textContent=rows.length+" of "+L.length+" letters";
  let h='<table class="cat-table"><thead><tr><th>Date</th><th>Letter</th><th>Type / stance</th><th>Topic</th><th>Scope</th><th>Signers</th><th>Text</th><th>Source</th></tr></thead><tbody>';
  rows.forEach(l=>{
    const src=l.source_url?`<a href="${esc(l.source_url)}" target="_blank" rel="noopener">link</a>`:esc((l.source_file||"").slice(0,16));
    h+=`<tr data-letter="${l.id}"><td>${l.date_iso||"—"}</td>`
      +`<td><b>${esc(l.title)}</b>${l.addressee?`<div class="muted" style="font-size:11px">to: ${esc(l.addressee)}</div>`:""}</td>`
      +`<td>${esc(l.type)}<div class="muted" style="font-size:11px">${esc(l.stance)}</div></td>`
      +`<td>${esc(l.topic)}</td><td>${esc(l.campus_scope)}</td>`
      +`<td style="text-align:right">${(l.n_signatories||0).toLocaleString()}</td>`
      +`<td>${String(l.text_status||"").indexOf("full")===0?"full":"meta"}</td><td>${src}</td></tr>`;
  });
  wrap.innerHTML=h+"</tbody></table>";
  wrap.querySelectorAll("tr[data-letter]").forEach(tr=>tr.onclick=ev=>{ if(ev.target.tagName==="A")return; switchView("letters"); selectLetter(tr.dataset.letter); });
}
document.getElementById("cat-sort").onchange=e=>{catSort=e.target.value;renderCatalogue();};
document.getElementById("cat-search").oninput=e=>{catSearch=e.target.value;renderCatalogue();};


/* ===================== resizable side panels ===================== */
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

})();
