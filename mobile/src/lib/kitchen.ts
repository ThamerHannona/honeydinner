import type { Aisle, Ingredient, PantryItem, Recipe, StorageLocation } from './types';

/* ---------- Names ---------- */

const singular = (w: string) =>
  w.length > 3 && w.endsWith('ies')
    ? w.slice(0, -3) + 'y'
    : w.length > 3 && w.endsWith('oes')
      ? w.slice(0, -2)
      : w.length > 3 && w.endsWith('s') && !w.endsWith('ss')
        ? w.slice(0, -1)
        : w;

export const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(' ')
    .trim();

/** Things we assume every kitchen has, so they never count as "missing". */
const BASICS = ['salt', 'pepper', 'black pepper', 'water', 'ice', 'sea salt', 'kosher salt'];
export const isBasic = (name: string) => BASICS.includes(normalizeName(name));

export const namesMatch = (a: string, b: string) => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // word-boundary containment, e.g. "fresh spinach" ~ "spinach"
  const pad = (s: string) => ` ${s} `;
  return pad(na).includes(pad(nb)) || pad(nb).includes(pad(na));
};

/* ---------- Expiry ---------- */

export const DAY = 24 * 60 * 60 * 1000;

export const daysFromNow = (n: number) => {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  return new Date(d.getTime() + n * DAY).toISOString();
};

export const daysLeft = (iso: string | null) => {
  if (!iso) return null;
  const end = new Date(iso);
  end.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - now.getTime()) / DAY);
};

export type Freshness = 'fresh' | 'soon' | 'expired' | 'none';

export const freshness = (iso: string | null): Freshness => {
  const d = daysLeft(iso);
  if (d === null) return 'none';
  if (d < 0) return 'expired';
  if (d <= 3) return 'soon';
  return 'fresh';
};

export const expiryLabel = (iso: string | null) => {
  const d = daysLeft(iso);
  if (d === null) return 'Keeps';
  if (d < 0) return d === -1 ? 'Expired yesterday' : `Expired ${-d}d ago`;
  if (d === 0) return 'Use today';
  if (d === 1) return 'Tomorrow';
  if (d <= 13) return `${d} days`;
  if (d <= 60) return `${Math.round(d / 7)} wks`;
  return `${Math.round(d / 30)} mo`;
};

/* ---------- Matching ---------- */

export interface RecipeMatch {
  have: number;
  total: number;
  missing: Ingredient[];
  ratio: number;
  usesExpiring: number;
}

export const pantryHas = (pantry: PantryItem[], ingredientName: string) =>
  isBasic(ingredientName) ||
  pantry.some((p) => freshness(p.expiresAt) !== 'expired' && namesMatch(p.name, ingredientName));

export const matchRecipe = (recipe: Recipe, pantry: PantryItem[]): RecipeMatch => {
  const counted = recipe.ingredients.filter((i) => !isBasic(i.name));
  const missing = counted.filter((i) => !pantryHas(pantry, i.name));
  const soon = pantry.filter((p) => freshness(p.expiresAt) === 'soon');
  const usesExpiring = counted.filter((i) => soon.some((p) => namesMatch(p.name, i.name))).length;
  const total = counted.length;
  const have = total - missing.length;
  return { have, total, missing, ratio: total === 0 ? 0 : have / total, usesExpiring };
};

export const rankSuggestions = (recipes: Recipe[], pantry: PantryItem[]) =>
  recipes
    .map((r) => ({ recipe: r, match: matchRecipe(r, pantry) }))
    .filter((x) => x.match.have > 0)
    .sort(
      (a, b) =>
        b.match.ratio + b.match.usesExpiring * 0.08 - (a.match.ratio + a.match.usesExpiring * 0.08),
    );

/* ---------- Aisles, emoji & storage ---------- */

const AISLE_WORDS: [Aisle, string[]][] = [
  ['Frozen', ['frozen', 'ice cream', 'pea']],
  [
    'Meat & Fish',
    ['chicken', 'beef', 'pork', 'steak', 'salmon', 'shrimp', 'fish', 'bacon', 'sausage', 'turkey', 'lamb', 'tuna', 'prawn', 'mince'],
  ],
  [
    'Dairy',
    ['milk', 'cheese', 'cheddar', 'parmesan', 'feta', 'mozzarella', 'butter', 'yogurt', 'cream', 'egg'],
  ],
  [
    'Produce',
    ['spinach', 'lettuce', 'tomato', 'onion', 'garlic', 'lemon', 'lime', 'pepper', 'broccoli', 'carrot', 'celery', 'ginger', 'scallion', 'cilantro', 'basil', 'parsley', 'avocado', 'potato', 'mushroom', 'apple', 'banana', 'berry', 'cucumber', 'zucchini', 'kale', 'herb'],
  ],
  [
    'Pantry',
    ['rice', 'pasta', 'spaghetti', 'orzo', 'noodle', 'flour', 'sugar', 'oil', 'sauce', 'honey', 'bean', 'chickpea', 'lentil', 'stock', 'broth', 'spice', 'seasoning', 'cumin', 'curry', 'paprika', 'vinegar', 'peanut', 'coconut', 'crumb', 'tortilla', 'bread', 'can', 'oat', 'chili', 'sesame', 'marinara'],
  ],
];

const PANTRY_OVERRIDES = ['coconut milk', 'peanut butter', 'chili crisp', 'sun dried tomato', 'soy sauce', 'tomato paste', 'crushed tomato', 'canned'];

export const guessAisle = (name: string): Aisle => {
  const n = normalizeName(name);
  if (n.includes('frozen')) return 'Frozen';
  if (PANTRY_OVERRIDES.some((w) => n.includes(w))) return 'Pantry';
  const tokens = n.split(' ');
  const hit = (w: string) =>
    w.includes(' ') ? n.includes(w) : tokens.some((t) => t === w || (w.length >= 4 && t.startsWith(w)));
  for (const [aisle, words] of AISLE_WORDS) {
    if (words.some(hit)) return aisle;
  }
  return 'Other';
};

export const aisleToLocation = (aisle: Aisle): StorageLocation =>
  aisle === 'Frozen' ? 'freezer' : aisle === 'Pantry' || aisle === 'Other' ? 'pantry' : 'fridge';

export const defaultShelfLife = (aisle: Aisle): number | null =>
  ({ Produce: 6, Dairy: 10, 'Meat & Fish': 3, Frozen: 90, Pantry: null, Other: null })[aisle];

const EMOJI: [string, string][] = [
  ['chicken', '🍗'], ['beef', '🥩'], ['steak', '🥩'], ['salmon', '🐟'], ['fish', '🐟'], ['shrimp', '🦐'],
  ['egg', '🥚'], ['milk', '🥛'], ['cheddar', '🧀'], ['mozzarella', '🧀'], ['cheese', '🧀'], ['parmesan', '🧀'], ['feta', '🧀'],
  ['butter', '🧈'], ['yogurt', '🥣'], ['cream', '🥛'], ['spinach', '🥬'], ['lettuce', '🥬'], ['kale', '🥬'],
  ['broccoli', '🥦'], ['tomato', '🍅'], ['onion', '🧅'], ['garlic', '🧄'], ['lemon', '🍋'], ['lime', '🍋'],
  ['pepper', '🫑'], ['carrot', '🥕'], ['ginger', '🫚'], ['scallion', '🌱'], ['cilantro', '🌿'], ['herb', '🌿'],
  ['basil', '🌿'], ['avocado', '🥑'], ['potato', '🥔'], ['mushroom', '🍄'], ['peanut', '🥜'], ['pea', '🫛'], ['berry', '🫐'],
  ['apple', '🍎'], ['banana', '🍌'], ['rice', '🍚'], ['spaghetti', '🍝'], ['pasta', '🍝'], ['noodle', '🍜'],
  ['oil', '🫒'], ['soy', '🥢'], ['honey', '🍯'], ['bread', '🍞'], ['tortilla', '🫓'], ['chickpea', '🫘'],
  ['bean', '🫘'], ['coconut', '🥥'], ['corn', '🌽'], ['cucumber', '🥒'], ['juice', '🧃'],
];

export const guessEmoji = (name: string) => {
  const n = normalizeName(name);
  return EMOJI.find(([w]) => n.includes(w))?.[1] ?? '🥫';
};

/* ---------- Quantities ---------- */

const FRACTIONS: [number, string][] = [
  [0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾'],
];

export const formatQty = (qty: number | null) => {
  if (qty === null) return '';
  const whole = Math.floor(qty);
  const rest = qty - whole;
  if (rest < 0.08) return `${whole}`;
  if (rest > 0.92) return `${whole + 1}`;
  const frac = FRACTIONS.reduce((best, f) => (Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best));
  return whole > 0 ? `${whole}${frac[1]}` : frac[1];
};

export const formatIngredientAmount = (i: Ingredient, scale = 1) => {
  const q = i.qty === null ? '' : formatQty(i.qty * scale);
  return [q, i.unit].filter(Boolean).join(' ');
};

/** Finds "for 10 minutes" / "5-6 min" in a step so cooking mode can offer a timer. */
export const findTimerMinutes = (step: string): number | null => {
  const m = step.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(minutes|minute|mins|min)\b/i);
  if (m) return Number(m[2] ?? m[1]);
  const h = step.match(/(\d+)\s*(hours|hour|hrs|hr)\b/i);
  if (h) return Number(h[1]) * 60;
  return null;
};
