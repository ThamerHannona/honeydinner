# Honey, Dinner?

A household dinner app for couples and families. It answers "what should we make tonight?" using what's already in your kitchen, and saves recipes from TikTok, Instagram, Facebook and Snapchat. FridgeGenie, the in-app assistant, talks in short, warm one-liners.

**v1 runs entirely on mock data with simulated AI and scanning.** All data lives on the device (Zustand + AsyncStorage).

## Recipe import (real extraction)
The mobile app’s import flow calls a **Supabase Edge Function** to extract the *actual* recipe from a shared/pasted link (TikTok prioritized). It uses the TikTok caption and (best-effort) audio transcription, then structures the recipe with an LLM **without inventing**.

- **Mobile (EAS env vars, required)**:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Supabase Edge Function secrets (required)**:
  - `OPENAI_API_KEY`
- **Supabase Edge Function secrets (optional)**:
  - `OPENAI_MODEL` (default `gpt-4o-mini`)
  - `OPENAI_TRANSCRIBE_MODEL` (default `gpt-4o-mini-transcribe`)
  - `MAX_TIKTOK_MEDIA_BYTES` (default `20000000`)

## Brand
- Editorial kitchen / sticker-pop light theme: cream `#F4EDE0`, ink `#14110D`, green `#1DAF3A`, forest `#14702A`, honey `#F4AA22`, alert `#FF5A3C`.
- Fonts: Fraunces 600 + real italic for headlines, Barlow Condensed 700/800 for uppercase labels and logo, Inter 400/500/600/700 for body and buttons.
- All palette, font, type, spacing, shape, signature and motion tokens live in `mobile/src/lib/theme.ts`; Tailwind loads that same file rather than duplicating values.
- Part 1 applies shared styles only. Existing data, navigation, three onboarding slides, filters, servings, voting, groceries and simulated import/scan flows are retained. Per-screen redesigns, new capabilities and dark mode remain separate later work.
- Shared primitives in `components/ui.tsx`: `Highlight` (rotated background only), `GenieBubble`, `HardShadow` (absolute duplicate shape, no blur), `MatchStamp`, `Plate`, `StatusDot`. Branding exposes `LogoBubble` and `PlatformPill`.
- Tap scaling uses the 0.97 spring and respects Reduce Motion; existing entrance animations are suppressed for reduced-motion users. Native haptics use light taps and medium confirmation impacts. Shared decorative motion includes a 3.2s mascot bob, green import pulse rings and a scan sweep during sample preparation; each respects Reduce Motion and cancels on unmount. These effects do not imply real AI recognition.
- Logo: "Honey, Dinner?" inside a speech bubble (`components/brand.tsx` → `Logo`)

## Screens (mobile/src/app)
| Route | What it is |
| --- | --- |
| `onboarding` → `(tabs)/index` | Unchanged 3-slide intro design; Get started or Skip saves completion and opens Tonight directly. Returning users go straight to the main app. |
| `(tabs)/index` | **Tonight**: FridgeGenie greeting based on soon-expiring items, 3 large photo-led recipe cards in a snapping horizontal carousel, live ingredient-match badges, and a horizontal “Use it up soon” chip row |
| `(tabs)/pantry` | **Pantry**: Fridge/Freezer/Pantry segmented control, search within the selected location, quantity rows with green/amber/red expiry tags, swipe left to mark Used up, Undo, and Add item form |
| `(tabs)/recipes` | **Recipes**: all 14 seed recipes with photos, cook times, servings, creator handles, and platform labels; tap to see ingredients and steps |
| `(tabs)/groceries` | **Groceries**: 10 seed items grouped by aisle with quantities, added-by member, linked recipe names, and check-off controls |
| `sign-in`, `invite` | Existing mock sign-in and invitation routes, not required for onboarding completion |
| `add-sheet` | The floating + sheet: Import Recipe / Scan Receipt / Scan Fridge |
| `import` → `import-loading` → `import-review` / `import-failed` | The social import flow |
| `scan` → `scan-review` | Camera, 2-second scan animation, then an editable list of detected items |
| `recipe/[id]` | Recipe detail: large photo, title, quantified ingredients, numbered steps, pantry checkmarks, servings scaler, and add missing items to Groceries |
| `cook/[id]` | Cooking mode: one step per screen, auto-detected timers, screen stays awake |
| `ask-honey`, `partner-vote` | Send 3 options; the partner's heart-voting view (demo) |
| `profile` | Household members, notification toggles, reset demo data, sign out |

The four tabs retain Tonight / Recipes / Kitchen / List navigation. Their shared cream tab bar has an ink top rule and a centered honey `+` with an ink hard-offset shadow opening the existing add sheet. Header profile/household controls still link to Profile. Every tab reads from the same Zustand store seeded by `src/lib/mock-data.ts`; recipe detail and Profile use that same data. The clipboard banner is not displayed in this main-app shell.

## Tonight behavior
- FridgeGenie uses a time-of-day greeting and the two soonest-expiring usable ingredients (e.g. “Evening! Your chicken and spinach need using.”). Empty, one-item, and expired-only pantries have honest fallback greetings.
- Suggestions favor recipes with more ingredients available and ingredients needing use soon. Up to three recipes are shown; an empty pantry still shows recipe ideas with `0/N` matches.
- Badges read `You have N/M ingredients`. Matches use normalized ingredient names and exclude expired pantry items; salt/pepper/water staples are treated as basics and excluded from the badge denominator. Matching checks ingredient presence, not whether the pantry quantity is sufficient.
- The horizontal expiry chips include items due today through 3 days from now, ordered by expiry; expired items are excluded.
- Tapping any recipe opens the existing shared Recipe Detail route. Other tabs and onboarding are unchanged.

## Pantry behavior
- Fridge/Freezer/Pantry segments show live counts. Search is case-insensitive and filters the selected location; switching locations keeps the search text. Results are ordered by expiry, with no-expiry items last.
- Tags are green for fresh, amber for due today through 3 days, and red for expired. No-expiry items use a neutral tag.
- A completed left swipe immediately marks an item Used up and removes it from shared state; an Undo banner restores the last removed item. A screen-reader activation action also marks it used up.
- Add item opens `pantry-add` with the current location preselected. The form requires name and quantity, accepts an exact local-calendar expiry date (`YYYY-MM-DD`), rejects impossible dates, and offers 3-day/1-week/1-month/no-expiry shortcuts.
- Adds/removals persist on-device and immediately update Tonight’s greeting, ingredient matches, and expiry chips. The form uses KeyboardAwareScrollView and dismisses the keyboard on save/drag. Native keyboard avoidance has not been verified in the web preview.

## Shared mock data
- `createMockData()` creates 25 pantry items, 14 recipes, 10 groceries, and 2 members (Alex / you and Lena).
- Every seed pantry item has an expiry date relative to the seed day: 17 fresh, 6 expiring in 1–3 days, and 2 expired. Locations: 15 Fridge, 4 Freezer, 6 Pantry.
- Recipes cover TikTok, Instagram, Facebook, Snapchat, Web, and Photo, with photos, cooking time, servings, quantified ingredients, steps, creator handles, and illustrative original links. Links/handles are mock references, not verified real posts; Photo points to an illustrative recipe-card link, not an uploaded asset.
- Every seed grocery references a valid household member and at least one recipe ID (tortillas serve two recipes).
- `MOCK_DATA_VERSION` refreshes the original persisted demo seed once when upgrading this data version, preserving onboarding/settings. Subsequent edits persist as before. Profile → Reset demo data creates a fresh dated seed.

## Code map
- `src/components/KitchenData.tsx`: shared data-screen layout, section headings, and recipe preview cards
- `src/components/TabPlaceholder.tsx`: retained placeholder component (not used by the populated tabs)
- `src/lib/services/kitchen-ai.ts`: **the one service file for all import/scan logic.** It has mock versions of `detectPlatform`, `fetchPostMetadata`, `extractFromCaption`, `transcribeVideoAudio`, `readOnScreenText`, `extractFromImage`, `structureRecipe`, `scanReceipt` and `scanFridge`, plus the `importRecipe` pipeline. Swap the mocks for real backend calls without touching the screens. Only the link, creator handle, thumbnail and structured recipe are stored, never the video.
- `src/lib/store.ts`: app state (pantry, recipes, groceries, members, vote) plus toasts
- `src/lib/kitchen.ts`: ingredient matching, expiry, aisles, emoji, quantity formatting, timer detection
- `src/lib/pantry.ts`: shared location options, location/search filtering, local date input formatting and strict expiry-date parsing
- `src/lib/mock-data.ts`: seed data (25 pantry items, 14 recipes, 10 groceries, Alex & Lena)
- `src/lib/genie.ts`: FridgeGenie copy
- `src/components/`: `ui.tsx` (Txt, Button, Chip, Avatar, PressableScale, AView), `brand.tsx` (Logo, GenieAvatar, platform icons, illustrations, EmptyState), `app.tsx` (headers, FAB, toast, recipe card), `ClipboardBanner.tsx`

## Demo tips
- Paste a link containing `fail` (e.g. `https://instagram.com/reel/fail`) to see the "Couldn't find the recipe" screen.
- Copy a TikTok/Instagram/Facebook/Snapchat link before opening the app to see the clipboard banner.
- Profile → Reset demo data restores the seed kitchen.

## Notes
- `Animated.View` ignores NativeWind classes. Use `AView` (in `ui.tsx`) when you need entering/exiting animations together with `className`.

## Running outside Vibecode
- The app lives in `mobile/`. Install with `bun install`, run with `bunx expo start`.
- App identity: **Honey, Dinner?** · bundle id `com.shakeandbakelabs.honeydinner` · icon in `mobile/assets/icon.png`.
- iOS builds go through Expo EAS (`mobile/eas.json`): `eas build -p ios --profile production`, then `eas submit -p ios`.
- `backend/` is Vibecode's starter server (only a sample route). The app does not call it in v1.
- **Never commit `.env` files.** `backend/.env` contains API keys; the root `.gitignore` excludes every `.env*` file.
- Import/scan AI is still mocked in `mobile/src/lib/services/kitchen-ai.ts`. Making it real needs your own AI key on a server you control (e.g. a Supabase Edge Function), never inside the app.

## Supabase Edge Function deploy (importer)
- **Link project**: `supabase link --project-ref <your-project-ref>`
- **Set required secrets**:
  - `supabase secrets set OPENAI_API_KEY=...`
  - Optional: `supabase secrets set OPENAI_MODEL=gpt-4o-mini OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe MAX_TIKTOK_MEDIA_BYTES=20000000`
- **Deploy**: `supabase functions deploy import-recipe`

Test (after deploy) from your machine:
- `SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/test-import-edge.mjs`
