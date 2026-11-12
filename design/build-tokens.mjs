#!/usr/bin/env node
// Générateur des jetons de design d'Ayelo (Node ESM, aucune dépendance).
//
//   node design/build-tokens.mjs            valide design/tokens.json puis écrit les fichiers générés
//   node design/build-tokens.mjs --check    ne rien écrire ; code de sortie 1 si un fichier généré est périmé
//   node design/build-tokens.mjs --report   tableau des rapports de contraste (Markdown) pour les quatre directions
//
// Sorties : mobile/src/theme/tokens.ts, web/assets/tokens.css, et les couleurs de mobile/app.json
// (icône adaptative, couleur de notification, fonds de l'écran de démarrage).
// La validation (contrastes WCAG 2.2) échoue avant toute écriture : texte 4,5:1, contrôles 3:1, clair et sombre,
// pour les quatre directions A, B et C (elles doivent rester utilisables).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
export const PATHS = {
  tokens: path.join(HERE, 'tokens.json'),
  ts: path.join(REPO, 'mobile', 'src', 'theme', 'tokens.ts'),
  css: path.join(REPO, 'web', 'assets', 'tokens.css'),
  appJson: path.join(REPO, 'mobile', 'app.json'),
};

const MODES = ['light', 'dark'];
const DIRECTION_IDS = ['A', 'B', 'C', 'D'];
const HEX = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
const PRINT_WIDTH = 120;

// ---------------------------------------------------------------------------------------------------------------
// Contraste (WCAG 2.2)
// ---------------------------------------------------------------------------------------------------------------

export function luminance(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------------------------------------------
// Lecture et résolution des couleurs
// ---------------------------------------------------------------------------------------------------------------

export function loadTokens(file = PATHS.tokens) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Couleurs résolues (alias « =role » remplacés, majuscules) d'une direction : { light: {...}, dark: {...} }. */
export function resolveColors(tokens, directionId) {
  const direction = tokens.directions[directionId];
  const out = {};
  for (const mode of MODES) {
    const raw = { ...(tokens.colorShared?.[mode] ?? {}), ...(direction.color[mode] ?? {}) };
    const resolved = {};
    for (const [role, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value.startsWith('=')) {
        const target = raw[value.slice(1)];
        if (typeof target !== 'string' || target.startsWith('=')) {
          throw new Error(`[${directionId}/${mode}] alias ${role} = ${value} : cible absente ou elle-même un alias`);
        }
        resolved[role] = target;
      } else {
        resolved[role] = value;
      }
    }
    for (const role of Object.keys(resolved)) {
      if (typeof resolved[role] === 'string' && HEX.test(resolved[role])) resolved[role] = resolved[role].toUpperCase();
    }
    out[mode] = resolved;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------------------------

/** Lignes de contraste pour une direction : { direction, mode, kind, fg, bg, min, ratio, ok }. */
export function contrastRows(tokens, directionId) {
  const colors = resolveColors(tokens, directionId);
  const rows = [];
  const kinds = [
    ['text', tokens.contrast.text, tokens.contrast.textMin],
    ['control', tokens.contrast.control, tokens.contrast.controlMin],
    ['info', tokens.contrast.informational ?? [], 0],
  ];
  for (const mode of MODES) {
    for (const [kind, pairs, min] of kinds) {
      for (const [fg, bg] of pairs) {
        const a = colors[mode][fg];
        const b = colors[mode][bg];
        if (!a || !b || !HEX.test(a) || !HEX.test(b) || a.length !== 7 || b.length !== 7) {
          rows.push({ direction: directionId, mode, kind, fg, bg, min, ratio: NaN, ok: false });
          continue;
        }
        const ratio = contrast(a, b);
        rows.push({ direction: directionId, mode, kind, fg, bg, min, ratio, ok: ratio >= min });
      }
    }
  }
  return rows;
}

/** Retourne la liste des erreurs de validation (vide si tout est conforme). */
export function validate(tokens) {
  const errors = [];
  const err = (m) => errors.push(m);

  if (!tokens.directions || !DIRECTION_IDS.every((id) => tokens.directions[id])) {
    err(`directions : A, B, C et D doivent exister (trouvé : ${Object.keys(tokens.directions ?? {}).join(', ') || 'aucune'})`);
    return errors;
  }
  if (!tokens.directions[tokens.activeDirection]) {
    err(`activeDirection « ${tokens.activeDirection} » absente de directions`);
    return errors;
  }

  const roles = Object.keys(tokens.colorRoles).sort();
  for (const id of Object.keys(tokens.directions)) {
    let colors;
    try {
      colors = resolveColors(tokens, id);
    } catch (e) {
      err(e.message);
      continue;
    }
    for (const mode of MODES) {
      const got = Object.keys(colors[mode]).sort();
      for (const r of roles) if (!got.includes(r)) err(`[${id}/${mode}] rôle de couleur manquant : ${r}`);
      for (const r of got) if (!roles.includes(r)) err(`[${id}/${mode}] rôle de couleur inconnu (absent de colorRoles) : ${r}`);
      for (const [r, v] of Object.entries(colors[mode])) {
        if (!HEX.test(v)) err(`[${id}/${mode}] ${r} : « ${v} » n'est pas un hexadécimal #RRGGBB ou #RRGGBBAA`);
      }
    }
    const d = tokens.directions[id];
    for (const k of ['sm', 'md', 'lg', 'pill']) {
      if (!Number.isFinite(d.radius?.[k])) err(`[${id}] radius.${k} manquant`);
    }
    for (const row of contrastRows(tokens, id)) {
      if (Number.isNaN(row.ratio)) {
        err(`[${id}/${row.mode}] paire ${row.fg} sur ${row.bg} : rôle absent ou couleur non opaque`);
      } else if (!row.ok) {
        err(`[${id}/${row.mode}] contraste ${row.fg} sur ${row.bg} = ${row.ratio.toFixed(3)}:1 (minimum ${row.min}:1)`);
      }
    }
  }

  const { weights, scale } = tokens.typography;
  for (const [name, t] of Object.entries(scale)) {
    if (!(t.weight in weights)) err(`typography.${name} : graisse « ${t.weight} » inconnue`);
    if (!(t.size > 0 && t.lineHeight >= t.size)) err(`typography.${name} : interligne ${t.lineHeight} < taille ${t.size}`);
  }
  if (!(tokens.minTarget >= 44)) err(`minTarget ${tokens.minTarget} < 44`);
  const { fast, base, slow } = tokens.motion.duration;
  if (!(fast >= 100 && fast <= base && base <= slow && slow <= 400)) {
    err(`motion.duration : attendu 100 <= fast <= base <= slow <= 400 (reçu ${fast}, ${base}, ${slow})`);
  }
  for (const [name, curve] of Object.entries(tokens.motion.easing)) {
    if (!(Array.isArray(curve) && curve.length === 4 && curve.every(Number.isFinite))) err(`motion.easing.${name} : 4 nombres attendus`);
  }
  const zs = Object.values(tokens.zIndex);
  if (!zs.every((v, i) => i === 0 || v > zs[i - 1])) err('zIndex : valeurs strictement croissantes attendues (ordre du fichier)');
  if (!(tokens.focus.width >= 2)) err(`focus.width ${tokens.focus.width} < 2`);
  if (!tokens.colorRoles[tokens.focus.color]) err(`focus.color « ${tokens.focus.color} » n'est pas un rôle de couleur`);
  for (const [name, v] of Object.entries(tokens.stateOpacity)) {
    if (!(v > 0 && v <= 1)) err(`stateOpacity.${name} hors de ]0, 1]`);
  }
  for (const level of ['0', '1', '2', '3']) {
    if (!tokens.elevation[level]?.rn || typeof tokens.elevation[level]?.css !== 'string') err(`elevation.${level} : rn et css attendus`);
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------
// Formatage (compatible Prettier : guillemets simples, virgules finales, 2 espaces, 120 colonnes)
// ---------------------------------------------------------------------------------------------------------------

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const key = (k) => (IDENT.test(k) || /^\d+$/.test(k) ? k : `'${k}'`);
const str = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function inline(v) {
  if (typeof v === 'string') return str(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  const entries = Object.entries(v);
  return entries.length === 0 ? '{}' : `{ ${entries.map(([k, x]) => `${key(k)}: ${inline(x)}`).join(', ')} }`;
}

/**
 * Valeur TypeScript. `indent` = indentation de la ligne courante, `col` = colonne de départ de la valeur,
 * `suffix` = caractères qui suivent (virgule, point-virgule). Tient sur une ligne si possible, sinon une clé par ligne.
 */
function fmt(v, indent, col, suffix) {
  const one = inline(v);
  if (typeof v !== 'object' || v === null || col + one.length + suffix.length <= PRINT_WIDTH) return one;
  const pad = ' '.repeat(indent);
  if (Array.isArray(v)) {
    const items = v.map((x) => `${pad}  ${fmt(x, indent + 2, indent + 2, ',')},`);
    return ['[', ...items, `${pad}]`].join('\n');
  }
  const lines = Object.entries(v).map(([k, x]) => {
    const head = `${pad}  ${key(k)}: `;
    return `${head}${fmt(x, indent + 2, head.length, ',')},`;
  });
  return ['{', ...lines, `${pad}}`].join('\n');
}

/** `export const name = valeur as const;` (ou sans `as const`). */
function decl(name, v, asConst = true) {
  const head = `export const ${name} = `;
  return `${head}${fmt(v, 0, head.length, asConst ? ' as const;' : ';')}${asConst ? ' as const' : ''};`;
}

const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const sortKeys = (o) => Object.keys(o).sort();
const rem = (px) => `${+(px / 16).toFixed(4)}rem`;
const hasPlatform = (tokens, role, platform) => {
  const p = tokens.colorRoles[role].platforms;
  return !p || p.includes(platform);
};

// ---------------------------------------------------------------------------------------------------------------
// tokens.ts
// ---------------------------------------------------------------------------------------------------------------

export function renderTs(tokens) {
  const id = tokens.activeDirection;
  const dir = tokens.directions[id];
  const colors = resolveColors(tokens, id);
  const roles = sortKeys(tokens.colorRoles).filter((r) => hasPlatform(tokens, r, 'mobile'));
  const weightOf = (name) => `'${tokens.typography.weights[name]}'`;
  const weightValues = [...new Set(Object.values(tokens.typography.weights))].sort((a, b) => a - b);
  const typeNames = Object.keys(tokens.typography.scale);
  const out = [];
  const push = (...lines) => out.push(...lines);

  push(
    '// Fichier généré, ne pas modifier.',
    '// Source unique : design/tokens.json. Générateur : design/build-tokens.mjs (npm run tokens, depuis mobile/).',
    `// Direction active : ${id} (${dir.name}). Pour changer de direction, modifier activeDirection dans tokens.json.`,
    "// Seul fichier de mobile/ autorisé à contenir des valeurs de couleur (test __tests__/theme.test.ts).",
    '',
    'export type ColorTokens = {',
  );
  for (const r of roles) push(`  /** ${tokens.colorRoles[r].doc} */`, `  ${r}: string;`);
  push('};', '');

  push(decl('direction', { id, name: dir.name }), '');

  push('export const colors: { light: ColorTokens; dark: ColorTokens } = {');
  for (const mode of MODES) {
    push(`  ${mode}: {`);
    for (const r of roles) push(`    ${r}: ${str(colors[mode][r])},`);
    push('  },');
  }
  push('};', '');

  push(`export const space = ${inline(tokens.space)} as const;`, '');
  push(decl('radius', dir.radius), '');
  push(decl('borderWidth', tokens.borderWidth), '');

  push(
    `export type TypeToken = {`,
    `  size: number;`,
    `  weight: ${weightValues.map((w) => `'${w}'`).join(' | ')};`,
    `  line: number;`,
    `};`,
    '',
    `export type TypeVariant = ${typeNames.map(str).join(' | ')};`,
    '',
    decl('fontWeight', Object.fromEntries(Object.entries(tokens.typography.weights).map(([k, v]) => [k, String(v)]))),
    '',
    'export const type: Record<TypeVariant, TypeToken> = {',
  );
  for (const [name, t] of Object.entries(tokens.typography.scale)) {
    push(`  /** ${t.doc} */`, `  ${name}: { size: ${t.size}, weight: ${weightOf(t.weight)}, line: ${t.lineHeight} },`);
  }
  push('};', '');

  push('/** Taille minimale d\'une cible tactile (docs/06 : >= 44 pt). */', `export const MIN_TARGET = ${tokens.minTarget};`, '');
  push('/** Largeur maximale du contenu (tablettes : mise en page centrée). */', `export const MAX_CONTENT_WIDTH = ${tokens.contentWidth.app};`, '');

  push(
    'export type ElevationToken = {',
    '  shadowColor: string;',
    '  shadowOffset: { width: number; height: number };',
    '  shadowOpacity: number;',
    '  shadowRadius: number;',
    '  /** Ombre Android. */',
    '  elevation: number;',
    '};',
    '',
    '/** Niveaux d\'élévation : 0 au repos, 1 à 3 pour les éléments flottants (toast, feuille, dialogue). */',
    'export const elevation: Record<0 | 1 | 2 | 3, ElevationToken> = {',
  );
  for (const level of ['0', '1', '2', '3']) {
    push(`  ${level}: {`, ...Object.entries(tokens.elevation[level].rn).map(([k, v]) => `    ${k}: ${inline(v)},`), '  },');
  }
  push('};', '');

  push('/** Mouvement : durées en ms, courbes de Bézier (x1, y1, x2, y2). */');
  push(decl('motion', { duration: tokens.motion.duration, easing: tokens.motion.easing }), '');
  push(`/** ${tokens.motion.reduceMotion.rule} */`);
  const rm = tokens.motion.reduceMotion;
  push(decl('reduceMotion', { transform: rm.transform, fadeOnly: rm.fadeOnly, maxDurationMs: rm.maxDurationMs }), '');

  push(decl('zIndex', tokens.zIndex), '');
  push('/** Anneau de focus : épaisseur et décalage en pt, couleur = jeton de couleur. */');
  push(decl('focus', tokens.focus), '');
  push('/** Opacités d\'état. */');
  push(decl('stateOpacity', tokens.stateOpacity), '');
  push('/** Tailles d\'icône en pt. */');
  push(decl('iconSize', tokens.iconSize), '');
  push('/** Zone de toucher étendue autour d\'un petit glyphe (pt de chaque côté). */');
  const h = tokens.hitSlop;
  push(decl('hitSlop', { top: h, bottom: h, left: h, right: h }));
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------------------------------------------
// tokens.css
// ---------------------------------------------------------------------------------------------------------------

export function renderCss(tokens) {
  const id = tokens.activeDirection;
  const dir = tokens.directions[id];
  const colors = resolveColors(tokens, id);
  const roles = sortKeys(tokens.colorRoles).filter((r) => hasPlatform(tokens, r, 'web'));
  const colorLines = (mode, indent) => roles.map((r) => `${indent}--color-${kebab(r)}: ${colors[mode][r]};`);
  const out = [];
  const push = (...lines) => out.push(...lines);

  push(
    '/*',
    ' * Fichier généré, ne pas modifier.',
    ' * Source unique : design/tokens.json. Générateur : design/build-tokens.mjs (npm run tokens, depuis mobile/).',
    ` * Direction active : ${id} (${dir.name}). Les mêmes jetons génèrent mobile/src/theme/tokens.ts.`,
    ' */',
    ':root {',
    '  color-scheme: light dark;',
    '',
    ...colorLines('light', '  '),
    '',
  );
  tokens.space.forEach((v, i) => push(`  --space-${i}: ${v === 0 ? '0' : `${v}px`};`));
  push('');
  for (const k of ['sm', 'md', 'lg', 'pill']) push(`  --radius-${k}: ${dir.radius[k]}px;`);
  push('');
  for (const [k, v] of Object.entries(tokens.borderWidth)) push(`  --border-width-${kebab(k)}: ${v}px;`);
  push('', `  --size-target: ${tokens.minTarget}px;`, `  --size-content-max: ${tokens.contentWidth.web}px; /* pages web : texte long ; l'application utilise ${tokens.contentWidth.app} */`, '');
  push(`  --font-sans: ${tokens.typography.fontFamilyWeb};`);
  for (const [name, t] of Object.entries(tokens.typography.scale)) {
    const n = kebab(name);
    push(`  --type-${n}-size: ${rem(t.size)};`, `  --type-${n}-line: ${rem(t.lineHeight)};`, `  --type-${n}-weight: ${tokens.typography.weights[t.weight]};`);
  }
  push('');
  for (const level of ['0', '1', '2', '3']) push(`  --elevation-${level}: ${tokens.elevation[level].css};`);
  push('');
  for (const [k, v] of Object.entries(tokens.motion.duration)) push(`  --motion-duration-${k}: ${v}ms;`);
  for (const [k, v] of Object.entries(tokens.motion.easing)) push(`  --motion-ease-${k}: cubic-bezier(${v.join(', ')});`);
  push('');
  for (const [k, v] of Object.entries(tokens.zIndex)) push(`  --z-${kebab(k)}: ${v};`);
  push('', `  --focus-width: ${tokens.focus.width}px;`, `  --focus-offset: ${tokens.focus.offset}px;`, '');
  for (const [k, v] of Object.entries(tokens.stateOpacity)) push(`  --opacity-${kebab(k)}: ${v};`);
  push('');
  for (const [k, v] of Object.entries(tokens.iconSize)) push(`  --icon-${k}: ${v}px;`);
  push('', `  --hit-slop: ${tokens.hitSlop}px;`, '}', '');

  push('@media (prefers-color-scheme: dark) {', '  :root {', ...colorLines('dark', '    '), '  }', '}', '');

  const max = tokens.motion.reduceMotion.maxDurationMs;
  push(
    '/* Mouvement réduit : plus de translation ni d\'échelle, fondu seul, durée plafonnée. */',
    '@media (prefers-reduced-motion: reduce) {',
    '  :root {',
    ...Object.entries(tokens.motion.duration).map(([k, v]) => `    --motion-duration-${k}: ${Math.min(v, max)}ms;`),
    '  }',
    '}',
  );
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------------------------------------------
// app.json (couleurs natives : icône adaptative, notification, écran de démarrage)
// ---------------------------------------------------------------------------------------------------------------

export function renderAppJson(tokens, currentText) {
  const colors = resolveColors(tokens, tokens.activeDirection);
  const app = JSON.parse(currentText);
  const expo = app.expo;
  expo.android.adaptiveIcon.backgroundColor = colors.light.primary;
  const plugin = (name) => expo.plugins.find((p) => Array.isArray(p) && p[0] === name);
  const notif = plugin('expo-notifications');
  const splash = plugin('expo-splash-screen');
  if (!notif || !splash) throw new Error('app.json : plugins expo-notifications et expo-splash-screen attendus');
  notif[1].color = colors.light.primary;
  splash[1].backgroundColor = colors.light.bg;
  splash[1].dark.backgroundColor = colors.dark.bg;
  return JSON.stringify(app, null, 2) + '\n';
}

// ---------------------------------------------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------------------------------------------

const lf = (s) => s.replace(/\r\n/g, '\n');

/** Sorties attendues : [{ file, content }] (app.json n'est reconstruit que s'il existe). */
export function expectedOutputs(tokens, appJsonText) {
  const outputs = [
    { file: PATHS.ts, content: renderTs(tokens) },
    { file: PATHS.css, content: renderCss(tokens) },
  ];
  if (appJsonText !== undefined) outputs.push({ file: PATHS.appJson, content: renderAppJson(tokens, appJsonText) });
  return outputs;
}

function diffSummary(expected, actual) {
  const a = lf(actual).split('\n');
  const e = expected.split('\n');
  const lines = [];
  let count = 0;
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if (a[i] !== e[i]) {
      count++;
      if (lines.length < 8) lines.push(`    ligne ${i + 1}\n      attendu : ${e[i] ?? '(absente)'}\n      présent : ${a[i] ?? '(absente)'}`);
    }
  }
  return { count, preview: lines.join('\n') };
}

const rel = (f) => path.relative(REPO, f).split(path.sep).join('/');

export function run(argv = process.argv.slice(2), log = console.log, errLog = console.error) {
  const check = argv.includes('--check');
  const report = argv.includes('--report');
  const tokens = loadTokens();

  const errors = validate(tokens);
  if (errors.length > 0) {
    errLog(`ECHEC : ${errors.length} erreur(s) de validation dans design/tokens.json`);
    for (const e of errors) errLog(`  - ${e}`);
    return 1;
  }

  if (report) {
    for (const id of DIRECTION_IDS) {
      log(`\n### Direction ${id} (${tokens.directions[id].name})\n`);
      log('| Paire | Type | Seuil | Clair | Sombre |', '\n|---|---|---|---|---|');
      const rows = contrastRows(tokens, id);
      const light = rows.filter((r) => r.mode === 'light');
      for (const l of light) {
        const d = rows.find((r) => r.mode === 'dark' && r.kind === l.kind && r.fg === l.fg && r.bg === l.bg);
        log(`| ${l.fg} sur ${l.bg} | ${l.kind} | ${l.min || 'info'} | ${l.ratio.toFixed(2)} | ${d.ratio.toFixed(2)} |`);
      }
    }
    return 0;
  }

  const appJsonText = existsSync(PATHS.appJson) ? lf(readFileSync(PATHS.appJson, 'utf8')) : undefined;
  const outputs = expectedOutputs(tokens, appJsonText);

  const rows = DIRECTION_IDS.flatMap((id) => contrastRows(tokens, id)).filter((r) => r.kind !== 'info');
  const min = (kind) => rows.filter((r) => r.kind === kind).reduce((m, r) => (r.ratio < m.ratio ? r : m));
  const mt = min('text');
  const mc = min('control');
  const summary =
    `tokens : direction active ${tokens.activeDirection} (${tokens.directions[tokens.activeDirection].name}) ; ` +
    `${rows.length} contrastes vérifiés (4 directions x 2 modes) ; ` +
    `minimum texte ${mt.ratio.toFixed(2)}:1 (${mt.direction}/${mt.mode} ${mt.fg} sur ${mt.bg}) ; ` +
    `minimum contrôle ${mc.ratio.toFixed(2)}:1 (${mc.direction}/${mc.mode} ${mc.fg} sur ${mc.bg})`;

  if (check) {
    let stale = 0;
    for (const { file, content } of outputs) {
      const actual = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (lf(actual) !== content) {
        stale++;
        const { count, preview } = diffSummary(content, actual);
        errLog(`PERIME : ${rel(file)} ne correspond pas à design/tokens.json (${count} ligne(s) différente(s))`);
        errLog(preview);
      }
    }
    if (stale > 0) {
      errLog('Régénérer avec : npm run tokens (depuis mobile/)');
      return 1;
    }
    log(`${summary}\nOK : ${outputs.map((o) => rel(o.file)).join(', ')} à jour`);
    return 0;
  }

  for (const { file, content } of outputs) {
    const actual = existsSync(file) ? lf(readFileSync(file, 'utf8')) : null;
    if (actual !== content) {
      writeFileSync(file, content, 'utf8');
      log(`écrit : ${rel(file)}`);
    } else {
      log(`inchangé : ${rel(file)}`);
    }
  }
  log(summary);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = run();
}
