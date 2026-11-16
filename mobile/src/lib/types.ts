export type SourcePlatform = 'tiktok' | 'instagram' | 'facebook' | 'snapchat' | 'web' | 'photo' | 'genie';

/** Eating styles FridgeGenie cooks for. */
export type Diet =
  | 'carnivore' | 'keto' | 'atkins' | 'paleo' | 'mediterranean' | 'low-fat' | 'low-carb' | 'high-protein' | 'whole30'
  | 'vegan' | 'plant-based' | 'vegetarian' | 'pescatarian'
  | 'gluten-free' | 'dairy-free' | 'nut-free' | 'low-sugar' | 'low-sodium' | 'halal' | 'kosher';
export type StorageLocation = 'fridge' | 'freezer' | 'pantry';
export type Aisle = 'Produce' | 'Dairy' | 'Meat & Fish' | 'Pantry' | 'Frozen' | 'Other';

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  isMe: boolean;
}

export interface PantryItem {
  id: string;
  name: string;
  emoji: string;
  quantity: string;
  location: StorageLocation;
  /** ISO date, or null when it doesn't really expire */
  expiresAt: string | null;
  addedAt: string;
}

export interface Ingredient {
  name: string;
  qty: number | null;
  unit: string;
}

export interface RecipeSource {
  platform: SourcePlatform;
  /** Link to the original post. We only ever store the link, never the creator's video. */
  url: string | null;
  creator: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  image: string;
  servings: number;
  cookTime: number;
  ingredients: Ingredient[];
  steps: string[];
  source: RecipeSource;
  /** Set by the importer when it had to fill gaps the post didn't state (e.g. amounts). */
  note?: string;
  /** Illustrations for each step, filled in lazily by cooking mode. */
  stepImages?: (string | null)[];
  saved: boolean;
  importedAt: string | null;
  createdAt: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  qty: number | null;
  unit: string;
  aisle: Aisle;
  addedBy: string;
  recipeIds: string[];
  checked: boolean;
  checkedAt: string | null;
}

export interface VoteSession {
  optionIds: string[];
  status: 'pending' | 'picked';
  pickedId: string | null;
  sentAt: string;
}

/** A recipe draft that hasn't been saved yet (from import or "type it in"). */
export type RecipeDraft = Omit<Recipe, 'id' | 'saved' | 'importedAt' | 'createdAt'>;

export interface DetectedItem {
  id: string;
  name: string;
  emoji: string;
  quantity: string;
  location: StorageLocation;
  expiresInDays: number | null;
}

/** Shared kitchen (you + partner), synced through the `household` server function. */
export interface HouseholdMember {
  memberId: string;
  name: string;
}
export interface SentRecipe {
  id: string;
  recipeId: string;
  title: string;
  from: string;
  fromMemberId: string;
  to: string | null;
  at: string;
}
export interface Household {
  code: string;
  token: string;
  /** This phone's member id inside the household. */
  memberId: string;
  members: HouseholdMember[];
  /** Server cursor: last change we've seen. */
  since: number;
  /** Last-synced JSON of every shared record, keyed "kind:id" — used to find local edits. */
  shadow: Record<string, string>;
  /** Recipes sent to the partner, waiting to go up with the next sync. */
  outbox: SentRecipe[];
}
