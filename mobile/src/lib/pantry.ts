import type { PantryItem, StorageLocation } from './types';

export const PANTRY_LOCATIONS: { key: StorageLocation; label: string }[] = [
  { key: 'fridge', label: 'Fridge' },
  { key: 'freezer', label: 'Freezer' },
  { key: 'pantry', label: 'Pantry' },
];

export function filterPantry(items: PantryItem[], location: StorageLocation, search: string) {
  const query = search.trim().toLowerCase();
  return items
    .filter((item) => item.location === location && item.name.toLowerCase().includes(query))
    .sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999'));
}

/** Local calendar-date input; storing at 20:00 matches the existing seed dates. */
export function parseExpiryDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 9999) return null;
  const date = new Date(year, month - 1, day, 20);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.toISOString();
}

export function expiryInputFromDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
