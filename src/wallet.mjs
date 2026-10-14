const ZERION = 'https://api.zerion.io/v1';

const ALIASES = {
  BTC: ['BTC', 'WBTC', 'CBBTC', 'TBTC', 'BTCB', 'LBTC', 'SOLVBTC', 'FBTC'],
  ETH: ['ETH', 'WETH', 'STETH', 'WSTETH', 'CBETH', 'WEETH', 'RETH', 'EZETH', 'METH'],
  SOL: ['SOL', 'WSOL', 'JITOSOL', 'MSOL'],
  OURO: ['XAUT', 'XAUT0', 'PAXG', 'XAU0'],
  CAIXA: ['USDC', 'USDT', 'DAI', 'USDS', 'USDG', 'PYUSD', 'FDUSD', 'GHO', 'LUSD', 'FRAX', 'USDC.E', 'USDBC', 'EURC', 'RLUSD', 'USD0', 'SUSDS', 'SDAI', 'SGHO'],
};
const SYMBOL_TO_BUCKET = Object.fromEntries(
  Object.entries(ALIASES).flatMap(([bucket, syms]) => syms.map((s) => [s, bucket])),
);

export function bucketOf(symbol, knownBuckets) {
  const s = String(symbol || '').toUpperCase();
  const b = SYMBOL_TO_BUCKET[s] || s;
  return knownBuckets.has(b) ? b : 'OUTROS';
}

export async function fetchPositions(address) {
  const key = process.env.ZERION_API_KEY;
  if (!key) throw new Error('ZERION_API_KEY não definido');
  const url = `${ZERION}/wallets/${address}/positions/?currency=usd&filter[positions]=no_filter&filter[trash]=only_non_trash&sort=value`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', authorization: 'Basic ' + Buffer.from(key + ':').toString('base64') },
  });
  if (!res.ok) throw new Error(`Zerion ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { data } = await res.json();
  return normalize(data);
}

// Turns Zerion positions into flat {symbol, value, type, protocol, chain} rows, dropping duplicated share tokens.
export function normalize(data) {
  const receiptKeys = new Set();
  for (const p of data) {
    const impls = p.attributes?.receipt?.fungible_info?.implementations || [];
    for (const i of impls) receiptKeys.add(`${i.chain_id}:${String(i.address).toLowerCase()}`);
  }
  const rows = [];
  for (const p of data) {
    const a = p.attributes || {};
    const chain = p.relationships?.chain?.data?.id;
    if (a.position_type === 'wallet') {
      if (a.flags?.displayable === false) continue;
      const impl = (a.fungible_info?.implementations || []).find((i) => i.chain_id === chain);
      if (impl && receiptKeys.has(`${chain}:${String(impl.address).toLowerCase()}`)) continue;
    }
    if (a.value == null) continue;
    rows.push({
      symbol: a.fungible_info?.symbol || a.name,
      value: a.value,
      type: a.position_type,
      protocol: a.application_metadata?.name || a.protocol || null,
      chain,
    });
  }
  return rows;
}
