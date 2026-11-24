import type { Aisle, GroceryItem, Ingredient, PantryItem, Recipe, StorageLocation } from './types';

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

/** Things every kitchen has, so they never count as "missing". */
const BASICS = ['salt', 'pepper', 'black pepper', 'water', 'ice', 'sea salt', 'kosher salt', 'salt and pepper', 'ground black pepper'];
export const isBasic = (name: string) => BASICS.includes(normalizeName(name));

/**
 * Staples most kitchens keep stocked (oils, butter, vinegar, flour, sugar,
 * sauces, dried herbs and ground spices). They show as "staple" instead of
 * NEED; if you're actually out, the row's + adds it to the list.
 */
const STAPLE_WORDS = [
  'oil', 'olive oil', 'vegetable oil', 'canola oil', 'cooking oil', 'avocado oil', 'sesame oil', 'coconut oil', 'cooking spray',
  'butter', 'unsalted butter', 'salted butter',
  'vinegar', 'white vinegar', 'apple cider vinegar', 'balsamic vinegar', 'red wine vinegar', 'rice vinegar',
  'flour', 'all purpose flour', 'sugar', 'brown sugar', 'granulated sugar', 'baking soda', 'baking powder', 'cornstarch', 'corn starch',
  'soy sauce', 'honey', 'ketchup', 'mustard', 'dijon mustard', 'hot sauce', 'worcestershire sauce',
  'paprika', 'smoked paprika', 'cumin', 'oregano', 'thyme', 'rosemary', 'basil', 'chili powder', 'chili flake', 'red pepper flake',
  'crushed red pepper', 'cayenne', 'cayenne pepper', 'garlic powder', 'onion powder', 'cinnamon', 'nutmeg', 'italian seasoning',
  'bay leaf', 'curry powder', 'turmeric', 'coriander', 'garam masala', 'dried parsley', 'dried dill', 'vanilla', 'vanilla extract',
];
const STAPLE_SET = new Set(STAPLE_WORDS.map((w) => normalizeName(w)));
export const isStaple = (name: string) => {
  const core = coreName(name);
  if (STAPLE_SET.has(core)) {
    // fresh herbs are produce, not pantry staples
    return !/\bfresh\b/i.test(name) || /\bdried or fresh\b|\bfresh or dried\b/i.test(name);
  }
  return /\b(dried|ground)\b/i.test(name) && core.split(' ').length <= 2;
};

/** Descriptor words that don't change which ingredient it is. */
const DESCRIPTORS = new Set([
  'dried', 'fresh', 'or', 'and', 'chopped', 'minced', 'diced', 'sliced', 'grated', 'shredded', 'crushed', 'ground', 'large', 'small',
  'medium', 'whole', 'finely', 'roughly', 'thinly', 'to', 'taste', 'optional', 'for', 'serving', 'garnish', 'extra', 'virgin', 'of',
  'leaf', 'leave', 'sprig', 'clove', 'pinch', 'a', 'the', 'softened', 'melted', 'room', 'temperature', 'boneless', 'skinless', 'peeled',
]);
export function coreName(name: string): string {
  const words = normalizeName(name).split(' ').filter((w) => w && !DESCRIPTORS.has(w));
  return words.join(' ') || normalizeName(name);
}

/** Merge lines that are the same ingredient ("dried rosemary" + "dried or fresh rosemary"). */
export function mergeIngredients(list: Ingredient[]): Ingredient[] {
  const out: Ingredient[] = [];
  for (const ing of list) {
    const core = coreName(ing.name);
    const twin = out.find((o) => coreName(o.name) === core);
    if (!twin) {
      out.push({ ...ing });
      continue;
    }
    if (twin.qty != null && ing.qty != null && twin.unit === ing.unit) twin.qty = Math.round((twin.qty + ing.qty) * 100) / 100;
    else if (twin.qty == null && ing.qty != null) {
      twin.qty = ing.qty;
      twin.unit = ing.unit;
    }
  }
  return out;
}

export const namesMatch = (a: string, b: string) => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // word-boundary containment, e.g. "fresh spinach" ~ "spinach", "chicken breast" ~ "chicken"
  const pad = (s: string) => ` ${s} `;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (!pad(long).includes(pad(short))) return false;
  // ...but not when the extra words make it a different food:
  // "duck eggs" ≠ "eggs", "coconut milk" ≠ "milk", "chicken broth" ≠ "chicken", "garlic powder" ≠ "garlic".
  const shortWords = new Set(short.split(' '));
  const extra = long.split(' ').filter((w) => !shortWords.has(w));
  return !extra.some((w) => DIFFERENT_FOOD.has(w));
};

/** Words that turn one food into another when added to its name. */
const DIFFERENT_FOOD = new Set(
  [
    // a different animal / plant source
    'duck', 'quail', 'goose', 'coconut', 'almond', 'oat', 'soy', 'peanut', 'cashew', 'sweet', 'sour',
    // a product made from it
    'broth', 'stock', 'sauce', 'powder', 'paste', 'oil', 'butter', 'flour', 'seasoning', 'bouillon', 'cube', 'extract', 'vinegar', 'syrup',
    'chip', 'crisp', 'noodle', 'breadcrumb', 'crumb', 'cream', 'milk', 'cheese', 'water', 'wine', 'jam', 'jelly', 'candy', 'cracker', 'bar', 'mix', 'dressing',
  ].map((w) => normalizeName(w)),
);

/** Mark unchecked grocery rows that match any of the bought names. */
export function checkOffBoughtGroceries(groceries: GroceryItem[], boughtNames: string[], now: string): GroceryItem[] {
  const names = boughtNames.map((n) => n.trim()).filter(Boolean);
  if (!names.length) return groceries;
  return groceries.map((item) => {
    if (item.checked) return item;
    return names.some((name) => namesMatch(item.name, name))
      ? { ...item, checked: true, checkedAt: now }
      : item;
  });
}

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
  /** Main protein(s) the recipe needs that you have / don't have. */
  proteinHave: number;
  proteinMissing: number;
  /** How good a pick this is for YOUR kitchen right now (higher = better). */
  score: number;
}

const PROTEIN_RE =
  /\b(chicken|beef|steak|sirloin|ribeye|brisket|short ribs?|ground (beef|turkey|pork|lamb|meat)|mince|shrimp|prawns?|salmon|tuna|cod|tilapia|halibut|trout|sea bass|fish|crab|lobster|scallops?|mussels?|clams?|squid|calamari|pork|bacon|sausages?|chorizo|ham|prosciutto|pancetta|lamb|veal|turkey|duck|quail|tofu|tempeh|seitan|lentils?|chickpeas?|black beans?|kidney beans?|cannellini|edamame)\b/;
/** Main protein (meat, fish, tofu, beans). Eggs are a side protein: they don't make a dinner on their own. */
export const isProtein = (name: string) => {
  const n = name.toLowerCase();
  if (/\begg(s| whites?| yolks?)?\b/.test(n) && !/\beggplants?\b/.test(n) && !PROTEIN_RE.test(n.replace(/\bduck eggs?\b/, ''))) return false;
  return PROTEIN_RE.test(normalizeName(name)) || PROTEIN_RE.test(n);
};

export const pantryHas = (pantry: PantryItem[], ingredientName: string) =>
  isBasic(ingredientName) ||
  isStaple(ingredientName) ||
  pantry.some((p) => freshness(p.expiresAt) !== 'expired' && namesMatch(p.name, ingredientName));

export const matchRecipe = (recipe: Recipe, pantry: PantryItem[]): RecipeMatch => {
  const counted = recipe.ingredients.filter((i) => !isBasic(i.name) && !isStaple(i.name));
  const missing = counted.filter((i) => !pantryHas(pantry, i.name));
  const soon = pantry.filter((p) => freshness(p.expiresAt) === 'soon');
  const usesExpiring = counted.filter((i) => soon.some((p) => namesMatch(p.name, i.name))).length;
  const total = counted.length;
  const have = total - missing.length;
  const ratio = total === 0 ? 0 : have / total;
  const proteins = counted.filter((i) => isProtein(i.name));
  const proteinMissing = proteins.filter((i) => missing.includes(i)).length;
  const proteinHave = proteins.length - proteinMissing;
  // A real dinner you can mostly make beats a 1-ingredient dish; having the main protein matters most.
  const score =
    ratio +
    Math.min(have, 6) * 0.1 +
    proteinHave * 0.45 -
    proteinMissing * 0.35 -
    Math.max(0, missing.length - 2) * 0.08 +
    usesExpiring * 0.15 -
    (total < 2 ? 0.3 : 0);
  return { have, total, missing, ratio, usesExpiring, proteinHave, proteinMissing, score };
};

export interface KitchenInsight {
  text: string;
  /** Ingredient to add to the shopping list, if there's one obvious buy. */
  buy?: string;
}

/**
 * FridgeGenie's proactive read of your kitchen: out of protein? one item away from a bunch of dinners?
 * Recomputed every time the kitchen or recipes change.
 */
export function kitchenInsight(pool: Recipe[], pantry: PantryItem[], diets: string[] = []): KitchenInsight | null {
  if (!pool.length) return null;
  const fresh = pantry.filter((p) => freshness(p.expiresAt) !== 'expired');
  const proteinsOnHand = fresh.filter((p) => isProtein(p.name));
  // Which single missing ingredient would unlock the most dinners?
  const unlock = new Map<string, { name: string; count: number; protein: boolean }>();
  let ready = 0;
  for (const r of pool) {
    const m = matchRecipe(r, fresh);
    if (m.total < 1) continue;
    if (m.missing.length === 0) ready++;
    if (m.missing.length !== 1) continue;
    const name = m.missing[0].name.replace(/\s*\(.*?\)\s*/g, ' ').split(',')[0].trim().toLowerCase();
    const key = coreName(name);
    const cur = unlock.get(key) ?? { name, count: 0, protein: isProtein(name) };
    if (name.length < cur.name.length) cur.name = name; // keep the plainest wording ("chicken thighs" over "bone-in chicken thighs")
    cur.count++;
    unlock.set(key, cur);
  }
  const best = [...unlock.values()].sort((a, b) => b.count - a.count || Number(b.protein) - Number(a.protein))[0];
  const bestProtein = [...unlock.values()].filter((u) => u.protein).sort((a, b) => b.count - a.count)[0];
  if (fresh.length && !proteinsOnHand.length) {
    const plant = diets.some((d) => d === 'vegan' || d === 'plant-based' || d === 'vegetarian');
    const pick = bestProtein ?? { name: plant ? 'tofu' : 'chicken thighs', count: 0 };
    return {
      text: pick.count
        ? `You're out of protein. Grab ${pick.name} and you can make ${pick.count} more dinner${pick.count === 1 ? '' : 's'}.`
        : `You're out of protein. Add ${plant ? 'tofu, beans or lentils' : 'chicken, beef or shrimp'} and I'll have way more dinners for you.`,
      buy: pick.name,
    };
  }
  if (best && best.count >= 2) {
    return { text: `${ready ? `You can make ${ready} dinner${ready === 1 ? '' : 's'} right now. ` : ''}Grab ${best.name} and ${best.count} more open up.`, buy: best.name };
  }
  if (ready) return { text: `You can make ${ready} dinner${ready === 1 ? '' : 's'} with what you have right now.` };
  return null;
}

export const rankSuggestions = (recipes: Recipe[], pantry: PantryItem[]) =>
  recipes
    .map((r) => ({ recipe: r, match: matchRecipe(r, pantry) }))
    .filter((x) => x.match.have > 0)
    .sort((a, b) => b.match.score - a.match.score);

/** Local day key YYYY-MM-DD. */
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayHash = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

/**
 * Tonight's ranking: mostly-have + uses food going off, skips recipes cooked this week
 * and ones passed on today, with a per-day shuffle so the pick changes daily.
 */
export const pickTonight = (
  recipes: Recipe[],
  pantry: PantryItem[],
  opts: { passes: string[]; cookLog: Record<string, string>; today: string },
) => {
  const weekAgo = Date.now() - 7 * 86400000;
  const fresh = (r: Recipe) => !(opts.cookLog[r.id] && Date.parse(opts.cookLog[r.id]) > weekAgo);
  let pool = recipes.filter((r) => !opts.passes.includes(r.id) && fresh(r));
  if (!pool.length) pool = recipes.filter((r) => !opts.passes.includes(r.id));
  return pool
    .map((recipe) => {
      const match = matchRecipe(recipe, pantry);
      const score = match.score + dayHash(recipe.id + opts.today) * 0.2;
      return { recipe, match, score };
    })
    .sort((a, b) => b.score - a.score);
};

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
