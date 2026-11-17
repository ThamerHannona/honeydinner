import { guessEmoji } from '../kitchen';
import type { DetectedItem, Ingredient, RecipeDraft, SourcePlatform } from '../types';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const img = (id: string) => `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;

/* -------------------------------------------------------------------------- */
/* Platform detection                                                          */
/* -------------------------------------------------------------------------- */

export const PLATFORM_LABEL: Record<SourcePlatform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
  web: 'Web',
  photo: 'Photo',
  genie: 'FridgeGenie',
};

export const extractUrl = (text: string): string | null => {
  const m = text.match(/https?:\/\/[^\s]+/i) ?? text.match(/\b(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\/[^\s]*/i);
  if (!m) return null;
  return m[0].startsWith('http') ? m[0] : `https://${m[0]}`;
};

/**
 * detectPlatform(url)
 * Real: same idea — hostname matching. Also handles short links
 * (vm.tiktok.com, fb.watch, instagr.am, t.snapchat.com).
 */
export function detectPlatform(url: string): SourcePlatform | null {
  const u = extractUrl(url);
  if (!u) return null;
  let host = '';
  try {
    host = new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)(instagram\.com|instagr\.am)$/.test(host)) return 'instagram';
  if (/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/.test(host)) return 'facebook';
  if (/(^|\.)snapchat\.com$/.test(host)) return 'snapchat';
  return 'web';
}

/* -------------------------------------------------------------------------- */
/* Pipeline pieces                                                             */
/* -------------------------------------------------------------------------- */

export interface PostMetadata {
  caption: string;
  creator: string | null;
  thumbnail: string;
}

/**
 * In v2: imports are real.
 * We only store the original link + creator handle + thumbnail and the structured recipe.
 * We never download or store the creator's video file.
 */

/* -------------------------------------------------------------------------- */
/* Orchestrators used by screens                                               */
/* -------------------------------------------------------------------------- */

export type ImportStep = 'caption' | 'audio' | 'onscreen' | 'writing';
export const IMPORT_STEPS: { key: ImportStep; label: string }[] = [
  { key: 'caption', label: 'Reading caption' },
  { key: 'audio', label: 'Listening to audio' },
  { key: 'onscreen', label: 'Reading on-screen text' },
  { key: 'writing', label: 'Writing recipe' },
];

export class ImportFailedError extends Error {}

export type ImportInput =
  | { kind: 'link'; url: string }
  | { kind: 'image'; uri: string }
  | { kind: 'video'; uri: string };

/** Simulated: links containing "fail", or links with no post path, can't be read. */
const looksUnreadable = (url: string) => {
  if (/fail|nope|private/i.test(url)) return true;
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/+$/, '').length < 2;
  } catch {
    return true;
  }
};

export async function importRecipe(
  input: ImportInput,
  onStep: (step: ImportStep) => void,
): Promise<RecipeDraft> {
  if (input.kind === 'link') {
    const url = extractUrl(input.url) ?? input.url;
    const platform = detectPlatform(url) ?? 'web';
    onStep('caption');
    if (looksUnreadable(url)) throw new ImportFailedError("Couldn't find the recipe in that post.");

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new ImportFailedError("Couldn't find the recipe in that post.");
    }

    // Keep the existing progress UI moving while the Edge Function does the real work.
    let stopped = false;
    const steps: ImportStep[] = ['caption', 'audio', 'onscreen'];
    let idx = 0;
    const tick = () => {
      if (stopped) return;
      idx = Math.min(idx + 1, steps.length - 1);
      onStep(steps[idx]);
    };
    const timer = setInterval(tick, 900);
    try {
      const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/import-recipe`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: supabaseAnonKey,
          authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error('Import failed');
      const data = (await res.json().catch(() => null)) as null | { recipe?: RecipeDraft };
      if (!data?.recipe) throw new Error('Import failed');
      onStep('writing');
      return {
        ...data.recipe,
        // Ensure platform/url reflect what the user imported (backend may normalize internally).
        source: { ...data.recipe.source, platform, url },
      };
    } catch {
      throw new ImportFailedError("Couldn't find the recipe in that post.");
    } finally {
      stopped = true;
      clearInterval(timer);
    }
  }

  // Screenshot / photo / screen recording
  onStep('caption');
  onStep('writing');
  throw new ImportFailedError("Couldn't find the recipe in that post.");
}

export const blankDraft = (platform: SourcePlatform = 'web', url: string | null = null): RecipeDraft => ({
  title: '',
  image: img('photo-1490645935967-10de6ba17061'),
  servings: 2,
  cookTime: 30,
  ingredients: [{ name: '', qty: null, unit: '' }],
  steps: [''],
  source: { platform, url, creator: null },
});

/* -------------------------------------------------------------------------- */
/* Scanning                                                                    */
/* -------------------------------------------------------------------------- */

export type ScanPhoto = { uri: string; base64?: string | null };

let did = 0;
const d = (name: string, quantity: string, location: DetectedItem['location'], expiresInDays: number | null): DetectedItem => ({
  id: `d-${Date.now()}-${++did}`,
  name,
  emoji: guessEmoji(name),
  quantity,
  location,
  expiresInDays,
});

async function readBase64(photo: ScanPhoto): Promise<string> {
  // iPhone photos are often HEIC, which the vision model rejects. Always re-encode
  // to a 1600px JPEG on the phone: right format, and a much smaller upload.
  if (photo.uri) {
    try {
      const IM = await import('expo-image-manipulator');
      const out = await IM.manipulateAsync(photo.uri, [{ resize: { width: 2000 } }], {
        compress: 0.85,
        format: IM.SaveFormat.JPEG,
        base64: true,
      });
      if (out.base64 && out.base64.length > 80) return out.base64;
    } catch { /* fall back to the original bytes */ }
  }
  const raw = photo.base64?.replace(/^data:[^,]+,/, '').replace(/\s+/g, '') ?? '';
  if (raw.length > 80) return raw;
  if (!photo.uri) throw new Error('No photo');
  const FileSystem = await import('expo-file-system/legacy');
  return FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
}

function itemsFromResponse(raw: unknown, fallback: DetectedItem['location']): DetectedItem[] {
  const list = Array.isArray(raw) ? raw : (raw as { items?: unknown })?.items;
  if (!Array.isArray(list)) return [];
  const locs: DetectedItem['location'][] = ['fridge', 'freezer', 'pantry'];
  const out: DetectedItem[] = [];
  for (const row of list.slice(0, 40)) {
    const r = row as Record<string, unknown>;
    const name = String(r?.name ?? '').trim();
    if (!name) continue;
    const loc = String(r?.location ?? fallback) as DetectedItem['location'];
    const exp = r?.expiresInDays;
    const expiresInDays = exp === null || exp === undefined || exp === ''
      ? null
      : Math.max(0, Math.min(730, Math.round(Number(exp))));
    out.push(d(
      name,
      String(r?.quantity ?? r?.qty ?? '1').trim() || '1',
      locs.includes(loc) ? loc : fallback,
      expiresInDays !== null && !Number.isFinite(expiresInDays) ? null : expiresInDays,
    ));
  }
  return out;
}

/**
 * Long receipts get split into overlapping vertical sections. Vision models
 * shrink every image to ~768px on its short side, so a whole tall receipt in
 * one picture turns the small print to mush; sections keep it legible.
 */
async function receiptSections(photo: ScanPhoto): Promise<string[] | null> {
  if (!photo.uri) return null;
  try {
    const IM = await import('expo-image-manipulator');
    const base = await IM.manipulateAsync(photo.uri, [{ resize: { width: 1600 } }], { compress: 1, format: IM.SaveFormat.JPEG });
    const { width: w, height: h } = base;
    if (!w || !h || h / w < 1.6) return null; // short receipt: one image is fine
    const tileH = Math.round(w * 1.3);
    const step = Math.round(tileH * 0.85); // 15% overlap so no line is cut in half
    const tiles: string[] = [];
    for (let y = 0; y < h && tiles.length < 5; y += step) {
      const height = Math.min(tileH, h - y);
      if (height < w * 0.25 && tiles.length) break; // tiny leftover strip
      const out = await IM.manipulateAsync(base.uri, [{ crop: { originX: 0, originY: y, width: w, height } }], {
        compress: 0.85,
        format: IM.SaveFormat.JPEG,
        base64: true,
      });
      if (out.base64) tiles.push(out.base64);
      if (y + height >= h) break;
    }
    return tiles.length > 1 ? tiles : null;
  } catch {
    return null;
  }
}

async function scanWithVision(mode: 'receipt' | 'fridge', photo: ScanPhoto): Promise<DetectedItem[]> {
  const sections = mode === 'receipt' ? await receiptSections(photo) : null;
  const image = sections ? sections[0] : await readBase64(photo);
  if (!image) throw new Error('No photo');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) throw new Error('Not configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 75000);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/functions/v1/scan-kitchen`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: anon,
        authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify(sections ? { mode, images: sections } : { mode, image }),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null) as { items?: unknown; error?: string } | null;
    if (!res.ok) throw new Error(body?.error || 'Couldn\'t read that photo');
    const items = itemsFromResponse(body, mode === 'receipt' ? 'pantry' : 'fridge');
    if (!items.length) throw new Error('No items found');
    return items;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * scanReceipt(photo)
 * OCR the receipt with a vision model, map line items like "ORG BBY SPIN 5OZ"
 * to friendly names, quantities and typical shelf life.
 */
export async function scanReceipt(photo: ScanPhoto): Promise<DetectedItem[]> {
  return scanWithVision('receipt', photo);
}

/**
 * scanFridge(photo)
 * Vision model identifies visible items and estimates freshness.
 */
export async function scanFridge(photo: ScanPhoto): Promise<DetectedItem[]> {
  return scanWithVision('fridge', photo);
}
