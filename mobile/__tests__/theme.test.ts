import fs from 'fs';
import path from 'path';
import { colors, direction, MIN_TARGET, stateOpacity } from '../src/theme/tokens';

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrastes des tokens (WCAG AA : 4,5:1 pour le texte)', () => {
  const pairs: [keyof typeof colors.light, keyof typeof colors.light][] = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['textMuted', 'bg'],
    ['textMuted', 'surface'],
    ['onPrimary', 'primary'],
    ['onPrimary', 'danger'],
    ['primary', 'bg'],
    ['primary', 'surface'],
    ['danger', 'bg'],
    ['danger', 'surface'],
    ['success', 'surface'],
    ['like', 'bg'],
    ['like', 'surface'],
    ['dislike', 'bg'],
    ['dislike', 'surface'],
    ['verified', 'bg'],
    ['verified', 'surface'],
    ['warning', 'surface'],
    ['disabledText', 'disabledBg'],
    ['info', 'bg'],
    ['info', 'surface'],
    ['passNeutral', 'bg'],
    ['passNeutral', 'surface'],
    ['onAccent', 'accent'],
  ];
  for (const scheme of ['light', 'dark'] as const) {
    for (const [fg, bg] of pairs) {
      it(`${scheme} : ${fg} sur ${bg} >= 4.5`, () => {
        expect(contrast(colors[scheme][fg], colors[scheme][bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  // WCAG 1.4.11 : contours de composants (champs, cases, piste d'interrupteur) >= 3:1.
  for (const scheme of ['light', 'dark'] as const) {
    for (const bg of ['bg', 'surface'] as const) {
      it(`${scheme} : borderStrong sur ${bg} >= 3 (non textuel)`, () => {
        expect(contrast(colors[scheme].borderStrong, colors[scheme][bg])).toBeGreaterThanOrEqual(3);
      });
    }
    it(`${scheme} : like et dislike sur bg >= 3 (non textuel)`, () => {
      expect(contrast(colors[scheme].like, colors[scheme].bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(colors[scheme].dislike, colors[scheme].bg)).toBeGreaterThanOrEqual(3);
    });
  }

  it('direction D (Prune) active ; like, dislike, primary, brand et verified suivent ses valeurs', () => {
    expect(direction.id).toBe('D');
    expect(colors.light.like).toBe('#127850');
    expect(colors.light.dislike).toBe('#B3261E');
    expect(colors.dark.like).toBe('#4FD39A');
    expect(colors.dark.dislike).toBe('#FF8F86');
    // Rose assombri : #E6007A (rose du handoff) ne passe que de justesse (4,52:1) en texte et en libellé blanc.
    expect(colors.light.primary).toBe('#C2006B');
    expect(colors.dark.primary).toBe('#FF6FB0');
    expect(colors.light.brand).toBe('#4B0F5B');
    expect(colors.dark.brand).toBe('#4B0F5B');
    expect(colors.light.verified).toBe('#3446C4');
  });

  // WCAG 1.4.11 : anneau de focus et bouton « Passer » neutre.
  for (const scheme of ['light', 'dark'] as const) {
    for (const bg of ['bg', 'surface'] as const) {
      it(`${scheme} : focusRing sur ${bg} >= 3 (non textuel)`, () => {
        expect(contrast(colors[scheme].focusRing, colors[scheme][bg])).toBeGreaterThanOrEqual(3);
      });
    }
  }

  it("l'opacité d'un composant enfoncé laisse le contenu lisible", () => {
    expect(stateOpacity.pressed).toBeGreaterThanOrEqual(0.7);
    expect(stateOpacity.pressed).toBeLessThan(1);
  });

  it('clair et sombre exposent les mêmes tokens', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it('la cible tactile minimale est de 44', () => {
    expect(MIN_TARGET).toBeGreaterThanOrEqual(44);
  });
});

describe('aucune couleur en dur hors tokens', () => {
  const root = path.resolve(__dirname, '..');
  const dirs = ['src', 'app'];
  const HEX = /#[0-9a-fA-F]{3,8}\b/;
  const FUNC = /\b(?:rgb|rgba|hsl|hsla)\s*\(/;
  const NAMED = /['"`](?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink)['"`]/i;

  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return files(full);
      return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
    });
  }

  it('src/ et app/ ne contiennent de couleur que dans src/theme/tokens.ts', () => {
    const offenders: string[] = [];
    for (const d of dirs) {
      for (const file of files(path.join(root, d))) {
        if (file.endsWith(path.join('theme', 'tokens.ts'))) continue;
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (HEX.test(line) || FUNC.test(line) || NAMED.test(line)) {
            offenders.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
