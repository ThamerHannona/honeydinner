// Hand-off between the iOS share extension and the app.
// The native UIKit share panel writes share-inbox.json in the App Group
// container. The app also still reads the legacy MMKV key used by earlier builds.
import { File, Paths } from 'expo-file-system';
import { MMKV } from 'react-native-mmkv';
import type { RecipeDraft } from './types';

const APP_GROUP = 'group.com.shakeandbakelabs.honeydinner';
const INBOX_FILE = 'share-inbox.json';
const LOG_FILE = 'share-extension.log';

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

export type Pending = { recipes: (RecipeDraft & { sharedAt: string })[]; links: string[] };

const empty = (): Pending => ({ recipes: [], links: [] });

const merge = (a: Pending, b: Pending): Pending => {
  const recipes = [...a.recipes];
  for (const r of b.recipes) {
    if (!recipes.some((x) => x.title === r.title && x.sharedAt === r.sharedAt)) recipes.push(r);
  }
  const links = [...a.links];
  for (const l of b.links) if (!links.includes(l)) links.push(l);
  return { recipes, links };
};

const readMmkv = (): Pending => {
  try {
    const raw = inbox()?.getString('pending');
    const p = raw ? (JSON.parse(raw) as Pending) : null;
    return { recipes: p?.recipes ?? [], links: p?.links ?? [] };
  } catch {
    return empty();
  }
};

const writeMmkv = (p: Pending) => inbox()?.set('pending', JSON.stringify(p));

export function appGroupDir() {
  try {
    const containers = Paths.appleSharedContainers ?? {};
    return containers[APP_GROUP] ?? Object.values(containers)[0] ?? null;
  } catch {
    return null;
  }
}

async function readNativeInbox(): Promise<Pending> {
  try {
    const dir = appGroupDir();
    if (!dir) return empty();
    const f = new File(dir, INBOX_FILE);
    if (!f.exists) return empty();
    const raw = await f.text();
    const p = raw ? (JSON.parse(raw) as Pending) : null;
    try { f.delete(); } catch { /* ignore */ }
    return { recipes: p?.recipes ?? [], links: p?.links ?? [] };
  } catch {
    return empty();
  }
}

export async function readShareExtensionLog(): Promise<string> {
  try {
    const dir = appGroupDir();
    if (!dir) return '';
    const f = new File(dir, LOG_FILE);
    if (!f.exists) return '';
    return await f.text();
  } catch {
    return '';
  }
}

/** Called by the share extension when the recipe was read successfully. */
export function queueRecipe(draft: RecipeDraft) {
  const p = readMmkv();
  p.recipes.push({ ...draft, sharedAt: new Date().toISOString() });
  writeMmkv(p);
}

/** Called by the share extension when reading failed or was cut short: the app finishes it. */
export function queueLink(url: string) {
  const p = readMmkv();
  if (!p.links.includes(url)) p.links.push(url);
  writeMmkv(p);
}

/** Called by the app: returns everything waiting and empties both inboxes. */
export async function drainInbox(): Promise<Pending> {
  const mmkv = readMmkv();
  if (mmkv.recipes.length || mmkv.links.length) inbox()?.delete('pending');
  const native = await readNativeInbox();
  return merge(mmkv, native);
}
