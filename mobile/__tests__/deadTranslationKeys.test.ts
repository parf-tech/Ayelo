import fs from 'fs';
import path from 'path';
import { dictionaries } from '../src/i18n';

/**
 * Clés de traduction mortes : une clé qui n'est lue nulle part grossit les deux dictionnaires pour rien et trompe la relecture.
 *
 * Une clé est vivante si son nom apparaît comme chaîne dans le code de l'application (`src/` hors dictionnaires, et `app/`),
 * ou si elle commence par le préfixe d'une clé construite dynamiquement (`t(`intent.${x}.label`)`, `error.${code}`). Un
 * préfixe dynamique ne supprime jamais une clé à tort : en cas de doute, la clé reste.
 */

const root = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const dictionaryDir = path.join(root, 'src', 'i18n') + path.sep;
const sources = [...sourceFiles(path.join(root, 'src')), ...sourceFiles(path.join(root, 'app'))]
  .filter((file) => !file.startsWith(dictionaryDir) || /(apiErrors|I18nProvider|translate|index|activeLocale)\.tsx?$/.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

/** Chaînes complètes qui ressemblent à une clé (`profile.country.none`, `ok`). */
const literals = new Set<string>();
for (const match of sources.matchAll(/(['"`])([A-Za-z][\w-]*(?:\.[\w-]+)*)\1/g)) literals.add(match[2]!);

/** Préfixes de clés construites : `intent.${x}.label` -> `intent.`, `error.${code}` -> `error.`. */
const dynamicPrefixes = new Set<string>();
for (const match of sources.matchAll(/`([A-Za-z][\w-]*(?:\.[\w-]+)*\.?)\$\{/g)) dynamicPrefixes.add(match[1]!);

function isUsed(key: string): boolean {
  if (literals.has(key)) return true;
  for (const prefix of dynamicPrefixes) if (key.startsWith(prefix)) return true;
  return false;
}

describe('clés de traduction', () => {
  it('aucune clé n’est morte (inutilisée dans le code)', () => {
    const dead = Object.keys(dictionaries.fr).filter((key) => !isUsed(key));
    expect(dead).toEqual([]);
  });

  it('le détecteur reconnaît une clé construite et une clé littérale, et rejette une clé inventée', () => {
    expect(isUsed('welcome.benefits.verify')).toBe(true);
    expect(isUsed('intent.serious.label')).toBe(true);
    expect(isUsed('une.cle.qui.nexiste.nulle.part')).toBe(false);
  });
});
