import { useEffect } from 'react';
import { AppState } from 'react-native';
import { dishPhoto, GENIE_PLACEHOLDER, isPlaceholderPhoto } from '@/lib/services/genie-recipes';
import { useApp } from '@/lib/store';

const inFlight = new Set<string>();

/** Apply many image changes in ONE store update, so lists and tabs re-render once instead of once per photo. */
function applyImages(changes: Record<string, string>) {
  const ids = Object.keys(changes);
  if (!ids.length) return;
  useApp.setState((s) => ({
    recipes: s.recipes.map((r) => (changes[r.id] && r.image !== changes[r.id] ? { ...r, image: changes[r.id] } : r)),
  }));
}

/** Recipes showing the stock photo get a real photo of that dish (server caches it). All requests run together. */
async function heal() {
  const list = useApp.getState().recipes.filter((r) => isPlaceholderPhoto(r.image) && !inFlight.has(r.id)).slice(0, 12);
  if (!list.length) return;
  list.forEach((r) => inFlight.add(r.id));
  const results = await Promise.all(
    list.map(async (r) => {
      try {
        return [r.id, await dishPhoto({ title: r.title, ingredients: r.ingredients })] as const;
      } catch {
        return [r.id, null] as const;
      }
    }),
  );
  list.forEach((r) => inFlight.delete(r.id));
  const changes: Record<string, string> = {};
  for (const [id, url] of results) if (url) changes[id] = url;
  applyImages(changes);
}

export function useGeniePhotos() {
  const count = useApp((s) => s.recipes.filter((r) => isPlaceholderPhoto(r.image)).length);
  useEffect(() => {
    if (!count) return;
    const t = setTimeout(() => void heal(), 1500); // let the app settle first
    return () => clearTimeout(t);
  }, [count]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void heal(); });
    return () => sub.remove();
  }, []);
}

const checked = new Set<string>();
const broken: Record<string, string> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * TikTok/Instagram cover links expire after a few days. A failed image load can also just be a cancelled
 * load while scrolling, so double-check the link before replacing it, and batch the replacements.
 */
export function reportBrokenPhoto(recipeId: string, url?: string | null) {
  if (!url || checked.has(url)) return;
  if (!/tiktokcdn|tiktokv|ibyteimg|muscdn|cdninstagram|fbcdn|tikwm/i.test(url)) return;
  checked.add(url);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  fetch(url, { method: 'GET', signal: ac.signal })
    .then((res) => {
      if (res.ok) return; // the photo is fine; the failure was a cancelled/slow load
      broken[recipeId] = GENIE_PLACEHOLDER;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        const batch = { ...broken };
        for (const k of Object.keys(broken)) delete broken[k];
        applyImages(batch);
      }, 800);
    })
    .catch(() => { /* offline or timed out: leave the photo alone */ })
    .finally(() => clearTimeout(t));
}
