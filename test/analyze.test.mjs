import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze } from '../src/analyze.mjs';
import { renderEdition } from '../src/render.mjs';

const load = async (f) => JSON.parse(await readFile(new URL(f, import.meta.url), 'utf8'));
const positions = await load('./wallet-fixture.json');
const strategy = await load('./strategy-fixture.json');
const [edition] = await load('./editions-fixture.json');

test('scores every profile between 0 and 100', () => {
  const a = analyze(positions, strategy);
  assert.deepEqual(a.profiles.map((p) => p.name), ['conservador', 'neutro', 'agressivo']);
  for (const p of a.profiles) assert.ok(p.score >= 0 && p.score <= 100, `${p.name}: ${p.score}`);
});

test('weights are a share of net worth', () => {
  const a = analyze(positions, strategy);
  const total = Object.values(a.weights).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 100) < 0.5, `sum = ${total}`);
  assert.ok(a.debt > 0 && a.netWorth > 0);
});

test('renders the e-mail with the wallet section', () => {
  const wallet = { address: '0x000000000000000000000000000000000000dEaD', strategy, analysis: analyze(positions, strategy) };
  const { subject, html } = renderEdition(edition, 'https://example.com', wallet);
  assert.match(subject, /#1/);
  assert.match(html, /aderente/);
  assert.match(html, /Lives da semana/);
});
