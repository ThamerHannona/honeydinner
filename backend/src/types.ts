// Keep this aligned with the mobile app's SourcePlatform union.
export type SourcePlatform = "tiktok" | "instagram" | "facebook" | "snapchat" | "web";

export interface Ingredient {
  name: string;
  qty: number | null;
  unit: string;
}

export interface RecipeSource {
  platform: SourcePlatform;
  url: string;
  creator: string | null;
}

export interface RecipeDraft {
  title: string;
  /** Image URL to show in the preview. */
  image: string;
  /** Best-effort; defaults are used when unknown. */
  servings: number;
  /** Minutes; defaults are used when unknown. */
  cookTime: number;
  ingredients: Ingredient[];
  steps: string[];
  source: RecipeSource;
}

export interface ImportRecipeRequest {
  url: string;
}

export interface ImportRecipeResponse {
  recipe: RecipeDraft;
}

