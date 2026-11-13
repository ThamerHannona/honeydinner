// Picks up recipes saved from the iOS share sheet (TikTok, Instagram, …) and adds them
// to the app. Runs on launch and every time the app comes back to the foreground.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { drainInbox } from './share-inbox';
import { toast, useApp } from './store';
import { PLATFORM_LABEL } from './services/kitchen-ai';

export const whenHydrated = (fn: () => void) => {
  if (useApp.persist.hasHydrated()) fn();
  else {
    const unsub = useApp.persist.onFinishHydration(() => { unsub(); fn(); });
  }
};

/** Moves everything from the share inbox into the app. Returns the id of the last recipe added. */
export function ingestInbox(): string | null {
  const { recipes, links } = drainInbox();
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
  return lastId;
}

export function useShareInbox() {
  useEffect(() => {
    whenHydrated(() => ingestInbox());
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') whenHydrated(() => ingestInbox());
    });
    return () => sub.remove();
  }, []);
}
