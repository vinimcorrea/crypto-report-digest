const ENDPOINT = process.env.LLM_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODELS = [process.env.LLM_MODEL || 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SYSTEM = `Você é um analista que extrai, de forma fiel, as estratégias de investimento cripto publicadas em um report semanal de cripto (resumos das lives, portfólio de referência, caixa sugerido, rendimentos, dicas).
Regras:
- Use SOMENTE o que está nos textos. Dê mais peso à edição mais recente.
- Se o report define explicitamente perfis conservador/neutro/agressivo com percentuais, use-os e marque "perfisExplicitos": true.
- Caso contrário, DERIVE os três perfis a partir das faixas publicadas (ex.: caixa sugerido 15%-30%, portfólio montado nas lives, faixa de empréstimo na AAVE), com conservador no extremo mais seguro, agressivo no mais arriscado e neutro no meio. Marque "perfisExplicitos": false e explique a derivação em "derivacao".
- Chaves de alocação: tickers em MAIÚSCULAS (BTC, ETH, AAVE, ...), "CAIXA" para stablecoins, "OURO" para ouro tokenizado (XAUT/PAXG) e "OUTROS" para ativos fora da estratégia, que deve ser SEMPRE 0. Todo ativo citado na estratégia ganha sua própria chave com o ticker oficial (ex.: Aerodrome = AERO, Hyperliquid = HYPE, Uniswap = UNI, Jupiter = JUP, Sky = SKY, Pendle = PENDLE, Ethena = ENA). Cada alocação soma exatamente 100.
- As alocações são % do PATRIMÔNIO LÍQUIDO: dívida (empréstimo em stablecoin) é subtraída de CAIXA, e o dinheiro emprestado aplicado em pools conta pelos ativos da pool (ex.: pool ouro/USDG = metade OURO, metade CAIXA). Por isso, um perfil alavancado pode ter CAIXA líquido baixo.
- "emprestimoMaxPct" = maior % do valor da garantia que pode estar emprestado (0 se o perfil não usa empréstimo).
- "evitar" = tickers ou protocolos que o report mandou evitar/vender.
Responda apenas JSON no formato:
{"edicaoBase":"YYYY-MM-DD","perfisExplicitos":bool,"derivacao":"...","resumoEstrategia":"2-3 frases",
 "perfis":{"conservador":{"descricao":"...","alocacao":{"CAIXA":n,...},"emprestimoMaxPct":n,"regras":["..."]},"neutro":{...},"agressivo":{...}},
 "evitar":["..."],"regrasGerais":["..."]}`;

function compact(ed) {
  const { slug, displayDate, lives, market, yields, tips, news } = ed;
  return {
    slug,
    displayDate,
    lives: lives?.map(({ label, schedule, bullets }) => ({ label, schedule, bullets })),
    market: market && {
      fearGreed: market.fearGreed,
      portfolio: market.portfolio,
      portfolioDate: market.portfolioDate,
      portfolioFootnote: market.portfolioFootnote,
    },
    yields: yields?.stats,
    tips: tips && { topic: tips.topic, body: tips.howItWorksBody },
    news: news?.articles?.map((a) => a.title),
  };
}

function validate(s) {
  for (const name of ['conservador', 'neutro', 'agressivo']) {
    const p = s?.perfis?.[name];
    if (!p?.alocacao) throw new Error(`Perfil ${name} ausente na resposta do modelo`);
    const total = Object.values(p.alocacao).reduce((a, b) => a + Number(b || 0), 0);
    if (total <= 0) throw new Error(`Alocação vazia em ${name}`);
    // Normalize to 100 in case the model is slightly off.
    for (const k of Object.keys(p.alocacao)) p.alocacao[k] = (Number(p.alocacao[k] || 0) * 100) / total;
    p.alocacao.OUTROS ??= 0;
    if (p.alocacao.OUTROS > 0) console.warn(`Perfil ${name} tem ${p.alocacao.OUTROS.toFixed(0)}% em OUTROS`);
    p.emprestimoMaxPct = Number(p.emprestimoMaxPct || 0);
  }
  s.evitar ??= [];
  return s;
}

export async function extractStrategy(editions, { lookback = 4 } = {}) {
  const token = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
  if (!token) throw new Error('GEMINI_API_KEY não definido');
  const recent = editions.slice(-lookback).map(compact);
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: 'Edições (mais antiga → mais recente):\n' + JSON.stringify(recent) },
  ];
  // Gemini often returns 503/429 under load or malformed JSON: retry with backoff, then fall back to other models.
  let lastError;
  for (const model of [...new Set(MODELS)]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' }, messages }),
        });
        const raw = await res.text();
        if (!res.ok) {
          lastError = new Error(`LLM ${model} ${res.status}: ${raw.slice(0, 200)}`);
          if (![429, 500, 503].includes(res.status)) break;
        } else {
          const content = JSON.parse(raw).choices[0].message.content.replace(/^```(?:json)?\s*|\s*```$/g, '');
          const strategy = validate(JSON.parse(content));
          console.log(`Estratégia extraída com ${model}`);
          return strategy;
        }
      } catch (err) {
        lastError = new Error(`LLM ${model}: ${err.message}`);
      }
      console.warn(`${lastError.message.slice(0, 120)} (tentativa ${attempt + 1})`);
      await sleep(5000 * 2 ** attempt);
    }
  }
  throw lastError;
}
