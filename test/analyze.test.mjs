import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze } from '../src/analyze.mjs';
import { renderReport } from '../src/report.mjs';
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

test('weights are a non-negative share of total assets, debt kept apart', () => {
  const a = analyze(positions, strategy);
  const total = Object.values(a.weights).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 100) < 0.5, `sum = ${total}`);
  for (const [k, v] of Object.entries(a.weights)) assert.ok(v >= 0, `${k} = ${v}`);
  assert.ok(a.debt > 0);
  assert.equal(Math.round(a.netWorth), Math.round(a.totalAssets - a.debt));
});

test('a loan does not change the allocation, only the borrowing check', () => {
  const noLoan = analyze(positions.filter((r) => r.type !== 'loan'), strategy);
  const withLoan = analyze(positions, strategy);
  assert.deepEqual(withLoan.weights, noLoan.weights);
  const cons = withLoan.profiles.find((p) => p.name === 'conservador');
  assert.equal(cons.checks[0].ok, false);
});

test('renders the e-mail with the wallet section', () => {
  const wallet = { address: '0x000000000000000000000000000000000000dEaD', strategy, analysis: analyze(positions, strategy) };
  const { subject, html } = renderEdition(edition, 'https://example.com', wallet);
  assert.match(subject, /#1/);
  assert.match(html, /aderente/);
  assert.match(html, /Lives da semana/);
});

test('interactive report is self-contained and escapes token names', () => {
  const evil = positions.map((r, i) => (i === 0 ? { ...r, symbol: '<img src=x onerror=alert(1)>' } : r));
  const wallet = { address: '0x000000000000000000000000000000000000dEaD', strategy, analysis: analyze(evil, strategy) };
  const html = renderReport(edition, wallet, 'https://example.com');
  assert.match(html, /Simulador/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
  assert.equal(renderReport(edition, null), null);
});
