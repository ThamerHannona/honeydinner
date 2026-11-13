// Fetches (and caches on the server) an illustration for one cooking step.
// The `step-image` Supabase function draws it once and stores it, so the same
// step never costs twice.
import { useEffect } from 'react';
import { useApp } from '@/lib/store';
import type { Recipe } from '@/lib/types';

const inFlight = new Map<string, Promise<string | null>>();

async function requestStepImage(recipe: Recipe, index: number): Promise<string | null> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const step = recipe.steps[index];
  if (!base || !key || !step) return null;
  const res = await fetch(`${base.replace(/\/+$/, '')}/functions/v1/step-image`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` },
    body: JSON.stringify({
      title: recipe.title,
      step,
      index,
      total: recipe.steps.length,
      ingredients: recipe.ingredients.map((i) => i.name).slice(0, 15),
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { url?: string } | null;
  return typeof data?.url === 'string' ? data.url : null;
}

/** Loads the illustration for `index` and pre-loads the next one. */
export function useStepImages(recipe: Recipe | undefined, index: number) {
  const setStepImage = useApp((s) => s.setStepImage);
  useEffect(() => {
    if (!recipe) return;
    for (const i of [index, index + 1]) {
      if (i < 0 || i >= recipe.steps.length || recipe.stepImages?.[i]) continue;
      const k = `${recipe.id}:${i}:${recipe.steps[i]}`;
      if (inFlight.has(k)) continue;
      const p = requestStepImage(recipe, i).catch(() => null);
      inFlight.set(k, p);
      p.then((url) => {
        if (url) setStepImage(recipe.id, i, url);
        else inFlight.delete(k); // allow a retry next time the step is shown
      });
    }
  }, [recipe, index, setStepImage]);
}
