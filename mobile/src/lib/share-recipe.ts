import { Share } from 'react-native';
import type { Recipe } from '@/lib/types';

const fmtQty = (q: number | null) => {
  if (q == null) return '';
  const whole = Math.floor(q);
  const frac = q - whole;
  const map: [number, string][] = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']];
  const f = map.find(([v]) => Math.abs(frac - v) < 0.04)?.[1];
  if (f) return whole ? `${whole}${f}` : f;
  return String(Math.round(q * 100) / 100);
};

/** Opens the iOS share sheet with the whole recipe as text, so whoever gets it
 *  (a partner in Messages, a group chat…) can read and cook it even without the app. */
export async function shareRecipe(recipe: Recipe, toName?: string | null) {
  const ingredients = recipe.ingredients
    .map((i) => `• ${[fmtQty(i.qty), i.unit, i.name].filter(Boolean).join(' ')}`)
    .join('\n');
  const steps = recipe.steps.map((s, n) => `${n + 1}. ${s}`).join('\n');
  const link = recipe.source?.url ?? null;
  const message = [
    toName ? `${toName}, dinner idea 🍽️` : 'Dinner idea 🍽️',
    '',
    `${recipe.title} — serves ${recipe.servings}, ~${recipe.cookTime} min`,
    '',
    'Ingredients',
    ingredients,
    '',
    'Steps',
    steps,
    link ? `\nOriginal: ${link}` : '',
    '\nSent from Honey, Dinner?',
  ].join('\n');
  await Share.share({ message, title: recipe.title });
}
