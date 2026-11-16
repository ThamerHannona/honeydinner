import type { Diet, PantryItem, RecipeDraft } from '@/lib/types';

export interface GenieIdea {
  title: string;
  blurb: string;
  servings: number;
  cookTime: number;
  tags: string[];
  uses: string[];
  ingredients: { name: string; qty: number | null; unit: string; have: boolean }[];
  steps: string[];
}

export const DIETS: { id: Diet; label: string; emoji: string }[] = [
  { id: 'keto', label: 'Keto', emoji: '🥑' },
  { id: 'carnivore', label: 'Carnivore', emoji: '🥩' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
  { id: 'paleo', label: 'Paleo', emoji: '🍖' },
  { id: 'atkins', label: 'Atkins', emoji: '🥓' },
  { id: 'low-carb', label: 'Low-carb', emoji: '🥦' },
  { id: 'high-protein', label: 'High-protein', emoji: '💪' },
  { id: 'low-fat', label: 'Low-fat', emoji: '🥗' },
  { id: 'whole30', label: 'Whole30', emoji: '🍠' },
  { id: 'vegan', label: 'Vegan', emoji: '🌿' },
  { id: 'plant-based', label: 'Plant-based', emoji: '🌱' },
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥚' },
  { id: 'pescatarian', label: 'Pescatarian', emoji: '🐟' },
  { id: 'gluten-free', label: 'Gluten-free', emoji: '🌾' },
  { id: 'dairy-free', label: 'Dairy-free', emoji: '🥛' },
  { id: 'nut-free', label: 'Nut-free', emoji: '🥜' },
  { id: 'low-sugar', label: 'Low-sugar', emoji: '🍬' },
  { id: 'low-sodium', label: 'Low-sodium', emoji: '🧂' },
  { id: 'halal', label: 'Halal', emoji: '☪️' },
  { id: 'kosher', label: 'Kosher', emoji: '✡️' },
];

const base = () => process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
const headers = () => {
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return { 'content-type': 'application/json', apikey: anon, authorization: `Bearer ${anon}` };
};

const daysLeft = (iso: string | null) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86400000) : null);

export async function askGenieForRecipes(opts: { diets: Diet[]; pantry: PantryItem[]; servings: number; avoid: string[]; mood?: string }): Promise<GenieIdea[]> {
  const res = await fetch(`${base()}/functions/v1/genie-recipes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      diets: opts.diets,
      servings: opts.servings,
      avoid: opts.avoid.slice(0, 50),
      mood: opts.mood ?? '',
      pantry: opts.pantry.map((p) => ({ name: p.name, location: p.location, daysLeft: daysLeft(p.expiresAt) })),
    }),
  });
  const json = (await res.json().catch(() => null)) as { recipes?: GenieIdea[]; error?: string } | null;
  if (!res.ok || !json?.recipes?.length) throw new Error(json?.error ?? 'FridgeGenie is stuck. Try again.');
  return json.recipes;
}

export const GENIE_PLACEHOLDER = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop';

export function ideaToDraft(idea: GenieIdea): RecipeDraft {
  return {
    title: idea.title,
    image: GENIE_PLACEHOLDER,
    servings: idea.servings,
    cookTime: idea.cookTime,
    ingredients: idea.ingredients.map(({ name, qty, unit }) => ({ name, qty, unit })),
    steps: idea.steps,
    source: { platform: 'genie', url: null, creator: 'FridgeGenie' },
    note: idea.blurb,
  };
}

/** Ask the step-image function for a photo of the finished dish. */
export async function dishPhoto(idea: { title: string; ingredients: { name: string }[] }): Promise<string | null> {
  try {
    const res = await fetch(`${base()}/functions/v1/step-image`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        title: idea.title,
        step: 'The finished dish, beautifully plated on a ceramic plate, ready to serve.',
        ingredients: idea.ingredients.map((i) => i.name).slice(0, 12),
      }),
    });
    const json = (await res.json().catch(() => null)) as { url?: string } | null;
    return json?.url ?? null;
  } catch {
    return null;
  }
}
