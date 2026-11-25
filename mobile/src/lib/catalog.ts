/**
 * The built-in cookbook: hundreds of ready-made recipes per eating style plus desserts,
 * kept on the server (hd_catalog) and cached on the phone. Users browse it in Recipes → Discover,
 * and Tonight / FridgeGenie pick from it alongside the user's own recipes.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useApp } from '@/lib/store';
import type { Diet, Ingredient, Recipe } from '@/lib/types';

export type CatalogCategory = Diet | 'dessert';
export interface CatalogItem {
  id: string;
  category: CatalogCategory;
  title: string;
  image: string | null;
  data: { blurb?: string; servings: number; cookTime: number; cuisine?: string; tags?: string[]; ingredients: Ingredient[]; steps: string[] };
}

const FALLBACK_IMAGE = 'https://rzacuyrcbujcnkpoktyg.supabase.co/storage/v1/object/public/step-images/app/genie-plating-v1.png';
const DAY = 3 * 60 * 60 * 1000; // refresh every few hours (new photos and recipes keep arriving)
const SOON = 5 * 60 * 1000; // …or every 5 minutes while some dish photos are still being made

interface CatalogState {
  items: CatalogItem[];
  fetchedAt: number;
  loading: boolean;
  setItems: (items: CatalogItem[]) => void;
}

export const useCatalog = create<CatalogState>()(
  persist(
    (set) => ({
      items: [],
      fetchedAt: 0,
      loading: false,
      setItems: (items) => set({ items, fetchedAt: Date.now(), loading: false }),
    }),
    { name: 'hd-catalog-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ items: s.items, fetchedAt: s.fetchedAt }) },
  ),
);

export async function refreshCatalog(force = false): Promise<void> {
  const st = useCatalog.getState();
  if (st.loading) return;
  const missing = st.items.some((c) => !c.image);
  if (!force && st.items.length && Date.now() - st.fetchedAt < (missing ? SOON : DAY)) return;
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!base) return;
  useCatalog.setState({ loading: true });
  try {
    const all: CatalogItem[] = [];
    for (let from = 0; from < 5000; from += 1000) {
      const res = await fetch(`${base}/rest/v1/hd_catalog?select=id,category,title,image,data&order=category.asc,title.asc`, {
        headers: { apikey: anon, authorization: `Bearer ${anon}`, Range: `${from}-${from + 999}` },
      });
      if (!res.ok) break;
      const page = (await res.json()) as CatalogItem[];
      all.push(...page);
      if (page.length < 1000) break;
    }
    if (all.length) useCatalog.getState().setItems(all);
    else useCatalog.setState({ loading: false });
  } catch {
    useCatalog.setState({ loading: false });
  }
}

/** Keep the cookbook fresh: load once a day (and on first launch). */
export function useCatalogSync() {
  useEffect(() => {
    void refreshCatalog();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void refreshCatalog();
    });
    return () => sub.remove();
  }, []);
}

/** Only show cookbook recipes once their own dish photo exists — never a stand-in picture. */
export const hasPhoto = (c: CatalogItem) => !!c.image;

const toRecipeCache = new Map<string, Recipe>();
export function catalogToRecipe(c: CatalogItem): Recipe {
  const key = `${c.id}|${c.image ?? ''}`;
  const hit = toRecipeCache.get(key);
  if (hit) return hit;
  const r: Recipe = {
    id: c.id,
    title: c.title,
    image: c.image ?? FALLBACK_IMAGE,
    servings: c.data.servings || 4,
    cookTime: c.data.cookTime || 30,
    ingredients: c.data.ingredients ?? [],
    steps: c.data.steps ?? [],
    source: { platform: 'genie', url: null, creator: 'Honey, Dinner? cookbook' },
    saved: false,
    importedAt: null,
    createdAt: '2026-11-23T00:00:00.000Z',
  };
  toRecipeCache.set(key, r);
  return r;
}

export const isCatalogId = (id: string) => id.startsWith('c-');

/** A recipe by id: the user's own first, then the cookbook. */
export function useRecipe(id: string | undefined): Recipe | undefined {
  const own = useApp((s) => (id ? s.recipes.find((r) => r.id === id) : undefined));
  const item = useCatalog((s) => (id && !own ? s.items.find((c) => c.id === id) : undefined));
  return own ?? (item ? catalogToRecipe(item) : undefined);
}

export function findRecipe(id: string): Recipe | undefined {
  const own = useApp.getState().recipes.find((r) => r.id === id);
  if (own) return own;
  const item = useCatalog.getState().items.find((c) => c.id === id);
  return item ? catalogToRecipe(item) : undefined;
}

/** Copy a cookbook recipe into the user's (shared) recipes, keeping its id. */
export function adoptCatalogRecipe(id: string): Recipe | undefined {
  const st = useApp.getState();
  const own = st.recipes.find((r) => r.id === id);
  if (own) return own;
  const item = useCatalog.getState().items.find((c) => c.id === id);
  if (!item) return undefined;
  const r = { ...catalogToRecipe(item), saved: true, createdAt: new Date().toISOString() };
  useApp.setState((s) => ({ recipes: [r, ...s.recipes] }));
  return r;
}

/** Cookbook recipes that suit the user's eating style (all non-desserts when none is set). */
export function catalogForDiets(items: CatalogItem[], diets: Diet[]): Recipe[] {
  const withPhotos = items.filter(hasPhoto);
  const pool = diets.length ? withPhotos.filter((c) => diets.includes(c.category as Diet)) : withPhotos.filter((c) => c.category !== 'dessert');
  const seen = new Set<string>();
  const out: Recipe[] = [];
  for (const c of pool) {
    const k = c.title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(catalogToRecipe(c));
  }
  return out;
}
