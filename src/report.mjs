// Self-contained interactive report sent as an e-mail attachment.
// No external resources: it opens offline and never leaks the wallet to a third party.
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const CSS = `
:root{--bg:#0b1020;--card:#121a33;--line:#24304f;--muted:#94a3b8;--fg:#e5e7eb;--amber:#f59e0b;--ok:#22c55e;--mid:#f59e0b;--bad:#ef4444}
@media (prefers-color-scheme:light){:root{--bg:#f3f4f6;--card:#fff;--line:#e5e7eb;--muted:#6b7280;--fg:#111827}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:28px 20px 60px}
header{display:flex;flex-wrap:wrap;gap:16px;align-items:end;justify-content:space-between;margin-bottom:20px}
h1{margin:0;font-size:28px}h2{font-size:18px;margin:0 0 12px}.muted{color:var(--muted)}.small{font-size:12px}
.pill{display:inline-block;font-size:12px;font-weight:700;color:#111;background:var(--amber);border-radius:99px;padding:2px 10px}
.grid{display:grid;gap:16px}.g3{grid-template-columns:repeat(3,1fr)}.g2{grid-template-columns:1fr 1fr}
@media (max-width:760px){.g3,.g2{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.score{cursor:pointer;text-align:center;transition:transform .15s,border-color .15s}.score:hover{transform:translateY(-2px)}
.score.active{border-color:var(--amber);box-shadow:0 0 0 1px var(--amber) inset}
.score b{display:block;font-size:13px;margin-top:6px}
.stats{display:flex;gap:22px;flex-wrap:wrap}.stats div b{display:block;font-size:20px}
.row{display:grid;grid-template-columns:90px 1fr 110px;gap:10px;align-items:center;margin:8px 0;font-size:13px}
.bar{position:relative;height:14px;background:var(--line);border-radius:99px;overflow:hidden}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--amber)}
.bar u{position:absolute;top:-3px;bottom:-3px;width:3px;background:var(--fg);border-radius:2px}
.tabs{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.btn{display:inline-block;text-decoration:none}.tabs button,.btn{background:transparent;color:var(--fg);border:1px solid var(--line);border-radius:99px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}
.tabs button.active,.btn:hover{background:var(--amber);color:#111;border-color:var(--amber)}
ul{padding-left:18px;margin:6px 0}li{margin:4px 0}
.up{color:var(--ok)}.down{color:var(--bad)}
input[type=range]{width:100%;accent-color:var(--amber)}
.sim{display:grid;grid-template-columns:80px 1fr 120px;gap:10px;align-items:center;font-size:13px;margin:6px 0}
details{border-top:1px solid var(--line);padding:12px 0}summary{cursor:pointer;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:6px 4px;border-bottom:1px solid var(--line)}
.legend{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;margin-top:10px}.legend span:before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;background:var(--c)}
footer{margin-top:28px;font-size:12px;color:var(--muted)}
`;

// Runs in the reader's browser. Mirrors the scoring in analyze.mjs (allocation part + borrowing/cash checks).
const JS = `
const D = JSON.parse(document.getElementById('data').textContent);
const LABEL = {conservador:'🟢&nbsp; Conservador',neutro:'🟡&nbsp; Neutro',agressivo:'🔴&nbsp; Agressivo'};
const COLORS = ['#f59e0b','#6366f1','#22c55e','#06b6d4','#ec4899','#a855f7','#84cc16','#f97316','#64748b'];
const $ = (s) => document.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const usd = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('pt-BR',{maximumFractionDigits:0});
const pct = (n) => (n ?? 0).toFixed(0) + '%';
const color = (s) => s >= 80 ? 'var(--ok)' : s >= 60 ? 'var(--mid)' : 'var(--bad)';
const a = D.analysis;
let current = a.profiles.reduce((x, p) => p.score > x.score ? p : x).name;
let sim = {...a.exposure}, simDebt = a.debt, simKeys = [];

function ring(score, size = 92) {
  const r = size/2 - 8, c = 2*Math.PI*r;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="var(--line)" stroke-width="9"/>'+
    '<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+color(score)+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+(c*score/100)+' '+c+'" transform="rotate(-90 '+size/2+' '+size/2+')"/>'+
    '<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="currentColor" font-size="'+size/4.2+'" font-weight="800">'+score+'%</text></svg>';
}
function donut(weights) {
  const e = Object.entries(weights).filter(([,v]) => v > 0.3).sort((x,y) => y[1]-x[1]);
  const r = 70, c = 2*Math.PI*r; let off = 0, segs = '', leg = '';
  e.forEach(([k,v],i) => { const col = COLORS[i % COLORS.length];
    segs += '<circle cx="90" cy="90" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="26" stroke-dasharray="'+(c*v/100)+' '+c+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 90 90)"><title>'+h(k)+' '+pct(v)+'</title></circle>';
    off += c*v/100; leg += '<span style="--c:'+col+'">'+h(k)+' '+pct(v)+'</span>'; });
  return '<svg width="180" height="180" viewBox="0 0 180 180">'+segs+'</svg><div class="legend">'+leg+'</div>';
}
function scoreFor(p, exposure, debt) {
  const total = Object.values(exposure).reduce((s,v) => s+v, 0) || 1;
  const w = Object.fromEntries(Object.entries(exposure).map(([k,v]) => [k, v/total*100]));
  let tvd = 0;
  for (const b of new Set([...Object.keys(p.alocacao), ...Object.keys(w)])) tvd += Math.abs((p.alocacao[b]||0) - (w[b]||0))/2;
  const ltv = a.collateral ? debt / a.collateral * 100 : 0;
  const checks = [ltv <= p.emprestimoMaxPct + 0.5, p.checks[1].ok, (w.CAIXA||0) >= (p.alocacao.CAIXA||0) - 5];
  return { score: Math.round(0.8*Math.max(0,100-tvd) + 0.2*checks.filter(Boolean).length/checks.length*100), w, ltv };
}
function renderScores() {
  $('#scores').innerHTML = a.profiles.map(p => '<div class="card score'+(p.name===current?' active':'')+'" data-p="'+p.name+'">'+ring(p.score)+'<b>'+LABEL[p.name]+'</b><div class="small muted">'+h(p.descricao)+'</div></div>').join('');
  document.querySelectorAll('.score').forEach(el => el.onclick = () => { current = el.dataset.p; renderAll(); });
}
function renderProfile() {
  const p = a.profiles.find(x => x.name === current);
  $('#tabs').innerHTML = a.profiles.map(x => '<button class="'+(x.name===current?'active':'')+'" data-p="'+x.name+'">'+LABEL[x.name]+'</button>').join('');
  document.querySelectorAll('#tabs button').forEach(el => el.onclick = () => { current = el.dataset.p; renderAll(); });
  const buckets = [...new Set([...Object.keys(a.weights), ...Object.keys(p.alocacao)])].filter(b => (a.weights[b]||0) >= .5 || (p.alocacao[b]||0) >= .5)
    .sort((x,y) => Math.max(a.weights[y]||0, p.alocacao[y]||0) - Math.max(a.weights[x]||0, p.alocacao[x]||0));
  const max = Math.max(...buckets.map(b => Math.max(a.weights[b]||0, p.alocacao[b]||0)), 1);
  $('#bars').innerHTML = buckets.map(b => { const cur = a.weights[b]||0, tgt = p.alocacao[b]||0, d = tgt-cur;
    return '<div class="row"><b>'+h(b)+'</b><div class="bar" title="atual '+pct(cur)+' · alvo '+pct(tgt)+'"><i style="width:'+(cur/max*100)+'%"></i><u style="left:calc('+(tgt/max*100)+'% - 1px)"></u></div>'+
      '<span>'+pct(cur)+' → '+pct(tgt)+' <span class="'+(d>=0?'up':'down')+'">'+(Math.abs(d)>=1?(d>0?'▲':'▼'):'')+'</span></span></div>'; }).join('') +
    '<div class="row"><b>Empréstimo</b><div class="bar"><i style="width:'+Math.min(100,a.ltvPct)+'%;background:var(--bad)"></i><u style="left:calc('+p.emprestimoMaxPct+'% - 1px)"></u></div><span>'+pct(a.ltvPct)+' / até '+pct(p.emprestimoMaxPct)+'</span></div>'+
    '<div class="small muted">Barra = atual · traço = alvo do perfil · empréstimo em % da garantia</div>';
  const fixes = p.checks.filter(c => c.fix).map(c => '<li>'+h(c.fix)+'</li>').join('');
  $('#todo').innerHTML = '<h2>O que mudar · '+LABEL[p.name]+'</h2><ul>'+p.checks.map(c => '<li>'+(c.ok?'✅':'⚠️')+' '+h(c.text)+'</li>').join('')+'</ul>'+
    ((fixes || p.changes.length) ? '<ul>'+fixes+p.changes.map(c => '<li class="'+(c.usd>0?'up':'down')+'">'+(c.usd>0?'⬆️ Aumentar':'⬇️ Reduzir')+' <b>'+h(c.bucket)+'</b> de '+pct(c.actual)+' para '+pct(c.target)+' ('+(c.usd>0?'+':'-')+usd(Math.abs(c.usd))+')</li>').join('')+'</ul>' : '<p>Nada a mudar 🎯</p>') +
    '<button class="btn" id="apply">Simular carteira já ajustada a este perfil</button>';
  $('#apply').onclick = () => { const total = a.totalAssets; sim = Object.fromEntries(Object.keys({...a.exposure, ...p.alocacao}).map(b => [b, (p.alocacao[b]||0)/100*total]));
    simDebt = Math.min(a.debt, p.emprestimoMaxPct/100*a.collateral); renderSim(); $('#sim').scrollIntoView({behavior:'smooth'}); };
}
function renderSim() {
  const keys = Object.keys(sim).sort((x,y) => (a.exposure[y]||0) - (a.exposure[x]||0));
  const top = Math.max(a.totalAssets, ...Object.values(sim));
  $('#sliders').innerHTML = keys.map((k, i) => '<div class="sim"><b>'+h(k)+'</b><input type="range" min="0" max="'+Math.ceil(top)+'" step="10" value="'+Math.round(sim[k])+'" data-i="'+i+'"><span id="v-'+i+'"></span></div>').join('') +
    (a.collateral ? '<div class="sim"><b>Dívida</b><input type="range" min="0" max="'+Math.ceil(Math.max(a.debt, a.collateral*.6))+'" step="10" value="'+Math.round(simDebt)+'" id="debt"><span id="v-debt"></span></div>' : '');
  simKeys = keys;
  document.querySelectorAll('#sliders input[data-i]').forEach(el => el.oninput = () => { sim[keys[el.dataset.i]] = +el.value; updateSim(); });
  const d = $('#debt'); if (d) d.oninput = () => { simDebt = +d.value; updateSim(); };
  updateSim();
}
function updateSim() {
  const res = a.profiles.map(p => ({ p, ...scoreFor(p, sim, simDebt) }));
  const w = res[0].w;
  simKeys.forEach((k, i) => $('#v-'+i).textContent = usd(sim[k]) + ' · ' + pct(w[k]));
  if ($('#v-debt')) $('#v-debt').textContent = usd(simDebt) + ' · ' + pct(res[0].ltv);
  $('#simscores').innerHTML = res.map(r => { const d = r.score - r.p.score;
    return '<div class="card" style="text-align:center">'+ring(r.score, 80)+'<b style="display:block;font-size:13px">'+LABEL[r.p.name]+'</b><span class="small '+(d>0?'up':d<0?'down':'muted')+'">'+(d>0?'+':'')+d+' p.p. vs. hoje</span></div>'; }).join('');
  $('#simdonut').innerHTML = donut(w);
}
function renderAll() { renderScores(); renderProfile(); }
$('#donut').innerHTML = donut(a.weights);
$('#reset').onclick = () => { sim = {...a.exposure}; simDebt = a.debt; renderSim(); };
renderAll(); renderSim();
`;

function editionSections(ed) {
  const out = [];
  if (ed.lives?.length)
    out.push(`<details open><summary>🎙️ Lives da semana</summary>${ed.lives
      .map((l) => `<p><span class="pill">${esc(l.label)}</span> <b>${esc(l.schedule)}</b></p><ul>${(l.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`)
      .join('')}</details>`);
  const m = ed.market;
  if (m?.portfolio?.length)
    out.push(`<details><summary>📊 Portfólio e recomendações</summary>${m.fearGreed != null ? `<p>Medo e ganância: <b>${esc(m.fearGreed)}</b>. ${esc(m.fearGreedComment)}</p>` : ''}
      <table>${m.portfolio.map((p) => `<tr><td><b>${esc(p.ticker)}</b> <span class="muted">${esc(p.asset)}</span></td><td>${esc(p.price)}</td><td class="${p.type === 'buy' ? 'up' : p.type === 'sell' ? 'down' : 'muted'}" style="text-align:right;font-weight:700">${esc(p.action)}</td></tr>`).join('')}</table>
      ${m.portfolioFootnote ? `<p class="small muted">${esc(m.portfolioFootnote)}</p>` : ''}</details>`);
  return out.join('');
}

export function renderReport(ed, wallet, siteUrl) {
  const name = process.env.REPORT_NAME || 'Crypto Report';
  if (!wallet?.analysis) return null;
  const { analysis: a, strategy: s, address } = wallet;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const data = { analysis: a };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} #${esc(ed.editionNumber)} · relatório interativo</title><style>${CSS}</style></head><body><div class="wrap">
<header><div><span class="pill">Edição #${esc(ed.editionNumber)} · ${esc(ed.displayDate)}</span><h1>${esc(name)}</h1>
<div class="muted">Relatório interativo da carteira ${esc(short)}</div></div>
<div class="stats"><div><span class="small muted">Ativos</span><b>$${Math.round(a.totalAssets).toLocaleString('pt-BR')}</b></div>
${a.debt > 0 ? `<div><span class="small muted">Dívida</span><b>$${Math.round(a.debt).toLocaleString('pt-BR')}</b></div><div><span class="small muted">Patrimônio líquido</span><b>$${Math.round(a.netWorth).toLocaleString('pt-BR')}</b></div>` : ''}</div></header>
<p class="muted">${esc(s.resumoEstrategia)}</p>
<div id="scores" class="grid g3"></div>
<div class="grid g2" style="margin-top:16px">
  <div class="card"><div id="tabs" class="tabs"></div><div id="bars"></div></div>
  <div class="card"><h2>Alocação atual</h2><div id="donut"></div></div>
</div>
<div class="card" id="todo" style="margin-top:16px"></div>
<div class="card" id="sim" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">🧪 Simulador: e se eu mudar a carteira?</h2><button class="btn" id="reset">Voltar para a carteira atual</button></div>
  <p class="small muted">Arraste os valores para ver a aderência de cada perfil mudar em tempo real. Nada sai do seu computador.</p>
  <div class="grid g2"><div id="sliders"></div><div><div id="simscores" class="grid g3"></div><div id="simdonut" style="margin-top:12px"></div></div></div>
</div>
<div class="card" style="margin-top:16px">${editionSections(ed)}
  ${siteUrl ? `<p><a class="btn" href="${esc(`${siteUrl}/edition/${ed.slug}`)}">Ver edição completa ↗</a></p>` : ''}</div>
<footer>Aderência = 80% alocação (100 − metade da soma das diferenças em p.p.) + 20% regras. Perfis extraídos por IA do conteúdo do report. Não é recomendação de investimento.</footer>
</div><script type="application/json" id="data">${json(data)}</script><script>(() => {${JS}})();</script></body></html>`;
}
