import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appDir = join(__dirname, '../../apps/web/app');
const stylesDir = join(appDir, 'styles');
const files = readdirSync(stylesDir).filter((name) => name.endsWith('.css')).sort();
const css = (name: string) => readFileSync(join(stylesDir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('css guard (UX v3 §3.2)', () => {
  it('reads the expected style files', () => {
    expect(files).toEqual(expect.arrayContaining(['tokens.css', 'base.css', 'ui.css', 'catalogue.css', 'profile.css', 'comparison.css']));
  });

  it('declares font-size only through the type scale tokens or inherit', () => {
    const offenders: string[] = [];
    for (const name of files) {
      for (const match of css(name).matchAll(/(?<![\w-])font-size\s*:\s*([^;}]+)/g)) {
        const value = match[1]!.trim();
        if (!/^var\(--text-[\w-]+\)$/.test(value) && value !== 'inherit') offenders.push(`${name}: font-size: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every --text-* token at 12 px or larger', () => {
    const tokens = [...css('tokens.css').matchAll(/(--text-[\w-]+)\s*:\s*([\d.]+)(rem|px|em)\s*;/g)];
    expect(tokens.length).toBeGreaterThanOrEqual(7);
    for (const [, name, amount, unit] of tokens) {
      const px = Number(amount) * (unit === 'px' ? 1 : 16);
      expect({ name, px, ok: px >= 12 }).toEqual({ name, px, ok: true });
    }
    // Any --text-* declared in another unit would escape the check above.
    expect([...css('tokens.css').matchAll(/(--text-[\w-]+)\s*:\s*([^;]+);/g)].filter(([, , value]) => !/^[\d.]+(rem|px|em)$/.test(value!.trim()))).toEqual([]);
  });

  it('does not keep the retired stylesheets', () => {
    expect(existsSync(join(appDir, 'comparison-ux.css'))).toBe(false);
    expect(existsSync(join(appDir, 'globals.css'))).toBe(false);
  });
});
