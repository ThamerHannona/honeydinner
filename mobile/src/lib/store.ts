import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { todayKey, aisleToLocation, checkOffBoughtGroceries, daysFromNow, defaultShelfLife, formatQty, guessAisle, guessEmoji, mergeIngredients, namesMatch } from './kitchen';
import { createMockData, ME_ID, MOCK_DATA_VERSION, SEED_RECIPE_IDS, starterRecipes } from './mock-data';
import type {
  DetectedItem,
  Diet,
  GroceryItem,
  RecipeLanguage,
  Household,
  Ingredient,
  Member,
  PantryItem,
  Recipe,
  RecipeDraft,
  VoteSession,
  TonightPlan,
  SentRecipe,
} from './types';

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const newAppUserId = () => {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return `hd_${g.crypto.randomUUID()}`;
  return `hd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

interface AppState {
  hydrated: boolean;
  /** Stable id used as the RevenueCat app user id and sent to edge functions. */
  appUserId: string;
  isPlus: boolean;
  hasImported: boolean;
  gentlePaywallShown: boolean;
  freeCookRecipeId: string | null;
  onboarded: boolean;
  signedIn: boolean;
  members: Member[];
  pantry: PantryItem[];
  recipes: Recipe[];
  groceries: GroceryItem[];
  vote: VoteSession | null;
  lastClipboard: string | null;
  household: Household | null;
  diets: Diet[];
  expiryNudges: boolean;
  recipeLanguage: RecipeLanguage;
  tonight: TonightPlan | null;
  /** recipeId -> last time it was cooked (ISO). */
  cookLog: Record<string, string>;
  /** Day-1 checklist: user has asked the genie for ideas at least once. */
  genieUsed: boolean;
  checklistDismissed: boolean;

  // ephemeral drafts (not persisted)
  importDraft: RecipeDraft | null;
  scanDraft: DetectedItem[];

  completeOnboarding: (name?: string) => void;
  signIn: () => void;
  signOut: () => void;
  setPlus: (on: boolean) => void;
  markImported: () => void;
  markGentlePaywallShown: () => void;
  setFreeCookRecipeId: (id: string | null) => void;
  invitePartner: (name: string) => void;
  renameMember: (id: string, name: string) => void;
  clearKitchen: () => void;
  resetDemo: () => void;
  setLastClipboard: (text: string) => void;

  addPantryItem: (item: Omit<PantryItem, 'id' | 'addedAt'>) => void;
  addDetectedItems: (items: DetectedItem[]) => void;
  markUsed: (id: string) => PantryItem | undefined;
  restorePantryItem: (item: PantryItem) => void;

  setImportDraft: (d: RecipeDraft | null) => void;
  setScanDraft: (d: DetectedItem[]) => void;
  saveRecipe: (d: RecipeDraft, imported: boolean) => string;
  toggleSaved: (id: string) => void;
  deleteRecipe: (id: string) => void;
  updateRecipe: (id: string, patch: Partial<Recipe>) => void;
  setStepImage: (id: string, index: number, url: string) => void;

  addToGroceries: (ingredients: Ingredient[], recipeId: string | null) => number;
  addGrocery: (name: string) => void;
  toggleGrocery: (id: string) => GroceryItem | undefined;
  clearGotIt: () => void;

  sendVote: (optionIds: string[]) => void;
  pickVote: (recipeId: string) => void;
  clearVote: () => void;

  setDiets: (d: Diet[]) => void;
  setExpiryNudges: (on: boolean) => void;
  setRecipeLanguage: (l: RecipeLanguage) => void;
  setHousehold: (h: Household | null) => void;
  patchHousehold: (p: Partial<Household>) => void;
  /** Apply records that came down from the shared kitchen. */
  applyRemote: (records: { kind: string; id: string; data: unknown; deleted: boolean }[]) => void;
  /** Queue an in-app "sent you a recipe" for the partner. */
  sendRecipeToPartner: (recipeId: string) => boolean;
  /** Ask the partner to pick up grocery items (in-app nudge). */
  requestPickup: (items: string[]) => boolean;
  passTonight: (recipeId: string) => void;
  lockTonight: (recipeId: string) => void;
  unlockTonight: () => void;
  okTonight: () => void;
  receiveTonight: (s: SentRecipe) => void;
  markCooked: (recipeId: string) => void;
  setGenieUsed: () => void;
  dismissChecklist: () => void;
}

/** Drop duplicate recipes (same id, same source link, or same title + steps), keeping the newest. */
export function dedupeRecipes(list: Recipe[]): Recipe[] {
  const seen = new Set<string>();
  const out: Recipe[] = [];
  for (const r of list) {
    const keys = [
      `id:${r.id}`,
      r.source?.url ? `url:${r.source.url}` : null,
      `t:${r.title.trim().toLowerCase()}|${r.steps.length}|${r.ingredients.length}`,
    ].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(r);
  }
  // also merge duplicate ingredient lines in recipes saved before the merge existed
  const merged = out.map((r) => {
    const ing = mergeIngredients(r.ingredients);
    return ing.length === r.ingredients.length ? r : { ...r, ingredients: ing };
  });
  return merged.length === list.length && merged.every((r, i) => r === list[i]) ? list : merged;
}

const seedState = () => ({
  ...createMockData(),
  vote: null as VoteSession | null,
});

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      appUserId: newAppUserId(),
      isPlus: false,
      hasImported: false,
      gentlePaywallShown: false,
      freeCookRecipeId: null,
      onboarded: false,
      signedIn: false,
      lastClipboard: null,
      household: null,
      diets: [],
      expiryNudges: true,
      recipeLanguage: 'en',
      tonight: null,
      cookLog: {},
      genieUsed: false,
      checklistDismissed: false,
      importDraft: null,
      scanDraft: [],
      ...seedState(),

      completeOnboarding: (name) =>
        set((s) => {
          const n = name?.trim();
          if (!n) return { onboarded: true };
          return {
            onboarded: true,
            members: s.members.map((m) =>
              m.isMe ? { ...m, name: n, initials: n[0]!.toUpperCase() } : m,
            ),
          };
        }),
      signIn: () => set({ signedIn: true }),
      signOut: () => set({ signedIn: false, onboarded: false }),
      setPlus: (on) => set({ isPlus: on }),
      markImported: () => set({ hasImported: true }),
      markGentlePaywallShown: () => set({ gentlePaywallShown: true }),
      setFreeCookRecipeId: (id) => set({ freeCookRecipeId: id }),
      invitePartner: (name) =>
        set((s) => {
          const n = name.trim();
          if (!n) return {};
          const existing = s.members.find((m) => !m.isMe);
          if (existing) {
            return {
              members: s.members.map((m) =>
                m.id === existing.id ? { ...m, name: n, initials: n[0]!.toUpperCase() } : m,
              ),
            };
          }
          return {
            members: [
              ...s.members,
              { id: uid('m'), name: n, initials: n[0]!.toUpperCase(), color: '#F5B83D', isMe: false },
            ],
          };
        }),
      renameMember: (id, name) =>
        set((s) => {
          const n = name.trim();
          if (!n) return {};
          return {
            members: s.members.map((m) =>
              m.id === id ? { ...m, name: n, initials: n[0]!.toUpperCase() } : m,
            ),
          };
        }),
      clearKitchen: () => set({ pantry: [], recipes: [], groceries: [], vote: null, importDraft: null, scanDraft: [] }),
      resetDemo: () => set({ pantry: [], recipes: [], groceries: [], vote: null, importDraft: null, scanDraft: [] }),
      setLastClipboard: (text) => set({ lastClipboard: text }),

      addPantryItem: (item) =>
        set((s) => ({ pantry: [{ ...item, id: uid('p'), addedAt: new Date().toISOString() }, ...s.pantry] })),
      addDetectedItems: (items) =>
        set((s) => {
          const now = new Date().toISOString();
          const added = items
            .filter((i) => i.name.trim())
            .map<PantryItem>((i) => ({
              id: uid('p'),
              name: i.name.trim(),
              emoji: i.emoji || guessEmoji(i.name),
              quantity: i.quantity,
              location: i.location,
              expiresAt: i.expiresInDays === null ? null : daysFromNow(i.expiresInDays),
              addedAt: now,
            }));
          return {
            pantry: [...added, ...s.pantry],
            groceries: checkOffBoughtGroceries(s.groceries, added.map((i) => i.name), now),
            scanDraft: [],
          };
        }),
      markUsed: (id) => {
        const item = get().pantry.find((p) => p.id === id);
        set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) }));
        return item;
      },
      restorePantryItem: (item) => set((s) => ({ pantry: [item, ...s.pantry] })),

      setImportDraft: (d) => set({ importDraft: d }),
      setScanDraft: (d) => set({ scanDraft: d }),
      saveRecipe: (d, imported) => {
        const hinted = String((d as { id?: string }).id ?? '').trim();
        const id = hinted || uid('r');
        const now = new Date().toISOString();
        const clean: Recipe = {
          ...d,
          id,
          title: d.title.trim() || 'Untitled recipe',
          ingredients: mergeIngredients(d.ingredients.filter((i) => i.name.trim())),
          steps: d.steps.filter((x) => x.trim()),
          saved: true,
          importedAt: imported ? now : null,
          createdAt: now,
        };
        // Same recipe saved twice (share inbox + link fallback, or re-sharing the
        // same post) replaces the old copy instead of piling up duplicates.
        const url = clean.source?.url ?? null;
        set((s) => ({
          recipes: [clean, ...s.recipes.filter((r) => r.id !== id && !(url && r.source?.url === url))],
          importDraft: null,
        }));
        return id;
      },
      toggleSaved: (id) =>
        set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, saved: !r.saved } : r)) })),
      deleteRecipe: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),
      updateRecipe: (id, patch) => set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch, id } : r)) })),
      setStepImage: (id, index, url) =>
        set((s) => {
          const target = String(id);
          return {
            recipes: s.recipes.map((r) => {
              if (String(r.id) !== target) return r;
              const imgs = r.steps.map((_, i) => r.stepImages?.[i] ?? null);
              if (index >= 0) {
                while (imgs.length <= index) imgs.push(null);
                imgs[index] = url;
              }
              return { ...r, stepImages: imgs };
            }),
          };
        }),

      addToGroceries: (ingredients, recipeId) => {
        let added = 0;
        set((s) => {
          const list = [...s.groceries];
          for (const ing of ingredients) {
            const idx = list.findIndex((g) => !g.checked && namesMatch(g.name, ing.name));
            if (idx >= 0) {
              // Merge duplicates across recipes
              const cur = list[idx];
              const sameUnit = cur.unit === ing.unit && cur.qty !== null && ing.qty !== null;
              list[idx] = {
                ...cur,
                qty: sameUnit ? (cur.qty ?? 0) + (ing.qty ?? 0) : cur.qty,
                recipeIds: recipeId && !cur.recipeIds.includes(recipeId) ? [...cur.recipeIds, recipeId] : cur.recipeIds,
              };
            } else {
              list.unshift({
                id: uid('g'),
                name: ing.name,
                qty: ing.qty,
                unit: ing.unit,
                aisle: guessAisle(ing.name),
                addedBy: get().members.find((m) => m.isMe)?.id ?? ME_ID,
                recipeIds: recipeId ? [recipeId] : [],
                checked: false,
                checkedAt: null,
              });
            }
            added++;
          }
          return { groceries: list };
        });
        return added;
      },
      addGrocery: (name) => {
        if (!name.trim()) return;
        get().addToGroceries([{ name: name.trim(), qty: null, unit: '' }], null);
      },
      toggleGrocery: (id) => {
        const item = get().groceries.find((g) => g.id === id);
        if (!item) return undefined;
        const nowChecked = !item.checked;
        set((s) => {
          const groceries = s.groceries.map((g) =>
            g.id === id ? { ...g, checked: nowChecked, checkedAt: nowChecked ? new Date().toISOString() : null } : g,
          );
          if (!nowChecked) return { groceries };
          // Checking an item puts it in the Pantry
          const shelf = defaultShelfLife(item.aisle);
          const pantryItem: PantryItem = {
            id: `p-from-${item.id}`,
            name: item.name,
            emoji: guessEmoji(item.name),
            quantity: [item.qty === null ? '' : formatQty(item.qty), item.unit].filter(Boolean).join(' ') || '1',
            location: aisleToLocation(item.aisle),
            expiresAt: shelf === null ? null : daysFromNow(shelf),
            addedAt: new Date().toISOString(),
          };
          return { groceries, pantry: [pantryItem, ...s.pantry.filter((p) => p.id !== pantryItem.id)] };
        });
        if (!nowChecked) set((s) => ({ pantry: s.pantry.filter((p) => p.id !== `p-from-${item.id}`) }));
        return { ...item, checked: nowChecked };
      },
      clearGotIt: () => set((s) => ({ groceries: s.groceries.filter((g) => !g.checked) })),

      sendVote: (optionIds) =>
        set({ vote: { optionIds, status: 'pending', pickedId: null, sentAt: new Date().toISOString() } }),
      pickVote: (recipeId) => set((s) => (s.vote ? { vote: { ...s.vote, status: 'picked', pickedId: recipeId } } : {})),
      clearVote: () => set({ vote: null }),

      setDiets: (d) => set({ diets: d }),
      setExpiryNudges: (on) => set({ expiryNudges: on }),
      setRecipeLanguage: (l) => set({ recipeLanguage: l }),
      setHousehold: (h) => set({ household: h }),
      patchHousehold: (p) => set((s) => (s.household ? { household: { ...s.household, ...p } } : {})),
      applyRemote: (records) =>
        set((s) => {
          let recipes = s.recipes;
          let pantry = s.pantry;
          let groceries = s.groceries;
          let vote = s.vote;
          const upsert = <T extends { id: string }>(list: T[], id: string, data: unknown, deleted: boolean): T[] => {
            const rest = list.filter((x) => x.id !== id);
            if (deleted || !data) return rest;
            const i = list.findIndex((x) => x.id === id);
            const next = { ...(data as T), id };
            if (i === -1) return [next, ...rest];
            const copy = list.slice();
            copy[i] = next;
            return copy;
          };
          for (const r of records) {
            if (r.kind === 'recipe') recipes = upsert(recipes, r.id, r.data, r.deleted);
            else if (r.kind === 'pantry') pantry = upsert(pantry, r.id, r.data, r.deleted);
            else if (r.kind === 'grocery') groceries = upsert(groceries, r.id, r.data, r.deleted);
            else if (r.kind === 'vote') vote = r.deleted ? null : ((r.data as VoteSession) ?? null);
          }
          return { recipes, pantry, groceries, vote };
        }),
      passTonight: (recipeId) =>
        set((s) => {
          const today = todayKey();
          const t = s.tonight?.date === today ? s.tonight : null;
          return { tonight: { date: today, recipeId: null, lockedBy: null, okBy: null, passes: [...(t?.passes ?? []), recipeId] } };
        }),
      lockTonight: (recipeId) => {
        const s = get();
        const today = todayKey();
        const me = s.members.find((m) => m.isMe);
        const t = s.tonight?.date === today ? s.tonight : null;
        set({ tonight: { date: today, recipeId, lockedBy: me?.name ?? 'You', okBy: null, passes: t?.passes ?? [] } });
        const h = get().household;
        const recipe = s.recipes.find((r) => r.id === recipeId);
        if (h && recipe) {
          const partner = h.members.find((m) => m.memberId !== h.memberId) ?? null;
          set({ household: { ...h, outbox: [...h.outbox, { id: uid('tn'), type: 'tonight', recipeId, title: recipe.title, from: me?.name ?? 'Your partner', fromMemberId: h.memberId, to: partner?.memberId ?? null, at: new Date().toISOString() }] } });
        }
      },
      unlockTonight: () => set((s) => (s.tonight ? { tonight: { ...s.tonight, recipeId: null, lockedBy: null, okBy: null } } : {})),
      okTonight: () => {
        const s = get();
        const t = s.tonight;
        const me = s.members.find((m) => m.isMe);
        if (!t?.recipeId) return;
        set({ tonight: { ...t, okBy: me?.name ?? 'You' } });
        const h = s.household;
        if (h) {
          const partner = h.members.find((m) => m.memberId !== h.memberId) ?? null;
          set({ household: { ...h, outbox: [...h.outbox, { id: uid('tok'), type: 'tonight-ok', recipeId: t.recipeId, title: '', from: me?.name ?? 'Your partner', fromMemberId: h.memberId, to: partner?.memberId ?? null, at: new Date().toISOString() }] } });
        }
      },
      receiveTonight: (m) =>
        set((s) => {
          const today = todayKey();
          const t = s.tonight?.date === today ? s.tonight : null;
          if (m.type === 'tonight') return { tonight: { date: today, recipeId: m.recipeId, lockedBy: m.from, okBy: null, passes: t?.passes ?? [] } };
          if (m.type === 'tonight-ok' && t?.recipeId === m.recipeId) return { tonight: { ...t, okBy: m.from } };
          return {};
        }),
      markCooked: (recipeId) =>
        set((s) => ({
          cookLog: { ...s.cookLog, [recipeId]: new Date().toISOString() },
          tonight: s.tonight?.recipeId === recipeId ? { ...s.tonight, recipeId: null, lockedBy: null, okBy: null, passes: [...s.tonight.passes, recipeId] } : s.tonight,
        })),
      setGenieUsed: () => set({ genieUsed: true }),
      dismissChecklist: () => set({ checklistDismissed: true }),
      requestPickup: (items) => {
        const s = get();
        const h = s.household;
        if (!h || !items.length) return false;
        const partner = h.members.find((m) => m.memberId !== h.memberId) ?? null;
        const me = s.members.find((m) => m.isMe);
        set({
          household: {
            ...h,
            outbox: [
              ...h.outbox,
              {
                id: uid('pick'),
                type: 'pickup',
                items: items.slice(0, 40),
                recipeId: '',
                title: `${items.length} item${items.length === 1 ? '' : 's'}`,
                from: me?.name ?? 'Your partner',
                fromMemberId: h.memberId,
                to: partner?.memberId ?? null,
                at: new Date().toISOString(),
              },
            ],
          },
        });
        return true;
      },
      sendRecipeToPartner: (recipeId) => {
        const s = get();
        const h = s.household;
        const recipe = s.recipes.find((r) => r.id === recipeId);
        if (!h || !recipe) return false;
        const partner = h.members.find((m) => m.memberId !== h.memberId) ?? null;
        const me = s.members.find((m) => m.isMe);
        set({
          household: {
            ...h,
            outbox: [
              ...h.outbox,
              {
                id: uid('sent'),
                recipeId,
                title: recipe.title,
                from: me?.name ?? 'Your partner',
                fromMemberId: h.memberId,
                to: partner?.memberId ?? null,
                at: new Date().toISOString(),
              },
            ],
          },
        });
        return true;
      },
    }),
    {
      name: 'honey-dinner-v1',
      version: MOCK_DATA_VERSION,
      // v2: drop shipped demo recipes / pantry / groceries, keep the household.
      // v3: if the kitchen has no recipes left, add a short starter cookbook.
      migrate: (persisted) => {
        const prev = (persisted ?? {}) as Partial<AppState>;
        const seedIds = new Set<string>(SEED_RECIPE_IDS);
        let recipes = (prev.recipes ?? []).filter((r) => !seedIds.has(r.id));
        if (recipes.length === 0) recipes = starterRecipes();
        return {
          ...prev,
          recipes,
          pantry: (prev.pantry ?? []).filter((i) => !/^p-\d+$/.test(i.id)),
          groceries: (prev.groceries ?? []).filter((g) => !/^g-\d+$/.test(g.id)),
          members: prev.members?.length ? prev.members : seedState().members,
        };
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        appUserId: s.appUserId,
        isPlus: s.isPlus,
        hasImported: s.hasImported,
        gentlePaywallShown: s.gentlePaywallShown,
        freeCookRecipeId: s.freeCookRecipeId,
        onboarded: s.onboarded,
        signedIn: s.signedIn,
        members: s.members,
        pantry: s.pantry,
        recipes: s.recipes,
        groceries: s.groceries,
        vote: s.vote,
        lastClipboard: s.lastClipboard,
        household: s.household,
        diets: s.diets,
        expiryNudges: s.expiryNudges,
        recipeLanguage: s.recipeLanguage,
        tonight: s.tonight,
        cookLog: s.cookLog,
        genieUsed: s.genieUsed,
        checklistDismissed: s.checklistDismissed,
      }),
      onRehydrateStorage: () => () => {
        useApp.setState((s) => ({
          hydrated: true,
          recipes: dedupeRecipes(s.recipes),
          appUserId: s.appUserId || newAppUserId(),
        }));
      },
    },
  ),
);

/* ---------- Toasts (ephemeral) ---------- */

interface ToastState {
  message: string | null;
  key: number;
  show: (message: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>()((set) => ({
  message: null,
  key: 0,
  show: (message) => set((s) => ({ message, key: s.key + 1 })),
  hide: () => set({ message: null }),
}));

export const toast = (message: string) => useToast.getState().show(message);
