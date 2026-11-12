// Tests du générateur de jetons (node --test design/tokens.test.mjs, ou npm run tokens:test depuis mobile/).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PATHS, contrast, contrastRows, expectedOutputs, loadTokens, renderAppJson, renderCss, renderTs, resolveColors, validate } from './build-tokens.mjs';

const tokens = () => loadTokens();
const lf = (s) => s.replace(/\r\n/g, '\n');

test('contraste : valeurs de référence WCAG', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrast('#FFFFFF', '#FFFFFF').toFixed(2), '1.00');
  // Direction B (docs/design/01-direction.md) : texte sur fond, clair.
  assert.equal(contrast('#12201F', '#FBFAF6').toFixed(2), '16.06');
});

test('tokens.json : valide pour les quatre directions', () => {
  assert.deepEqual(validate(tokens()), []);
});

test('une paire de texte sous 4,5:1 fait échouer la validation, avec le nom de la paire et le rapport', () => {
  const t = tokens();
  t.directions.B.color.light.textMuted = '#B0B8B6';
  const errors = validate(t);
  assert.ok(errors.some((e) => /\[B\/light\] contraste textMuted sur bg = \d\.\d{3}:1 \(minimum 4\.5:1\)/.test(e)), errors.join('\n'));
});

test('un contour de contrôle sous 3:1 fait échouer la validation', () => {
  const t = tokens();
  t.directions.C.color.dark.borderStrong = '#2A2536';
  assert.ok(validate(t).some((e) => /\[C\/dark\] contraste borderStrong sur (bg|surface)/.test(e)));
});

test("un rôle de couleur manquant ou un alias cassé est refusé", () => {
  const t = tokens();
  delete t.directions.A.color.dark.accent;
  t.directions.B.color.light.info = '=nexistepas';
  const errors = validate(t);
  assert.ok(errors.some((e) => e.includes('[A/dark] rôle de couleur manquant : accent')));
  assert.ok(errors.some((e) => e.includes('alias info')));
});

test('activeDirection absente refusée ; changer de direction change les sorties', () => {
  const t = tokens();
  t.activeDirection = 'Z';
  assert.ok(validate(t).some((e) => e.includes('activeDirection')));
  const u = tokens();
  u.activeDirection = 'C';
  assert.deepEqual(validate(u), []);
  assert.match(renderTs(u), /primary: '#1F1B2E'/);
  assert.match(renderTs(u), /export const radius = \{ sm: 4, md: 6, lg: 10, pill: 999 \}/);
});

test('alias résolus : info = verified, passNeutral = textMuted, skeleton = border', () => {
  const c = resolveColors(tokens(), 'B');
  for (const mode of ['light', 'dark']) {
    assert.equal(c[mode].info, c[mode].verified);
    assert.equal(c[mode].passNeutral, c[mode].textMuted);
    assert.equal(c[mode].skeleton, c[mode].border);
  }
});

test('sortie déterministe : deux rendus identiques, clés de couleur triées, fins de ligne LF', () => {
  const t = tokens();
  assert.equal(renderTs(t), renderTs(t));
  assert.equal(renderCss(t), renderCss(t));
  const ts = renderTs(t);
  assert.ok(!ts.includes('\r'));
  const block = ts.split('light: {')[1].split('},')[0];
  const names = [...block.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(names, [...names].sort());
});

test('tokens.css : un seul bloc sombre (web/tools/check-links.py découpe sur cette chaîne) et variables attendues par site.css', () => {
  const css = renderCss(tokens());
  assert.equal(css.split('@media (prefers-color-scheme: dark)').length, 2);
  for (const v of ['--color-bg', '--color-text-muted', '--color-on-primary', '--color-border-strong', '--color-todo-bg', '--color-info', '--space-7', '--radius-pill', '--size-target', '--size-content-max', '--font-sans']) {
    assert.ok(css.includes(`${v}:`), v);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('todoBg est réservé au web', () => {
  assert.ok(!/todoBg/.test(renderTs(tokens())));
  assert.ok(renderCss(tokens()).includes('--color-todo-bg:'));
});

test('contrastRows couvre les quatre directions et les deux modes', () => {
  const t = tokens();
  for (const id of ['A', 'B', 'C', 'D']) {
    const rows = contrastRows(t, id);
    assert.ok(rows.some((r) => r.mode === 'light') && rows.some((r) => r.mode === 'dark'));
    assert.ok(rows.filter((r) => r.kind !== 'info').every((r) => r.ok), id);
  }
});

test('les fichiers du dépôt sont à jour (équivalent de --check)', () => {
  const app = lf(readFileSync(PATHS.appJson, 'utf8'));
  for (const { file, content } of expectedOutputs(tokens(), app)) {
    assert.equal(lf(readFileSync(file, 'utf8')), content, `${file} périmé : lancer npm run tokens (depuis mobile/)`);
  }
  assert.equal(renderAppJson(tokens(), app), app);
});
