// Fetches (and caches on the server) an illustration for one cooking step.
// The `step-image` Supabase function draws it once and stores it, so the same
// step never costs twice.
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { plusErrorFromResponse, plusHeaders } from '@/lib/plus';
import type { Recipe } from '@/lib/types';

const inFlight = new Map<string, Promise<string | null>>();
const REQUEST_TIMEOUT_MS = 35_000;

/** Pull a public image URL out of the function's JSON, however it's wrapped. */
export function urlFromStepImageResponse(data: unknown): string | null {
  if (typeof data === 'string' && /^https?:\/\//.test(data)) return data;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const nested = d.data && typeof d.data === 'object' ? (d.data as Record<string, unknown>) : null;
  const candidates = [d.url, d.publicUrl, d.public_url, nested?.url, nested?.publicUrl];
  for (const u of candidates) {
    if (typeof u === 'string' && /^https?:\/\//.test(u.trim())) return u.trim();
  }
  return null;
}

async function requestStepImage(recipe: Recipe, index: number): Promise<string | null> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const step = recipe.steps[index];
  if (!base || !key || !step) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/functions/v1/step-image`, {
      method: 'POST',
      headers: plusHeaders({ 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` }),
      body: JSON.stringify({
        title: recipe.title,
        step,
        index,
        total: recipe.steps.length,
        ingredients: recipe.ingredients.map((i) => i.name).slice(0, 15),
        recipeId: recipe.id,
      }),
      signal: ac.signal,
    });
    const data = await res.json().catch(() => null);
    if (plusErrorFromResponse(res.status, data, 'cook')) return null;
    if (!res.ok) return null;
    return urlFromStepImageResponse(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type StepImageStatus = {
  url: string | null;
  failed: boolean;
};

/** Loads the illustration for `index` and pre-loads the next one. */
export function useStepImages(recipe: Recipe | undefined, index: number, enabled = true): StepImageStatus {
  const setStepImage = useApp((s) => s.setStepImage);
  const stored = recipe?.stepImages?.[index] ?? null;
  const [local, setLocal] = useState<Record<number, string | 'failed'>>({});

  useEffect(() => {
    if (!recipe || !enabled) return;
    const recipeId = String(recipe.id);
    let cancelled = false;

    for (const i of [index, index + 1]) {
      if (i < 0 || i >= recipe.steps.length) continue;
      const storedUrl = recipe.stepImages?.[i];
      if (storedUrl) {
        setLocal((s) => (s[i] === storedUrl ? s : { ...s, [i]: storedUrl }));
        continue;
      }
      const k = `${recipeId}:${i}:${recipe.steps[i]}`;
      let p = inFlight.get(k);
      if (!p) {
        p = requestStepImage(recipe, i).catch(() => null);
        inFlight.set(k, p);
      }
      p.then((url) => {
        if (cancelled) return;
        if (url) {
          setStepImage(recipeId, i, url);
          setLocal((s) => ({ ...s, [i]: url }));
        } else {
          inFlight.delete(k);
          setLocal((s) => ({ ...s, [i]: 'failed' }));
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [recipe, index, setStepImage, enabled]);

  const fromLocal = local[index];
  const url = (typeof fromLocal === 'string' && fromLocal !== 'failed' ? fromLocal : null) ?? stored ?? null;
  const failed = fromLocal === 'failed' && !url;
  return { url, failed };
}
