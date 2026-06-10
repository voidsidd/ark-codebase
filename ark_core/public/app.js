const state={events:[],reports:[],stats:{total_incidents:0,total_cost_usd:0,avg_latency_ms:0,memory_hits:0},telemetry:[],statuses:{},graph:{nodes:[],edges:[]},sse:null,counters:{},pendingRemoval:new Set(),hiddenCompleted:new Set()};
const safe=(v)=>String(v??"").replace(/[<>&]/g,(s)=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[s]));
const money=(v)=>`$${Number(v||0).toFixed(5)}`;
const fmtTime=(v)=>{try{return new Date(v).toLocaleString();}catch{return String(v||"-")}};

function parseImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('gs://')) {
    return url.replace('gs://', 'https://storage.googleapis.com/');
  }
  return url;
}

function animate(id,target,fmt){const el=document.getElementById(id);if(!el)return;const from=state.counters[id]??0;const t0=performance.now();(function f(n){const p=Math.min(1,(n-t0)/420);const val=from+(target-from)*p;el.textContent=fmt(val);if(p<1)requestAnimationFrame(f);else state.counters[id]=target;})(t0)}

function updateHeaderStats(){const s=state.stats;animate("mIncidents",s.total_incidents||0,(v)=>`${Math.round(v)}`);animate("mLatency",s.avg_latency_ms||0,(v)=>`${Math.round(v)}ms`);animate("mCost",s.total_cost_usd||0,(v)=>money(v));animate("mMemory",s.memory_hits||0,(v)=>`${Math.round(v)}`);const a=document.getElementById("headIncidents"),b=document.getElementById("headCost"),c=document.getElementById("headLatency");if(a)a.textContent=`${s.total_incidents||0} INCIDENTS`;if(b)b.textContent=`${money(s.total_cost_usd)} COST`;if(c)c.textContent=`${Math.round(s.avg_latency_ms||0)}MS LAT`;}

function findEventByReport(report){return state.events.find((e)=>e.id===report.event_id) || null;}

function renderEvents(){
  const root=document.getElementById("eventList");if(!root)return;
  const queued = state.events.filter((e)=>!state.hiddenCompleted.has(e.id));
  if(!queued.length){root.innerHTML=`<div class="event-desc">All queued events processed. Refresh page to repopulate.</div>`;return;}
  root.innerHTML=queued.map((e)=>{
    const snapshotImg = e.snapshot_url ? `<img src="${safe(parseImageUrl(e.snapshot_url))}" alt="Threat Snapshot" style="width: 100%; border-radius: 4px; margin-top: 10px;"/>` : '';
    return `<article class="event ${state.pendingRemoval.has(e.id) ? "completing" : ""}" data-id="${safe(e.id)}"><div class="event-top"><span>${safe(e.source)}</span><span class="sev">${safe(e.severity)}</span><span>${safe(e.event_type)}</span></div><div class="event-loc">${safe(e.location)}</div><div class="event-desc">${safe(e.description)}</div>${snapshotImg}<div class="event-desc" style="margin-top: 8px;">Status: ${safe(state.statuses[e.id]||"idle")}</div></article>`;
  }).join("");
  root.querySelectorAll(".event").forEach((el)=>el.addEventListener("click",()=>{const id=el.getAttribute("data-id");if(id)runSingle(id);}));
}

function markEventComplete(eventId){
  if(state.pendingRemoval.has(eventId) || state.hiddenCompleted.has(eventId)) return;
  state.pendingRemoval.add(eventId);
  renderEvents();
  setTimeout(()=>{
    state.pendingRemoval.delete(eventId);
    state.hiddenCompleted.add(eventId);
    renderEvents();
  },850);
}

function reportMetaGrid(report,event){
  return `
    <div class="report-grid">
      <div><span class="r-k">Incident</span><span class="r-v">${safe(report.event_id)}</span></div>
      <div><span class="r-k">Source</span><span class="r-v">${safe(event?.source||"unknown")}</span></div>
      <div><span class="r-k">Type</span><span class="r-v">${safe(event?.event_type||"unknown")}</span></div>
      <div><span class="r-k">Severity</span><span class="r-v">${safe(report.severity||"unknown")}</span></div>
      <div><span class="r-k">Where</span><span class="r-v">${safe(event?.location||"unknown")}</span></div>
      <div><span class="r-k">When</span><span class="r-v">${safe(fmtTime(event?.timestamp||report.timestamp))}</span></div>
    </div>
  `;
}

function renderReports(){
  const root=document.getElementById("reportList");if(!root)return;
  const count=document.getElementById("reportCount");if(count)count.textContent=`${state.reports.length} reports`;
  if(!state.reports.length){root.innerHTML=`<div class="event-desc">No reports yet.</div>`;return;}

  root.innerHTML=state.reports.map((r)=>{
    const event = findEventByReport(r);
    const hitsCount = Array.isArray(r.memory_hits) ? r.memory_hits.length : 0;
    const snapshotImg = event?.snapshot_url ? `<img src="${safe(parseImageUrl(event.snapshot_url))}" alt="Threat Snapshot" style="width: 100%; border-radius: 4px; margin-top: 10px;"/>` : '';
    return `
      <article class="report" data-event="${safe(r.event_id)}">
        <div class="r-top"><span>${safe(r.event_id)}</span><span>${safe(fmtTime(r.timestamp))}</span></div>
        ${reportMetaGrid(r,event)}
        ${snapshotImg}
        <div class="r-main">${safe(r.summary)}</div>
        <div class="r-label">Pattern Intelligence</div>
        <div class="r-text r-pattern">${safe(r.pattern)}</div>
        <div class="r-label">Recommended Action Plan</div>
        <div class="r-text">${safe(r.recommended_action)}</div>
        <div class="r-foot">${safe(r.model_used)} · ${Math.round(r.latency_ms)}ms · ${money(r.cost_usd)} · memory hits ${hitsCount} · confidence ${Math.round((Number(r.confidence||0))*100)}%</div>
      </article>
    `;
  }).join("");

  root.querySelectorAll(".report").forEach((el)=>el.addEventListener("click",()=>{const id=el.getAttribute("data-event");const r=state.reports.find((x)=>x.event_id===id);if(r){state.graph=r.memory_graph||{nodes:[],edges:[]};drawGraph();}}));
}

function graphDetails(g){
  const nodeLines = (g.nodes||[]).slice(0,8).map((n)=>`<li><strong>${safe(n.id)}</strong> · ${safe(n.source||"n/a")} · ${safe(n.location||"unknown")} · ${safe(n.timestamp?fmtTime(n.timestamp):"unknown-time")}</li>`).join("");
  const edgeLines = (g.edges||[]).slice(0,8).map((e)=>`<li><strong>${safe(e.source)}</strong> → <strong>${safe(e.target)}</strong> · ${(Number(e.weight||0)*100).toFixed(0)}% · ${safe(e.reason||"link")}</li>`).join("");
  return `<div class="graph-meta"><div><div class="r-label">Node Context</div><ul>${nodeLines || "<li>No nodes</li>"}</ul></div><div><div class="r-label">Edge Reasoning</div><ul>${edgeLines || "<li>No edges</li>"}</ul></div></div>`;
}

function drawGraph(){
  const root=document.getElementById("graphCanvas");if(!root)return;
  const w=Math.max(360,root.clientWidth||400),h=Math.max(240,Math.floor((root.clientHeight||320)*0.62));
  const g=state.graph;
  if(!g.nodes||!g.nodes.length){root.innerHTML=`<div style="padding:10px;color:#aaa;font-size:12px">No graph available yet.</div>`;return;}

  const pos=new Map(),cx=w/2,cy=h/2;
  g.nodes.forEach((n,i)=>{if(n.is_current)pos.set(n.id,{x:cx,y:cy});else{const a=(Math.PI*2*i)/Math.max(1,g.nodes.length-1),r=Math.min(w,h)*0.35;pos.set(n.id,{x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r});}});

  const edges=g.edges.map((e)=>{const a=pos.get(e.source),b=pos.get(e.target);if(!a||!b)return"";const op=Math.max(0.2,Math.min(0.9,e.weight));return`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(255,255,255,${op})" stroke-width="${1+op}"/>`;}).join("");
  const nodes=g.nodes.map((n)=>{const p=pos.get(n.id),fill=n.is_current?"#fff":"#ccc";return`<g><circle cx="${p.x}" cy="${p.y}" r="${n.is_current?12:9}" fill="${fill}"/><text x="${p.x+10}" y="${p.y-10}" fill="#ddd" font-size="10" font-family="Space Grotesk, sans-serif">${safe(n.id)}</text></g>`;}).join("");

  root.innerHTML=`<div class="graph-shell"><svg viewBox="0 0 ${w} ${h}">${edges}${nodes}</svg>${graphDetails(g)}</div>`;
}

function spark(canvas,values,label,unit){
  if(!canvas)return;
  const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;
  canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);

  const plotLeft=34, plotRight=w-8, plotTop=10, plotBottom=h-20;
  ctx.strokeStyle="rgba(255,255,255,.22)";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(plotLeft,plotBottom);ctx.lineTo(plotRight,plotBottom);ctx.stroke();
  ctx.beginPath();ctx.moveTo(plotLeft,plotTop);ctx.lineTo(plotLeft,plotBottom);ctx.stroke();

  if(!values.length){
    ctx.fillStyle="rgba(255,255,255,.5)";ctx.font="10px Space Grotesk";ctx.fillText(`${label}: no data`,plotLeft+6,plotTop+12);
    return;
  }

  const min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min);
  const ticks=[0,0.5,1];
  ctx.fillStyle="rgba(255,255,255,.6)";ctx.font="10px Space Grotesk";
  ticks.forEach((t)=>{
    const y=plotBottom - t*(plotBottom-plotTop);
    const val=min + t*span;
    ctx.strokeStyle="rgba(255,255,255,.08)";ctx.beginPath();ctx.moveTo(plotLeft,y);ctx.lineTo(plotRight,y);ctx.stroke();
    ctx.fillText(`${val.toFixed(unit==="$"?5:0)}${unit}`,2,y+3);
  });

  ctx.strokeStyle="#fff";ctx.lineWidth=1.8;ctx.beginPath();
  values.forEach((v,i)=>{const x=plotLeft+(i/Math.max(1,values.length-1))*(plotRight-plotLeft);const y=plotBottom-((v-min)/span)*(plotBottom-plotTop);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
  ctx.stroke();

  const latest=values[values.length-1];
  ctx.fillStyle="#fff";ctx.fillText(`${label} latest: ${latest.toFixed(unit==="$"?5:0)}${unit}`,plotLeft+6,plotTop+12);
}

function updateSparks(){
  spark(document.getElementById("latencySpark"),state.telemetry.slice(-40).map((x)=>Number(x.latency_ms||0)),"Latency","ms");
  spark(document.getElementById("costSpark"),state.telemetry.slice(-40).map((x)=>Number(x.cost_usd||0)),"Cost","$");
}

function log(line){const el=document.getElementById("streamLog");if(!el)return;const ts=new Date().toLocaleTimeString();el.textContent=`[${ts}] ${line}\n`+el.textContent;el.textContent=el.textContent.split("\n").slice(0,80).join("\n");}

function exportReports(){
  const payload = {
    exported_at: new Date().toISOString(),
    total_reports: state.reports.length,
    reports: state.reports
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const a = document.createElement("a");
  a.href = url;
  a.download = `axon-reports-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function runSingle(eventId){state.statuses[eventId]="processing";renderEvents();try{const r=await fetch("/api/process",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId})});if(!r.ok)throw new Error("failed");}catch{state.statuses[eventId]="failed";renderEvents();}}
function runNext(){const next=state.events.find((e)=>!["processing","complete"].includes(state.statuses[e.id]||"idle"));if(next)runSingle(next.id)}
async function runAll(){const btn=document.getElementById("runAllBtn");if(btn)btn.disabled=true;try{await fetch("/api/process-all",{method:"POST"});}finally{if(btn)btn.disabled=false;}}

function handleStream(type,p){
  if(type==="ingest"&&p.event){
    if(!state.events.find(e=>e.id===p.event.id)){
      state.events.unshift(p.event);
      state.statuses[p.event.id]="idle";
      renderEvents();
    }
  }
  if(type==="processing"){if(p.eventId){state.statuses[p.eventId]=p.stage==="queued"?"queued":"processing";renderEvents();}log(`processing ${p.eventId||"batch"} ${p.stage||""}`)}
  if(type==="report"&&p.report){const r=p.report;state.reports.unshift(r);state.statuses[r.event_id]="complete";markEventComplete(r.event_id);renderReports();state.graph=r.memory_graph||{nodes:[],edges:[]};drawGraph();log(`report complete ${r.event_id}`)}
  if(type==="stats"){if(p.stats)state.stats=p.stats;if(p.telemetry)state.telemetry=p.telemetry;updateHeaderStats();updateSparks();}
  if(type==="error"){if(p.eventId)state.statuses[p.eventId]="failed";renderEvents();log(`error ${p.eventId||""} ${p.message||""}`)}
}

function connectSSE(){if(state.sse)state.sse.close();const es=new EventSource("/api/stream");state.sse=es;["ingest","processing","report","stats","error","heartbeat"].forEach((t)=>es.addEventListener(t,(ev)=>{const msg=JSON.parse(ev.data);handleStream(t,msg.payload||{});}));es.onerror=()=>log("sse reconnecting...");}

async function bootstrap(){
  const [events,stats,tele,reports]=await Promise.all([fetch("/api/events"),fetch("/api/stats"),fetch("/api/telemetry"),fetch("/api/reports")]);
  state.events=await events.json();state.stats=await stats.json();state.telemetry=await tele.json();state.reports=await reports.json();
  state.events.forEach((e)=>{if(!state.statuses[e.id])state.statuses[e.id]="idle";});
  state.pendingRemoval.clear();
  state.hiddenCompleted.clear();
  renderEvents();renderReports();updateHeaderStats();updateSparks();
  if(state.reports[0]?.memory_graph){state.graph=state.reports[0].memory_graph;}
  drawGraph();
}

function wireCommonButtons(){
  const a=document.getElementById("runNextBtn"),b=document.getElementById("runAllBtn"),x=document.getElementById("exportReportsBtn");
  if(a)a.addEventListener("click",runNext);if(b)b.addEventListener("click",runAll);
  if(x)x.addEventListener("click",exportReports);
  document.addEventListener("keydown",(e)=>{if(e.key.toLowerCase()==="r"&&e.shiftKey){e.preventDefault();runAll();}else if(e.key.toLowerCase()==="r"){e.preventDefault();runNext();}else if(e.key.toLowerCase()==="m"){const g=document.getElementById("graph");if(g)g.scrollIntoView({behavior:"smooth",block:"start"});}});
  window.addEventListener("resize",()=>{drawGraph();updateSparks();});
}

async function init(){wireCommonButtons();await bootstrap();connectSSE();log("Ark Core live stream connected");}
window.ArkCoreApp={init,runNext,runAll};
