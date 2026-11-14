import { describe, expect, test } from 'bun:test';
import { checkOffBoughtGroceries, namesMatch } from '../src/lib/kitchen';
const g = (partial) => ({
  id: partial.id ?? `g-${partial.name}`,
  name: partial.name,
  qty: partial.qty ?? 1,
  unit: partial.unit ?? '',
  aisle: partial.aisle ?? 'Produce',
  addedBy: 'me',
  recipeIds: [],
  checked: partial.checked ?? false,
  checkedAt: partial.checkedAt ?? null,
});

describe('scan review stocks the kitchen', () => {
  test('namesMatch treats "baby spinach" and "spinach" as the same item', () => {
    expect(namesMatch('Organic baby spinach', 'spinach')).toBe(true);
    expect(namesMatch('2% milk', 'Milk')).toBe(true);
    expect(namesMatch('chicken thighs', 'pasta')).toBe(false);
  });

  test('confirmed receipt items check off matching groceries and leave the rest', () => {
    const list = [
      g({ name: 'spinach' }),
      g({ name: 'whole milk' }),
      g({ name: 'pasta' }),
      g({ name: 'garlic', checked: true, checkedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const next = checkOffBoughtGroceries(list, ['Organic baby spinach', 'Milk'], '2026-11-14T15:00:00.000Z');
    expect(next.find((i) => i.name === 'spinach').checked).toBe(true);
    expect(next.find((i) => i.name === 'whole milk').checked).toBe(true);
    expect(next.find((i) => i.name === 'pasta').checked).toBe(false);
    expect(next.find((i) => i.name === 'garlic').checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  test('empty confirmations do not mutate the grocery list', () => {
    const list = [g({ name: 'eggs' })];
    expect(checkOffBoughtGroceries(list, ['', '  '], 'now')).toBe(list);
  });
});
