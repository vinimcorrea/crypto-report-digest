const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const h2 = (t) =>
  `<h2 style="font-size:18px;margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid #f59e0b;color:#111">${t}</h2>`;

const ACTION_COLORS = { hold: '#6b7280', buy: '#16a34a', sell: '#dc2626' };

function renderLives(lives = []) {
  if (!lives.length) return '';
  return (
    h2('🎙️ Lives da semana') +
    lives
      .map(
        (l) => `
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:#f59e0b;letter-spacing:.5px">${esc(l.label)}</div>
        <div style="font-size:16px;font-weight:600;margin:4px 0 8px">${esc(l.schedule)}</div>
        <ul style="margin:0;padding-left:20px">${(l.bullets || [])
          .map((b) => `<li style="margin-bottom:6px">${esc(b)}</li>`)
          .join('')}</ul>
      </div>`,
      )
      .join('')
  );
}

function renderMarket(m) {
  if (!m) return '';
  let out = h2('📊 Portfólio e recomendações');
  if (m.fearGreed != null)
    out += `<p><strong>Medo e ganância: ${esc(m.fearGreed)}</strong>. ${esc(m.fearGreedComment)}</p>`;
  if (m.portfolio?.length) {
    out += `<table style="width:100%;border-collapse:collapse;font-size:14px">${m.portfolio
      .map(
        (p) => `<tr style="border-bottom:1px solid #eee">
          <td style="padding:6px 0"><strong>${esc(p.ticker)}</strong> <span style="color:#6b7280">${esc(p.asset)}</span></td>
          <td style="padding:6px 0;text-align:right">${esc(p.price)}</td>
          <td style="padding:6px 0 6px 12px;text-align:right;font-weight:700;color:${ACTION_COLORS[p.type] || '#111'}">${esc(p.action)}</td>
        </tr>`,
      )
      .join('')}</table>`;
  }
  if (m.portfolioDate) out += `<p style="font-size:12px;color:#6b7280">${esc(m.portfolioDate)}</p>`;
  if (m.portfolioFootnote) out += `<p>${esc(m.portfolioFootnote)}</p>`;
  if (m.macroIndicators?.length)
    out += `<p style="font-size:13px">${m.macroIndicators
      .map((i) => `<strong>${esc(i.label)}</strong>: ${esc(i.value)} (${esc(i.change)})`)
      .join(' · ')}</p>`;
  return out;
}

function renderNews(news) {
  const arts = news?.articles || [];
  if (!arts.length) return '';
  return (
    h2('📰 Notícias') +
    arts
      .map(
        (a) => `<div style="margin-bottom:14px">
        <span style="font-size:11px;font-weight:700;color:${esc(a.color || '#f59e0b')}">${esc(a.tag)}</span>
        <div style="font-weight:600">${esc(a.title)}</div>
        <div style="font-size:14px;color:#374151">${esc(a.body)}</div></div>`,
      )
      .join('')
  );
}

function renderYields(y) {
  if (!y?.stats?.length) return '';
  return (
    h2('💰 Rendimentos') +
    `<ul style="padding-left:20px">${y.stats
      .map((s) => `<li><strong>${esc(s.label)}</strong>: ${esc(s.value)}<br><span style="font-size:13px;color:#6b7280">${esc(s.sub)}</span></li>`)
      .join('')}</ul>`
  );
}

function renderOnchain(o) {
  if (!o?.articleTitle) return '';
  return h2('🔗 On-chain') + `<p><strong>${esc(o.articleTitle)}</strong></p>${o.card1?.intro ? `<p>${esc(o.card1.intro)}</p>` : ''}`;
}

function renderTips(t) {
  if (!t?.topic) return '';
  const body = Array.isArray(t.howItWorksBody) ? t.howItWorksBody : t.howItWorksBody ? [t.howItWorksBody] : [];
  return h2('🛡️ Dica da semana') + `<p><strong>${esc(t.topic)}</strong></p>${body.map((p) => `<p>${esc(p)}</p>`).join('')}`;
}

const PROFILE_LABEL = { conservador: '🟢 Conservador', neutro: '🟡 Neutro', agressivo: '🔴 Agressivo' };
const usd = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const pct = (n) => `${(n ?? 0).toFixed(0)}%`;
const scoreColor = (s) => (s >= 80 ? '#16a34a' : s >= 60 ? '#f59e0b' : '#dc2626');

function renderWallet(w) {
  if (!w) return '';
  if (w.error) return h2('🧭 Sua carteira vs. estratégia') + `<p style="color:#dc2626">Não foi possível analisar a carteira: ${esc(w.error)}</p>`;
  const { address, analysis: a, strategy: s } = w;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const buckets = Object.entries(a.weights).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));

  let out = h2('🧭 Sua carteira vs. estratégia');
  out += `<p style="font-size:14px"><a href="https://debank.com/profile/${esc(address)}">${esc(short)}</a> · patrimônio líquido <strong>${usd(a.netWorth)}</strong>`;
  if (a.debt > 0) out += ` · garantia ${usd(a.collateral)} · dívida ${usd(a.debt)} (${pct(a.ltvPct)} emprestado)`;
  out += `</p>`;
  out += `<p style="font-size:14px;color:#374151">${esc(s.resumoEstrategia)}</p>`;
  if (!s.perfisExplicitos)
    out += `<p style="font-size:12px;color:#6b7280;background:#fef3c7;padding:8px;border-radius:4px">⚠️ O report ainda não publica percentuais por perfil. Os perfis abaixo foram derivados do que foi dito: ${esc(s.derivacao)}</p>`;

  out += `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0">
    <tr style="background:#f9fafb"><th style="text-align:left;padding:6px">Ativo</th><th style="text-align:right;padding:6px">Atual</th>${['conservador', 'neutro', 'agressivo']
      .map((p) => `<th style="text-align:right;padding:6px">${PROFILE_LABEL[p].split(' ')[1]}</th>`)
      .join('')}</tr>
    ${[...new Set([...buckets.map(([b]) => b), ...a.profiles.flatMap((p) => Object.keys(p.alocacao))])]
      .filter((b) => Math.abs(a.weights[b] || 0) >= 0.5 || a.profiles.some((p) => (p.alocacao[b] || 0) >= 0.5))
      .map(
        (b) => `<tr style="border-bottom:1px solid #eee"><td style="padding:6px"><strong>${esc(b)}</strong></td>
        <td style="text-align:right;padding:6px">${pct(a.weights[b])}</td>
        ${a.profiles.map((p) => `<td style="text-align:right;padding:6px;color:#6b7280">${pct(p.alocacao[b])}</td>`).join('')}</tr>`,
      )
      .join('')}
  </table>`;
  if (a.topOutros.length)
    out += `<p style="font-size:12px;color:#6b7280">OUTROS = fora da estratégia: ${a.topOutros.map(([s, v]) => `${esc(s)} (${usd(v)})`).join(', ')}</p>`;

  for (const p of a.profiles) {
    out += `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin:12px 0">
      <div style="display:flex;justify-content:space-between"><strong>${PROFILE_LABEL[p.name]}</strong>
        <span style="font-size:20px;font-weight:700;color:${scoreColor(p.score)}">${p.score}% aderente</span></div>
      <div style="font-size:13px;color:#6b7280;margin:4px 0 8px">${esc(p.descricao)}</div>
      <ul style="margin:0;padding-left:18px;font-size:13px">
        ${p.checks.map((c) => `<li>${c.ok ? '✅' : '⚠️'} ${esc(c.text)}</li>`).join('')}
      </ul>
      ${
        p.changes.length || p.checks.some((c) => c.fix)
          ? `<div style="font-size:13px;margin-top:8px"><strong>O que mudar:</strong><ul style="margin:4px 0;padding-left:18px">
          ${p.checks.filter((c) => c.fix).map((c) => `<li>${esc(c.fix)}</li>`).join('')}
          ${p.changes
            .map(
              (c) =>
                `<li>${c.usd > 0 ? '⬆️ Aumentar' : '⬇️ Reduzir'} <strong>${esc(c.bucket)}</strong> de ${pct(c.actual)} para ${pct(c.target)} (${c.usd > 0 ? '+' : '-'}${usd(Math.abs(c.usd))})</li>`,
            )
            .join('')}</ul></div>`
          : '<div style="font-size:13px;margin-top:8px">Nada a mudar 🎯</div>'
      }
    </div>`;
  }
  if (s.regrasGerais?.length)
    out += `<p style="font-size:13px"><strong>Regras citadas no report:</strong></p><ul style="font-size:13px;padding-left:18px">${s.regrasGerais
      .map((r) => `<li>${esc(r)}</li>`)
      .join('')}</ul>`;
  out += `<p style="font-size:11px;color:#9ca3af">Aderência = 80% alocação (100 − metade da soma das diferenças em p.p., com exposição líquida de dívida) + 20% regras. Os perfis são extraídos por IA do conteúdo do report. Não é recomendação de investimento.</p>`;
  return out;
}

export function renderEdition(ed, siteUrl, wallet) {
  const name = process.env.REPORT_NAME || 'Crypto Report';
  const url = `${siteUrl}/edition/${ed.slug}`;
  const subject = `${name} #${ed.editionNumber ?? ''} (${ed.displayDate ?? ed.slug}): resumo das lives`;
  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6">
  <div style="max-width:640px;margin:0 auto;background:#fff;padding:24px 28px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
    <div style="font-size:12px;color:#6b7280">Edição #${esc(ed.editionNumber)} · ${esc(ed.displayDate)}</div>
    <h1 style="font-size:24px;margin:4px 0 0">${esc(name)}</h1>
    ${renderWallet(wallet)}
    ${renderLives(ed.lives)}
    ${renderMarket(ed.market)}
    ${renderNews(ed.news)}
    ${renderYields(ed.yields)}
    ${renderOnchain(ed.onchain)}
    ${renderTips(ed.tips)}
    <p style="margin-top:32px;text-align:center"><a href="${esc(url)}" style="background:#f59e0b;color:#111;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Ver edição completa</a></p>
  </div></body></html>`;
  return { subject, html };
}
