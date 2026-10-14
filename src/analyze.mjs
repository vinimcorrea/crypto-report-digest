import { bucketOf } from './wallet.mjs';

const PROFILES = ['conservador', 'neutro', 'agressivo'];
const MIN_DIFF_PP = 2;

export function analyze(rows, strategy) {
  const known = new Set(PROFILES.flatMap((p) => Object.keys(strategy.perfis[p].alocacao)));
  known.add('CAIXA');

  const exposure = {};
  const outrosTokens = {};
  let collateral = 0;
  let debt = 0;
  for (const r of rows) {
    const bucket = bucketOf(r.symbol, known);
    // Allocation is a share of total assets; debt is tracked separately (borrowing-limit check).
    if (r.type === 'loan') {
      debt += r.value;
      continue;
    }
    exposure[bucket] = (exposure[bucket] || 0) + r.value;
    if (r.type === 'deposit' && r.protocol && /aave|compound|morpho|spark|fluid|euler/i.test(r.protocol)) collateral += r.value;
    if (bucket === 'OUTROS') outrosTokens[r.symbol] = (outrosTokens[r.symbol] || 0) + r.value;
  }
  const totalAssets = Object.values(exposure).reduce((a, b) => a + b, 0);
  const netWorth = totalAssets - debt;
  const weights = Object.fromEntries(Object.entries(exposure).map(([k, v]) => [k, totalAssets ? (v / totalAssets) * 100 : 0]));
  const ltvPct = collateral > 0 ? (debt / collateral) * 100 : 0;

  const avoid = new Set(strategy.evitar.map((s) => String(s).toUpperCase()));
  const heldAvoided = rows
    .filter((r) => r.type !== 'loan' && r.value >= 1 && (avoid.has(String(r.symbol).toUpperCase()) || avoid.has(String(r.protocol).toUpperCase())))
    .map((r) => r.symbol);

  const profiles = PROFILES.map((name) => {
    const p = strategy.perfis[name];
    const buckets = new Set([...Object.keys(p.alocacao), ...Object.keys(weights)]);
    let tvd = 0;
    const changes = [];
    for (const b of buckets) {
      const actual = weights[b] || 0;
      const target = p.alocacao[b] || 0;
      const diff = target - actual;
      tvd += Math.abs(diff) / 2;
      if (Math.abs(diff) >= MIN_DIFF_PP) changes.push({ bucket: b, actual, target, usd: (diff / 100) * totalAssets });
    }
    changes.sort((a, b) => Math.abs(b.usd) - Math.abs(a.usd));
    const allocScore = Math.max(0, 100 - tvd);

    const checks = [
      {
        ok: ltvPct <= p.emprestimoMaxPct + 0.5,
        text: p.emprestimoMaxPct > 0
          ? `Empréstimo em ${ltvPct.toFixed(0)}% da garantia (limite do perfil: ${p.emprestimoMaxPct}%)`
          : `Perfil sem empréstimo; carteira tem ${ltvPct.toFixed(0)}% da garantia emprestada`,
        fix: ltvPct > p.emprestimoMaxPct
          ? `Quitar ~$${fmt(debt - (p.emprestimoMaxPct / 100) * collateral)} da dívida`
          : null,
      },
      {
        ok: heldAvoided.length === 0,
        text: heldAvoided.length ? `Possui ativos que o report mandou evitar: ${heldAvoided.join(', ')}` : 'Nenhum ativo da lista "evitar"',
        fix: heldAvoided.length ? `Sair de ${heldAvoided.join(', ')}` : null,
      },
      {
        ok: (weights.CAIXA || 0) >= (p.alocacao.CAIXA || 0) - 5,
        text: `Caixa (stablecoins) em ${(weights.CAIXA || 0).toFixed(0)}% (alvo ${(p.alocacao.CAIXA || 0).toFixed(0)}%)`,
        fix: null,
      },
    ];
    const rulesScore = (checks.filter((c) => c.ok).length / checks.length) * 100;
    return {
      name,
      descricao: p.descricao,
      regras: p.regras || [],
      score: Math.round(0.8 * allocScore + 0.2 * rulesScore),
      allocScore: Math.round(allocScore),
      changes,
      checks,
      alocacao: p.alocacao,
      emprestimoMaxPct: p.emprestimoMaxPct,
    };
  });

  const topOutros = Object.entries(outrosTokens).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { totalAssets, netWorth, weights, exposure, collateral, debt, ltvPct, profiles, topOutros };
}

export const fmt = (n) => Math.abs(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
