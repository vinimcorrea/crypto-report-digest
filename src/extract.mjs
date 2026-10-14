import vm from 'node:vm';

const BASE = (process.env.REPORT_BASE_URL || '').replace(/\/$/, '');

function authHeaders() {
  const { REPORT_USER, REPORT_PASS } = process.env;
  if (!REPORT_USER || !REPORT_PASS) throw new Error('REPORT_USER/REPORT_PASS não definidos');
  return { Authorization: 'Basic ' + Buffer.from(`${REPORT_USER}:${REPORT_PASS}`).toString('base64') };
}

async function get(path) {
  if (!BASE) throw new Error('REPORT_BASE_URL não definido');
  const res = await fetch(BASE + path, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.text();
}

// Walks a JS source from an opening bracket to its matching close, skipping strings/template literals.
function matchBracket(src, start) {
  const stack = [];
  let i = start;
  while (i < src.length) {
    const c = src[i];
    const top = stack[stack.length - 1];
    if (top === '`') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') stack.pop();
      else if (c === '$' && src[i + 1] === '{') { stack.push('${'); i++; }
    } else if (top === '"' || top === "'") {
      if (c === '\\') { i += 2; continue; }
      if (c === top) stack.pop();
    } else if (c === '`' || c === '"' || c === "'") {
      stack.push(c);
    } else if (c === '[' || c === '{' || c === '(') {
      stack.push(c);
    } else if (c === ']' || c === '}' || c === ')') {
      stack.pop();
      if (stack.length === 0) return i;
    }
    i++;
  }
  throw new Error('Colchete sem fechamento');
}

export async function fetchEditions() {
  const html = await get('/');
  const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!m) throw new Error('Bundle JS não encontrado no HTML');
  const js = await get(m[1]);

  const first = js.indexOf('{slug:`');
  if (first < 0) throw new Error('Dados das edições não encontrados no bundle');
  const start = js.lastIndexOf('[', first);
  const end = matchBracket(js, start);
  const editions = vm.runInNewContext('(' + js.slice(start, end + 1) + ')', {}, { timeout: 2000 });
  return editions
    .filter((e) => e && typeof e.slug === 'string')
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export const SITE_URL = BASE;
