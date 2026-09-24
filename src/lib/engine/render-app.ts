import type { Blueprint } from "@/lib/schemas";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON safe to embed inside a <script> element. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
}

export function safeHex(color: string | undefined, fallback = "#2346d8"): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const NAMES = ["Ava Patel", "Liam Chen", "Noah Garcia", "Mia Johnson", "Arjun Rao", "Sofia Rossi", "Ethan Kim", "Zara Ahmed", "Lucas Silva", "Priya Nair", "Omar Haddad", "Emma Wilson"];
const STATUSES = ["Open", "In review", "Resolved", "Escalated"];
const WORDS = ["Q3 renewal", "Onboarding", "Billing issue", "Refund request", "Access request", "Feature ask", "Contract review", "Chargeback", "Upgrade", "Data export"];

export type SampleRow = Record<string, string | number | boolean>;

export function sampleRows(blueprint: Blueprint, count = 8): SampleRow[] {
  const entity = blueprint.dataModel[0];
  if (!entity) return [];
  const rand = mulberry32(hashString(blueprint.appName + entity.entity));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const base = Date.UTC(2026, 8, 20);
  return Array.from({ length: count }, (_, i) => {
    const row: SampleRow = {};
    for (const f of entity.fields) {
      const key = f.name;
      const lname = key.toLowerCase();
      switch (f.type) {
        case "number":
          row[key] = Math.floor(rand() * 90) + 1;
          break;
        case "currency":
          row[key] = Math.round((rand() * 4800 + 40) * 100) / 100;
          break;
        case "boolean":
          row[key] = rand() > 0.5;
          break;
        case "date":
          row[key] = new Date(base - Math.floor(rand() * 20) * 86400000).toISOString().slice(0, 10);
          break;
        case "email": {
          const n = pick(NAMES).split(" ")[0].toLowerCase();
          row[key] = `${n}@example.com`;
          break;
        }
        case "status":
          row[key] = pick(STATUSES);
          break;
        default:
          row[key] = /name|customer|owner|assignee|user|contact/.test(lname)
            ? pick(NAMES)
            : /id$|number|ref/.test(lname)
              ? `${entity.entity.slice(0, 3).toUpperCase()}-${1040 + i}`
              : pick(WORDS);
      }
    }
    return row;
  });
}

export function renderAppHtml(blueprint: Blueprint): string {
  const accent = safeHex(blueprint.theme?.accent);
  const dark = blueprint.theme?.mode === "dark";
  const e = escapeHtml;
  const rows = sampleRows(blueprint);
  const entity = blueprint.dataModel[0];
  const data = {
    pages: blueprint.pages.map((p) => ({ name: p.name, purpose: p.purpose, components: p.components })),
    agents: blueprint.agents.map((a) => ({ name: a.name, role: a.role, tools: a.tools, trigger: a.trigger })),
    entity: entity ? { name: entity.entity, fields: entity.fields } : null,
    rows,
  };

  return `<!doctype html>
<html lang="en" class="${dark ? "dark" : ""}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e(blueprint.appName)}</title>
<style>
  :root { --accent: ${accent}; --bg: #f8f9fb; --panel: #fff; --ink: #14161b; --muted: #6b7280; --line: #e6e8ee; --soft: color-mix(in srgb, var(--accent) 10%, transparent); }
  .dark { --bg: #0f1116; --panel: #171a21; --ink: #e8eaf0; --muted: #9098a8; --line: #262a33; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); }
  .app { display: grid; grid-template-columns: 232px 1fr; min-height: 100vh; }
  aside { border-right: 1px solid var(--line); background: var(--panel); padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 650; margin: 0 8px 18px; }
  .logo { width: 28px; height: 28px; border-radius: 8px; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 13px; }
  .nav { all: unset; cursor: pointer; padding: 8px 10px; border-radius: 8px; color: var(--muted); display: block; }
  .nav:hover { background: var(--soft); color: var(--ink); }
  .nav[aria-current="page"] { background: var(--soft); color: var(--accent); font-weight: 600; }
  main { padding: 28px 32px; overflow: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); margin: 0; }
  .btn { all: unset; cursor: pointer; background: var(--accent); color: #fff; padding: 9px 14px; border-radius: 9px; font-weight: 600; font-size: 13px; }
  .btn.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
  .kpi .label { color: var(--muted); font-size: 12px; }
  .kpi .value { font-size: 24px; font-weight: 700; margin-top: 4px; letter-spacing: -0.02em; }
  .kpi .delta { font-size: 12px; color: #16a34a; }
  .grid2 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 10px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  tr:hover td { background: var(--soft); }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: var(--soft); color: var(--accent); }
  .pill.Resolved { background: #dcfce7; color: #166534; } .pill.Escalated { background: #fee2e2; color: #991b1b; } .pill.Open { background: #fef3c7; color: #92400e; }
  .agent { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .agent:last-child { border: 0; }
  .dot { width: 8px; height: 8px; border-radius: 99px; background: #22c55e; margin-top: 7px; flex: none; box-shadow: 0 0 0 4px #22c55e22; }
  .chat { display: flex; flex-direction: column; gap: 8px; height: 260px; overflow: auto; margin: 10px 0; }
  .msg { padding: 8px 12px; border-radius: 12px; max-width: 85%; font-size: 13px; }
  .msg.me { align-self: flex-end; background: var(--accent); color: #fff; }
  .msg.bot { align-self: flex-start; background: var(--soft); }
  .row { display: flex; gap: 8px; }
  input { flex: 1; padding: 9px 12px; border-radius: 9px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; }
  .muted { color: var(--muted); font-size: 12px; }
  .section-title { font-weight: 650; margin: 0 0 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .chip { font-size: 11px; padding: 2px 8px; border: 1px solid var(--line); border-radius: 99px; color: var(--muted); }
  .hidden { display: none; }
  @media (max-width: 760px) { .app { grid-template-columns: 1fr; } aside { flex-direction: row; overflow-x: auto; padding: 10px; } .brand { display: none; } .grid2 { grid-template-columns: 1fr; } main { padding: 18px; } }
</style>
</head>
<body>
<div class="app">
  <aside aria-label="Navigation">
    <div class="brand"><div class="logo">${e(blueprint.appName.charAt(0).toUpperCase())}</div><span data-arch-id="brand">${e(blueprint.appName)}</span></div>
    <nav id="nav"></nav>
  </aside>
  <main>
    <header>
      <div>
        <h1 id="page-title" data-arch-id="title"></h1>
        <p class="sub" id="page-purpose"></p>
      </div>
      <div class="row">
        <button class="btn ghost" id="export">Export CSV</button>
        <button class="btn" id="new">+ New ${e(entity?.entity ?? "item")}</button>
      </div>
    </header>
    <section class="kpis" id="kpis"></section>
    <section class="grid2">
      <div class="card">
        <p class="section-title">${e(entity?.entity ?? "Records")}s</p>
        <div style="overflow:auto"><table id="table"></table></div>
      </div>
      <div class="card">
        <p class="section-title">Agents</p>
        <div id="agents"></div>
        <div class="chat" id="chat" aria-live="polite"></div>
        <form class="row" id="ask"><input id="q" placeholder="Ask your agents…" aria-label="Ask your agents" /><button class="btn">Send</button></form>
      </div>
    </section>
    <p class="muted" style="margin-top:18px">${e(blueprint.tagline)}</p>
  </main>
</div>
<script id="arch-data" type="application/json">${jsonForScript(data)}</script>
<script>
(function(){
  var D = JSON.parse(document.getElementById('arch-data').textContent);
  function el(t, a, txt){ var n=document.createElement(t); if(a) for(var k in a) n.setAttribute(k,a[k]); if(txt!=null) n.textContent=txt; return n; }
  var current = 0;
  function renderNav(){
    var nav=document.getElementById('nav'); nav.innerHTML='';
    D.pages.forEach(function(p,i){ var b=el('button',{class:'nav'},p.name); if(i===current) b.setAttribute('aria-current','page'); b.onclick=function(){current=i;renderNav();renderPage();}; nav.appendChild(b); });
  }
  function renderPage(){
    var p=D.pages[current]||{name:'Home',purpose:''};
    document.getElementById('page-title').textContent=p.name;
    document.getElementById('page-purpose').textContent=p.purpose;
  }
  function renderKpis(){
    var k=document.getElementById('kpis'); k.innerHTML='';
    var rows=D.rows, total=rows.length, open=0, money=0, moneyField=null;
    if(D.entity){ D.entity.fields.forEach(function(f){ if(f.type==='currency'&&!moneyField) moneyField=f.name; }); }
    rows.forEach(function(r){ for(var key in r){ if(r[key]==='Open'||r[key]==='Escalated') open++; } if(moneyField) money+=Number(r[moneyField])||0; });
    var items=[[ (D.entity?D.entity.name:'Record')+'s', String(total*37), '+12% this week'],['Needs attention', String(open*5), '−8% vs last week'],[moneyField?'Total '+moneyField:'Automation rate', moneyField? '$'+Math.round(money).toLocaleString() : '64%', '+4.1%'],['Agents live', String(D.agents.length), 'All healthy']];
    items.forEach(function(it){ var c=el('div',{class:'card kpi'}); c.appendChild(el('div',{class:'label'},it[0])); c.appendChild(el('div',{class:'value'},it[1])); c.appendChild(el('div',{class:'delta'},it[2])); k.appendChild(c); });
  }
  function renderTable(){
    var t=document.getElementById('table'); t.innerHTML=''; if(!D.entity) return;
    var thead=el('thead'), tr=el('tr'); D.entity.fields.forEach(function(f){ tr.appendChild(el('th',null,f.name)); }); thead.appendChild(tr); t.appendChild(thead);
    var tb=el('tbody'); D.rows.forEach(function(r){ var row=el('tr'); D.entity.fields.forEach(function(f){ var v=r[f.name]; var td=el('td'); if(f.type==='status'){ td.appendChild(el('span',{class:'pill '+String(v).replace(/\\s/g,'')},String(v))); } else if(f.type==='currency'){ td.textContent='$'+Number(v).toFixed(2); } else if(f.type==='boolean'){ td.textContent=v?'Yes':'No'; } else { td.textContent=String(v); } row.appendChild(td); }); tb.appendChild(row); }); t.appendChild(tb);
  }
  function renderAgents(){
    var a=document.getElementById('agents'); a.innerHTML='';
    D.agents.forEach(function(ag){ var r=el('div',{class:'agent'}); r.appendChild(el('span',{class:'dot','aria-hidden':'true'})); var body=el('div'); body.appendChild(el('div',{style:'font-weight:600'},ag.name)); body.appendChild(el('div',{class:'muted'},ag.role)); var chips=el('div',{class:'chips'}); ag.tools.forEach(function(t){ chips.appendChild(el('span',{class:'chip'},t)); }); body.appendChild(chips); r.appendChild(body); a.appendChild(r); });
  }
  function say(text, who){ var c=document.getElementById('chat'); c.appendChild(el('div',{class:'msg '+who},text)); c.scrollTop=c.scrollHeight; }
  document.getElementById('ask').addEventListener('submit', function(ev){
    ev.preventDefault(); var q=document.getElementById('q'); var v=q.value.trim(); if(!v) return; say(v,'me'); q.value='';
    var ag=D.agents[0]; setTimeout(function(){ say((ag?ag.name:'Agent')+': On it — I checked '+(D.entity?D.rows.length+' '+D.entity.name.toLowerCase()+'s':'your data')+' and drafted next steps for “'+v.slice(0,60)+'”.', 'bot'); }, 700);
  });
  document.getElementById('export').onclick=function(){ say('Exported '+D.rows.length+' rows to CSV.','bot'); };
  document.getElementById('new').onclick=function(){ say('New record form opened (demo).','bot'); };
  renderNav(); renderPage(); renderKpis(); renderTable(); renderAgents();
  if(D.agents[0]) say(D.agents[0].name+' is ready. Trigger: '+D.agents[0].trigger+'.','bot');
})();
</script>
</body>
</html>`;
}
