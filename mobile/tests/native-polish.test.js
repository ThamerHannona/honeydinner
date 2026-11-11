import { describe, expect, test } from 'bun:test';
import { C, darkC, shape } from '../src/lib/theme';

function luminance(hex) {
  const values = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('native polish design tokens', () => {
  test('dark mode retains every semantic color', () => {
    expect(Object.keys(darkC).sort()).toEqual(Object.keys(C).sort());
    expect(darkC.cream).not.toBe(C.cream);
    expect(darkC.ink).not.toBe(C.ink);
  });
  test('standard button and icon targets meet the 44pt minimum', () => {
    expect(shape.icon).toBeGreaterThanOrEqual(44);
    expect(shape.button).toBeGreaterThanOrEqual(44);
    expect(shape.fab).toBeGreaterThanOrEqual(44);
  });
  for (const [mode, palette] of Object.entries({ light: C, dark: darkC })) {
    test(`${mode} body text and fixed brand foregrounds meet WCAG AA`, () => {
      for (const [foreground, background] of [
        [palette.ink, palette.cream],
        [palette.ink, palette.paper],
        [palette.inkSoft, palette.cream],
        [palette.muted, palette.paper],
        [palette.onHoney, palette.honey],
        [palette.onGreen, palette.forest],
      ]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
