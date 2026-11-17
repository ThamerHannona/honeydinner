// Picks up recipes saved from the iOS share sheet (TikTok, Instagram, …) and adds them
// to the app. Runs on launch and every time the app comes back to the foreground.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { drainInbox, writeShareSettings } from './share-inbox';
import { toast, useApp } from './store';
import { PLATFORM_LABEL } from './services/kitchen-ai';

export const whenHydrated = (fn: () => void) => {
  if (useApp.persist.hasHydrated()) fn();
  else {
    const unsub = useApp.persist.onFinishHydration(() => { unsub(); fn(); });
  }
};

let ingesting: Promise<{ lastId: string | null; hasLink: boolean }> | null = null;

/** Moves everything from the share inbox into the app. */
export async function ingestInbox(): Promise<{ lastId: string | null; hasLink: boolean }> {
  if (ingesting) return ingesting;
  ingesting = (async () => {
  const { recipes, links } = await drainInbox();
  const save = useApp.getState().saveRecipe;
  let lastId: string | null = null;
  for (const { sharedAt: _sharedAt, ...draft } of recipes) lastId = save(draft, true);
  if (recipes.length === 1) {
    const r = recipes[0];
    toast(`Saved from ${PLATFORM_LABEL[r.source.platform] ?? 'the web'}: ${r.title}`);
  } else if (recipes.length > 1) toast(`${recipes.length} shared recipes saved.`);
  // Links the share sheet couldn't finish: read them now.
  if (links.length) {
    setTimeout(() => router.push({ pathname: '/import-loading', params: { kind: 'link', url: links[0] } }), 300);
  }
  return { lastId, hasLink: links.length > 0 };
  })();
  try { return await ingesting; } finally { ingesting = null; }
}

export function useShareInbox() {
  // keep the share panel's copy of the recipe-language setting current
  useEffect(() => {
    whenHydrated(() => writeShareSettings({ lang: useApp.getState().recipeLanguage }));
    return useApp.subscribe((st, prev) => {
      if (st.recipeLanguage !== prev.recipeLanguage) writeShareSettings({ lang: st.recipeLanguage });
    });
  }, []);
  useEffect(() => {
    whenHydrated(() => { void ingestInbox(); });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') whenHydrated(() => { void ingestInbox(); });
    });
    return () => sub.remove();
  }, []);
}

/** The share panel passes the post link as ?url=. Router params can arrive
 *  encoded once or twice depending on the path taken, so decode until stable. */
export function decodeSharedUrl(raw: string | string[] | undefined): string | null {
  let v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  for (let i = 0; i < 3 && /%[0-9A-Fa-f]{2}/.test(v); i++) {
    try { v = decodeURIComponent(v); } catch { break; }
  }
  return /^https?:\/\//i.test(v) ? v : null;
}
