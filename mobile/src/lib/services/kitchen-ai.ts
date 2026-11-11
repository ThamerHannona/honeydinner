/**
 * Kitchen AI service — the ONE place for every import & scanning feature.
 *
 * Everything here is simulated for v1. Each function documents the real
 * implementation we plan to plug in, and keeps the same signature so screens
 * don't need to change when it goes live (likely via our backend at
 * EXPO_PUBLIC_BACKEND_URL so API keys never ship in the app).
 *
 * Privacy rule: we only ever keep the post link, creator handle, thumbnail
 * and the structured recipe — never the creator's video file.
 */
import { guessEmoji } from '../kitchen';
import type { DetectedItem, Ingredient, RecipeDraft, SourcePlatform } from '../types';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
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

interface Template {
  title: string;
  image: string;
  servings: number;
  cookTime: number;
  ingredients: Ingredient[];
  steps: string[];
}

const TEMPLATES: Template[] = [
  {
    title: 'Crispy Hot Honey Chicken Bowls',
    image: img('photo-1546069901-ba9599a7e63c'),
    servings: 2,
    cookTime: 25,
    ingredients: [
      { name: 'Chicken thighs', qty: 400, unit: 'g' },
      { name: 'Jasmine rice', qty: 1, unit: 'cup' },
      { name: 'Honey', qty: 3, unit: 'tbsp' },
      { name: 'Chili flakes', qty: 1, unit: 'tsp' },
      { name: 'Cucumber', qty: 1, unit: '' },
      { name: 'Scallions', qty: 2, unit: '' },
    ],
    steps: [
      'Cook the rice and keep it warm.',
      'Pan-fry the chicken for 6 minutes per side until crispy.',
      'Warm honey with chili flakes for 1 minute and toss the chicken in it.',
      'Build bowls with rice, sliced cucumber, chicken and scallions.',
    ],
  },
  {
    title: 'One-Pan Lemon Garlic Shrimp Pasta',
    image: img('photo-1563379926898-05f4575a45d8'),
    servings: 3,
    cookTime: 20,
    ingredients: [
      { name: 'Spaghetti', qty: 250, unit: 'g' },
      { name: 'Shrimp', qty: 300, unit: 'g' },
      { name: 'Garlic', qty: 5, unit: 'cloves' },
      { name: 'Lemon', qty: 1, unit: '' },
      { name: 'Butter', qty: 2, unit: 'tbsp' },
      { name: 'Parsley', qty: 0.25, unit: 'cup' },
    ],
    steps: [
      'Boil the spaghetti for 9 minutes.',
      'Melt butter with garlic and cook the shrimp for 3 minutes.',
      'Toss in the pasta, lemon juice and a splash of pasta water.',
      'Finish with parsley and lots of black pepper.',
    ],
  },
  {
    title: 'Viral Feta Tomato Bake',
    image: img('photo-1551183053-bf91a1d81141'),
    servings: 4,
    cookTime: 35,
    ingredients: [
      { name: 'Cherry tomatoes', qty: 2, unit: 'punnets' },
      { name: 'Feta', qty: 200, unit: 'g' },
      { name: 'Olive oil', qty: 0.25, unit: 'cup' },
      { name: 'Garlic', qty: 3, unit: 'cloves' },
      { name: 'Spaghetti', qty: 350, unit: 'g' },
      { name: 'Basil', qty: 1, unit: 'handful' },
    ],
    steps: [
      'Heat the oven to 200°C. Put the feta block in a dish surrounded by tomatoes and garlic.',
      'Drizzle with olive oil and bake for 30 minutes.',
      'Meanwhile cook the spaghetti for 9 minutes.',
      'Smash everything together, toss with pasta and tear over basil.',
    ],
  },
  {
    title: 'Cheesy Veggie Quesadillas',
    image: img('photo-1565299624946-b28f40a0ae38'),
    servings: 2,
    cookTime: 15,
    ingredients: [
      { name: 'Flour tortillas', qty: 4, unit: '' },
      { name: 'Cheddar', qty: 1.5, unit: 'cups' },
      { name: 'Bell peppers', qty: 1, unit: '' },
      { name: 'Baby spinach', qty: 1, unit: 'cup' },
      { name: 'Yellow onion', qty: 0.5, unit: '' },
    ],
    steps: [
      'Sauté the peppers and onion for 5 minutes.',
      'Fill tortillas with cheese, veg and spinach.',
      'Toast in a dry pan for 2 minutes per side until melty.',
    ],
  },
];

const CREATORS: Record<SourcePlatform, string[]> = {
  tiktok: ['@cookingwithcleo', '@15minmeals', '@thehungrylad'],
  instagram: ['@platedbypriya', '@supperclub.sam', '@greenpan.gal'],
  facebook: ['@familydinnerhub', '@nanascookbook', '@quickeatsdaily'],
  snapchat: ['@snackattack', '@chef.on.snap', '@latenightlarder'],
  web: ['Half Baked Harvest', 'Smitten Bites', 'NYT Cooking'],
  photo: ['Your photo'],
};

const pick = <T,>(arr: T[], seed: string) => arr[hash(seed) % arr.length];

/**
 * fetchPostMetadata(url) → caption, creator, thumbnail
 * Real: backend calls the platform's oEmbed endpoint (TikTok/Instagram/Facebook)
 * or scrapes OpenGraph tags (Snapchat Spotlight, websites). Never downloads video.
 */
export async function fetchPostMetadata(url: string): Promise<PostMetadata> {
  await wait(700);
  const platform = detectPlatform(url) ?? 'web';
  const t = pick(TEMPLATES, url);
  return {
    caption: `${t.title} 🔥 You need: ${t.ingredients.map((i) => i.name.toLowerCase()).join(', ')}. Full recipe below!`,
    creator: pick(CREATORS[platform], url),
    thumbnail: t.image,
  };
}

/**
 * extractFromCaption(caption)
 * Real: LLM pass over the caption + pinned comment to pull ingredients/steps text.
 */
export async function extractFromCaption(caption: string): Promise<string> {
  await wait(700);
  return caption;
}

/**
 * transcribeVideoAudio(url)
 * Real: backend streams audio only (no storage) to a speech-to-text model.
 */
export async function transcribeVideoAudio(url: string): Promise<string> {
  await wait(900);
  return `Transcript for ${url}: "...add the garlic, cook it about two minutes..."`;
}

/**
 * readOnScreenText(videoFrames)
 * Real: sample ~1 frame/sec, run OCR / a vision model for on-screen captions.
 */
export async function readOnScreenText(videoFrames: string[]): Promise<string> {
  await wait(800);
  return `On-screen text from ${videoFrames.length} frames`;
}

/**
 * extractFromImage(imageOrVideo)
 * Real: send a screenshot / screen recording frames to a vision LLM.
 */
export async function extractFromImage(imageOrVideo: string): Promise<string> {
  await wait(900);
  return `Recipe text read from ${imageOrVideo}`;
}

/**
 * structureRecipe(rawText) → { title, servings, cookTime, ingredients[{name, qty, unit}], steps[] }
 * Real: LLM with a strict JSON schema; we validate before showing the review screen.
 */
export async function structureRecipe(rawText: string): Promise<Template> {
  await wait(800);
  // Mock: if the caption named a dish we know, use it so title & thumbnail line up.
  return TEMPLATES.find((t) => rawText.includes(t.title)) ?? pick(TEMPLATES, rawText);
}

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
    const meta = await fetchPostMetadata(url);
    const captionText = await extractFromCaption(meta.caption);
    onStep('audio');
    const audio = await transcribeVideoAudio(url);
    onStep('onscreen');
    const screen = await readOnScreenText([meta.thumbnail]);
    onStep('writing');
    if (looksUnreadable(url)) {
      await wait(500);
      throw new ImportFailedError("Couldn't find the recipe in that post.");
    }
    const r = await structureRecipe([url, captionText, audio, screen].join('\n'));
    return {
      title: r.title,
      image: meta.thumbnail,
      servings: r.servings,
      cookTime: r.cookTime,
      ingredients: r.ingredients,
      steps: r.steps,
      source: { platform, url, creator: meta.creator },
    };
  }

  // Screenshot / photo / screen recording
  onStep('caption');
  await wait(400);
  onStep('audio');
  const raw = await extractFromImage(input.uri);
  onStep('onscreen');
  await wait(500);
  onStep('writing');
  const r = await structureRecipe(raw);
  return {
    title: r.title,
    image: input.kind === 'image' ? input.uri : r.image,
    servings: r.servings,
    cookTime: r.cookTime,
    ingredients: r.ingredients,
    steps: r.steps,
    source: { platform: 'photo', url: null, creator: input.kind === 'video' ? 'Screen recording' : 'Screenshot' },
  };
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
