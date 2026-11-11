import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { aisleToLocation, daysFromNow, defaultShelfLife, formatQty, guessAisle, guessEmoji, namesMatch } from './kitchen';
import { createMockData, ME_ID, MOCK_DATA_VERSION } from './mock-data';
import type {
  DetectedItem,
  GroceryItem,
  Ingredient,
  Member,
  PantryItem,
  Recipe,
  RecipeDraft,
  VoteSession,
} from './types';

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  signedIn: boolean;
  members: Member[];
  pantry: PantryItem[];
  recipes: Recipe[];
  groceries: GroceryItem[];
  vote: VoteSession | null;
  lastClipboard: string | null;

  // ephemeral drafts (not persisted)
  importDraft: RecipeDraft | null;
  scanDraft: DetectedItem[];

  completeOnboarding: () => void;
  signIn: () => void;
  signOut: () => void;
  invitePartner: (name: string) => void;
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

  addToGroceries: (ingredients: Ingredient[], recipeId: string | null) => number;
  addGrocery: (name: string) => void;
  toggleGrocery: (id: string) => GroceryItem | undefined;
  clearGotIt: () => void;

  sendVote: (optionIds: string[]) => void;
  pickVote: (recipeId: string) => void;
  clearVote: () => void;
}

const seedState = () => ({
  ...createMockData(),
  vote: null as VoteSession | null,
});

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboarded: false,
      signedIn: false,
      lastClipboard: null,
      importDraft: null,
      scanDraft: [],
      ...seedState(),

      completeOnboarding: () => set({ onboarded: true }),
      signIn: () => set({ signedIn: true }),
      signOut: () => set({ signedIn: false, onboarded: false }),
      invitePartner: (name) =>
        set((s) => ({
          members: s.members.map((m) =>
            m.isMe ? m : { ...m, name: name.trim() || m.name, initials: (name.trim()[0] ?? m.initials).toUpperCase() },
          ),
        })),
      resetDemo: () => set({ ...seedState(), importDraft: null, scanDraft: [] }),
      setLastClipboard: (text) => set({ lastClipboard: text }),

      addPantryItem: (item) =>
        set((s) => ({ pantry: [{ ...item, id: uid('p'), addedAt: new Date().toISOString() }, ...s.pantry] })),
      addDetectedItems: (items) =>
        set((s) => ({
          pantry: [
            ...items
              .filter((i) => i.name.trim())
              .map<PantryItem>((i) => ({
                id: uid('p'),
                name: i.name.trim(),
                emoji: i.emoji || guessEmoji(i.name),
                quantity: i.quantity,
                location: i.location,
                expiresAt: i.expiresInDays === null ? null : daysFromNow(i.expiresInDays),
                addedAt: new Date().toISOString(),
              })),
            ...s.pantry,
          ],
        })),
      markUsed: (id) => {
        const item = get().pantry.find((p) => p.id === id);
        set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) }));
        return item;
      },
      restorePantryItem: (item) => set((s) => ({ pantry: [item, ...s.pantry] })),

      setImportDraft: (d) => set({ importDraft: d }),
      setScanDraft: (d) => set({ scanDraft: d }),
      saveRecipe: (d, imported) => {
        const id = uid('r');
        const now = new Date().toISOString();
        const clean: Recipe = {
          ...d,
          id,
          title: d.title.trim() || 'Untitled recipe',
          ingredients: d.ingredients.filter((i) => i.name.trim()),
          steps: d.steps.filter((x) => x.trim()),
          saved: true,
          importedAt: imported ? now : null,
          createdAt: now,
        };
        set((s) => ({ recipes: [clean, ...s.recipes], importDraft: null }));
        return id;
      },
      toggleSaved: (id) =>
        set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, saved: !r.saved } : r)) })),
      deleteRecipe: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),

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
                addedBy: ME_ID,
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
    }),
    {
      name: 'honey-dinner-v1',
      version: MOCK_DATA_VERSION,
      // Refresh the original demo seed once, preserving onboarding and other settings.
      migrate: (persisted) => ({ ...(persisted as Partial<AppState>), ...seedState() }),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        signedIn: s.signedIn,
        members: s.members,
        pantry: s.pantry,
        recipes: s.recipes,
        groceries: s.groceries,
        vote: s.vote,
        lastClipboard: s.lastClipboard,
      }),
      onRehydrateStorage: () => () => {
        useApp.setState({ hydrated: true });
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
