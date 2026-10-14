import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fetchEditions, SITE_URL } from './extract.mjs';
import { renderEdition } from './render.mjs';
import { fetchPositions } from './wallet.mjs';
import { extractStrategy } from './strategy.mjs';
import { analyze } from './analyze.mjs';

const STATE_FILE = new URL('../state/last-sent.txt', import.meta.url);
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
// --preview: sends the email with a [PRÉVIA] tag and does not record state (safe for testing in CI without artifacts).
const preview = args.has('--preview');
const force = args.has('--force') || preview;

async function sendEmail({ subject, html }) {
  const { RESEND_API_KEY, EMAIL_TO } = process.env;
  const EMAIL_FROM = process.env.EMAIL_FROM || `${process.env.REPORT_NAME || 'Crypto Report'} <onboarding@resend.dev>`;
  if (!RESEND_API_KEY || !EMAIL_TO) throw new Error('RESEND_API_KEY/EMAIL_TO não definidos');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: EMAIL_TO.split(',').map((s) => s.trim()), subject, html }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body}`);
  console.log('E-mail enviado:', body);
}

// EDITIONS_FIXTURE lets you run the whole pipeline offline (demo, CI, screenshots).
const editions = process.env.EDITIONS_FIXTURE
  ? JSON.parse(await readFile(process.env.EDITIONS_FIXTURE, 'utf8'))
  : await fetchEditions();
const latest = editions.at(-1);
const lastSent = (await readFile(STATE_FILE, 'utf8').catch(() => '')).trim();
console.log(`Edição mais recente: ${latest.slug} | última enviada: ${lastSent || '(nenhuma)'}`);

if (!force && !dryRun && lastSent && latest.slug <= lastSent) {
  console.log('Nada novo para enviar.');
  process.exit(0);
}

async function walletReport() {
  const address = process.env.WALLET_ADDRESS;
  if (!address) return null;
  try {
    const positions = process.env.WALLET_FIXTURE
      ? JSON.parse(await readFile(process.env.WALLET_FIXTURE, 'utf8'))
      : await fetchPositions(address);
    const strategy = process.env.STRATEGY_FIXTURE
      ? JSON.parse(await readFile(process.env.STRATEGY_FIXTURE, 'utf8'))
      : await extractStrategy(editions);
    return { address, strategy, analysis: analyze(positions, strategy) };
  } catch (err) {
    // Only the message is logged: CI logs must never contain wallet data.
    console.error('Análise da carteira falhou:', err.message);
    return { address, error: err.message };
  }
}

const wallet = await walletReport();
const email = renderEdition(latest, SITE_URL, wallet);
if (preview) email.subject = '[PRÉVIA] ' + email.subject;
if (dryRun) {
  await writeFile('preview.html', email.html);
  console.log(`Prévia salva em preview.html (assunto: ${email.subject})`);
} else {
  await sendEmail(email);
  if (preview) process.exit(0);
  await mkdir(new URL('../state/', import.meta.url), { recursive: true });
  await writeFile(STATE_FILE, latest.slug + '\n');
}
