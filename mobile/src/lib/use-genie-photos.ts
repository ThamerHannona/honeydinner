import { useEffect } from 'react';
import { AppState } from 'react-native';
import { dishPhoto, GENIE_PLACEHOLDER } from '@/lib/services/genie-recipes';
import { useApp } from '@/lib/store';

const inFlight = new Set<string>();

/** Genie recipes start with a stock photo; swap in a real photo of that dish (server caches it). Retries on launch/foreground if the app was closed mid-way. */
async function heal() {
  const list = useApp.getState().recipes.filter((r) => r.image === GENIE_PLACEHOLDER && !inFlight.has(r.id));
  for (const r of list.slice(0, 4)) {
    inFlight.add(r.id);
    try {
      const url = await dishPhoto({ title: r.title, ingredients: r.ingredients });
      if (url) useApp.getState().updateRecipe(r.id, { image: url });
    } finally {
      inFlight.delete(r.id);
    }
  }
}

export function useGeniePhotos() {
  const count = useApp((s) => s.recipes.filter((r) => r.image === GENIE_PLACEHOLDER).length);
  useEffect(() => {
    if (count) void heal();
  }, [count]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void heal(); });
    return () => sub.remove();
  }, []);
}

const reported = new Set<string>();
/** TikTok/Instagram cover links expire after a few days. When one fails to load, swap in a freshly drawn photo of the dish. */
export function reportBrokenPhoto(recipeId: string, url?: string | null) {
  if (!url || reported.has(recipeId)) return;
  if (!/tiktokcdn|tiktokv|ibyteimg|muscdn|cdninstagram|fbcdn|tikwm/i.test(url)) return;
  reported.add(recipeId);
  useApp.getState().updateRecipe(recipeId, { image: GENIE_PLACEHOLDER });
}
