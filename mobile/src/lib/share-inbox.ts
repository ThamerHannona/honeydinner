// Hand-off between the iOS share extension and the app.
// Both read and write the same MMKV store, which lives in the shared App Group
// container (expo-share-extension adds the `AppGroup` key to both Info.plists).
import { MMKV } from 'react-native-mmkv';
import type { RecipeDraft } from './types';

let store: MMKV | null = null;
const inbox = (): MMKV | null => {
  if (store) return store;
  try {
    store = new MMKV({ id: 'honey-dinner-share-inbox' });
  } catch {
    store = null; // e.g. web, or App Group missing in a dev build
  }
  return store;
};

type Pending = { recipes: (RecipeDraft & { sharedAt: string })[]; links: string[] };

const read = (): Pending => {
  try {
    const raw = inbox()?.getString('pending');
    const p = raw ? (JSON.parse(raw) as Pending) : null;
    return { recipes: p?.recipes ?? [], links: p?.links ?? [] };
  } catch {
    return { recipes: [], links: [] };
  }
};

const write = (p: Pending) => inbox()?.set('pending', JSON.stringify(p));

/** Called by the share extension when the recipe was read successfully. */
export function queueRecipe(draft: RecipeDraft) {
  const p = read();
  p.recipes.push({ ...draft, sharedAt: new Date().toISOString() });
  write(p);
}

/** Called by the share extension when reading failed or was cut short: the app finishes it. */
export function queueLink(url: string) {
  const p = read();
  if (!p.links.includes(url)) p.links.push(url);
  write(p);
}

/** Called by the app: returns everything waiting and empties the inbox. */
export function drainInbox(): Pending {
  const p = read();
  if (p.recipes.length || p.links.length) inbox()?.delete('pending');
  return p;
}
