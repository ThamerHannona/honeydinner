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

let did = 0;
const d = (name: string, quantity: string, location: DetectedItem['location'], expiresInDays: number | null): DetectedItem => ({
  id: `d-${Date.now()}-${++did}`,
  name,
  emoji: guessEmoji(name),
  quantity,
  location,
  expiresInDays,
});

/**
 * scanReceipt(photoUri)
 * Real: OCR the receipt (vision LLM), map line items like "ORG BBY SPIN 5OZ"
 * to friendly names, quantities and typical shelf life.
 */
export async function scanReceipt(_photoUri: string | null): Promise<DetectedItem[]> {
  await wait(2000);
  return [
    d('Avocados', '3', 'fridge', 4),
    d('Broccoli', '1 head', 'fridge', 6),
    d('Feta', '200 g', 'fridge', 14),
    d('Limes', '4', 'fridge', 10),
    d('Flour tortillas', '1 pack', 'pantry', 10),
    d('Honey', '1 jar', 'pantry', null),
    d('Chicken breast', '500 g', 'fridge', 2),
    d('Frozen berries', '1 bag', 'freezer', 120),
  ];
}

/**
 * scanFridge(photoUri)
 * Real: vision LLM identifies visible items and estimates freshness.
 */
export async function scanFridge(_photoUri: string | null): Promise<DetectedItem[]> {
  await wait(2000);
  return [
    d('Carrots', '5', 'fridge', 12),
    d('Mushrooms', '1 punnet', 'fridge', 3),
    d('Orange juice', '1 L', 'fridge', 6),
    d('Mozzarella', '1 ball', 'fridge', 5),
    d('Cucumber', '1', 'fridge', 5),
    d('Sour cream', '1 tub', 'fridge', 8),
  ];
}
