import { daysFromNow } from './kitchen';
import type { GroceryItem, Member, PantryItem, Recipe } from './types';

/** Single source of mock kitchen data. Dates are relative to the day of seeding.
 * Social links and creator handles are illustrative, not verified source posts.
 */
export const MOCK_DATA_VERSION = 3;
export const ME_ID = 'm-me';
export const PARTNER_ID = 'm-partner';

/** Known seed recipe ids from earlier builds, stripped on migrate. */
export const SEED_RECIPE_IDS = [
  'r-garlic-chicken', 'r-tuscan-pasta', 'r-shrimp-rice', 'r-honey-salmon',
  'r-frittata', 'r-fajitas', 'r-chickpea-curry', 'r-beef-broccoli',
  'r-shakshuka', 'r-lemon-orzo', 'r-peanut-noodles', 'r-smash-tacos',
  'r-chicken-soup', 'r-meatballs',
] as const;

/** A short starter cookbook for a fresh kitchen — not a demo household. */
export const STARTER_RECIPE_IDS = [
  'r-garlic-chicken',
  'r-tuscan-pasta',
  'r-honey-salmon',
  'r-chickpea-curry',
  'r-smash-tacos',
  'r-chicken-soup',
] as const;

export const seedMembers: Member[] = [
  { id: ME_ID, name: 'You', initials: 'Y', color: '#2E9E5B', isMe: true },
];

const dish = (hash: string) => `https://rzacuyrcbujcnkpoktyg.supabase.co/storage/v1/object/public/step-images/${hash}.jpg`;

let pid = 0;
const p = (
  name: string,
  emoji: string,
  quantity: string,
  location: PantryItem['location'],
  days: number | null,
): PantryItem => ({
  id: `p-${++pid}`,
  name,
  emoji,
  quantity,
  location,
  expiresAt: days === null ? null : daysFromNow(days),
  addedAt: daysFromNow(-3),
});

export const seedPantry = (): PantryItem[] => {
  pid = 0;
  return [
    // Fridge
    p('Chicken thighs', '🍗', '600 g', 'fridge', 1),
    p('Baby spinach', '🥬', '1 bag', 'fridge', 1),
    p('Eggs', '🥚', '9', 'fridge', 12),
    p('Whole milk', '🥛', '1 L', 'fridge', 3),
    p('Greek yogurt', '🥣', '1 tub', 'fridge', -1),
    p('Cheddar', '🧀', '200 g', 'fridge', 16),
    p('Parmesan', '🧀', '1 wedge', 'fridge', 30),
    p('Butter', '🧈', '1 block', 'fridge', 24),
    p('Lemons', '🍋', '3', 'fridge', 7),
    p('Bell peppers', '🫑', '2', 'fridge', 2),
    p('Cherry tomatoes', '🍅', '1 punnet', 'fridge', 4),
    p('Heavy cream', '🥛', '300 ml', 'fridge', 2),
    p('Ginger', '🫚', '1 knob', 'fridge', 14),
    p('Scallions', '🌱', '1 bunch', 'fridge', 3),
    p('Cilantro', '🌿', '1 bunch', 'fridge', -2),
    // Freezer
    p('Shrimp', '🦐', '400 g', 'freezer', 60),
    p('Frozen peas', '🫛', '1 bag', 'freezer', 120),
    p('Salmon fillets', '🐟', '2', 'freezer', 45),
    p('Ground beef', '🥩', '500 g', 'freezer', 30),
    // Pantry
    p('Garlic', '🧄', '1 bulb', 'pantry', 20),
    p('Yellow onions', '🧅', '4', 'pantry', 25),
    p('Olive oil', '🫒', '1 bottle', 'pantry', 180),
    p('Soy sauce', '🥢', '1 bottle', 'pantry', 240),
    p('Jasmine rice', '🍚', '2 kg', 'pantry', 365),
    p('Spaghetti', '🍝', '2 packs', 'pantry', 300),
  ];
};

const i = (name: string, qty: number | null, unit = '') => ({ name, qty, unit });

export const seedRecipes = (): Recipe[] => [
  {
    id: 'r-garlic-chicken',
    title: 'Garlic Butter Chicken',
    image: dish('62e53590aeb30bc7975fdf3c4f1c60f7af98605e'),
    servings: 2,
    cookTime: 25,
    ingredients: [
      i('Chicken thighs', 500, 'g'),
      i('Garlic', 6, 'cloves'),
      i('Butter', 3, 'tbsp'),
      i('Baby spinach', 2, 'cups'),
      i('Lemon', 1, ''),
      i('Parmesan', 0.25, 'cup'),
      i('Olive oil', 1, 'tbsp'),
      i('Salt', null, 'to taste'),
    ],
    steps: [
      'Pat the chicken thighs dry and season generously with salt and pepper.',
      'Heat olive oil in a large skillet and sear the chicken skin-side down for 6 minutes until golden.',
      'Flip, add butter and smashed garlic, and baste the chicken for 4 minutes.',
      'Toss in the spinach and let it wilt for 2 minutes in all that garlic butter.',
      'Finish with a squeeze of lemon and a shower of parmesan. Serve straight from the pan.',
    ],
    source: { platform: 'tiktok', url: 'https://www.tiktok.com/@dinnerwithdani/video/7301234567890', creator: '@dinnerwithdani' },
    saved: true,
    importedAt: daysFromNow(-1),
    createdAt: daysFromNow(-1),
  },
  {
    id: 'r-tuscan-pasta',
    title: 'Creamy Tuscan Spinach Pasta',
    image: dish('ef61fa092e745eab333b66c3b2782a1dce36ae5a'),
    servings: 4,
    cookTime: 20,
    ingredients: [
      i('Spaghetti', 350, 'g'),
      i('Baby spinach', 3, 'cups'),
      i('Heavy cream', 1, 'cup'),
      i('Garlic', 4, 'cloves'),
      i('Parmesan', 0.5, 'cup'),
      i('Cherry tomatoes', 1, 'cup'),
      i('Sun-dried tomatoes', 0.33, 'cup'),
    ],
    steps: [
      'Boil the spaghetti in well-salted water for 9 minutes, then reserve a cup of pasta water.',
      'Sauté garlic and sun-dried tomatoes in a splash of oil for 1 minute.',
      'Add cherry tomatoes and cook for 3 minutes until they start to burst.',
      'Pour in the cream, stir in parmesan, then fold in the spinach.',
      'Toss the pasta through the sauce, loosening with pasta water as needed.',
    ],
    source: { platform: 'instagram', url: 'https://www.instagram.com/reel/C1tuscanpasta/', creator: '@pastaqueen.nyc' },
    saved: false,
    importedAt: daysFromNow(-2),
    createdAt: daysFromNow(-2),
  },
  {
    id: 'r-shrimp-rice',
    title: '15-Minute Shrimp Fried Rice',
    image: dish('5ad88e7517ebebab1f1198126dc8e1a699ca6a42'),
    servings: 3,
    cookTime: 15,
    ingredients: [
      i('Jasmine rice', 3, 'cups cooked'),
      i('Shrimp', 300, 'g'),
      i('Eggs', 2, ''),
      i('Frozen peas', 0.75, 'cup'),
      i('Scallions', 3, ''),
      i('Soy sauce', 3, 'tbsp'),
      i('Garlic', 3, 'cloves'),
      i('Sesame oil', 1, 'tsp'),
    ],
    steps: [
      'Get your wok smoking hot. Cook the shrimp for 2 minutes, then set aside.',
      'Scramble the eggs in the same pan and push them to the side.',
      'Add garlic and peas, then the cold rice. Press it flat and let it crisp for 3 minutes.',
      'Splash in soy sauce and sesame oil, return the shrimp, and toss with scallions.',
    ],
    source: { platform: 'tiktok', url: 'https://www.tiktok.com/@wokwithkai/video/7309876543210', creator: '@wokwithkai' },
    saved: true,
    importedAt: daysFromNow(-4),
    createdAt: daysFromNow(-4),
  },
  {
    id: 'r-honey-salmon',
    title: 'Sticky Honey Garlic Salmon',
    image: dish('653e9da262b92734b08c228a68513709d271bd93'),
    servings: 2,
    cookTime: 20,
    ingredients: [
      i('Salmon fillets', 2, ''),
      i('Honey', 3, 'tbsp'),
      i('Soy sauce', 2, 'tbsp'),
      i('Garlic', 3, 'cloves'),
      i('Ginger', 1, 'tsp grated'),
      i('Jasmine rice', 1, 'cup'),
      i('Scallions', 2, ''),
    ],
    steps: [
      'Whisk honey, soy, garlic and ginger together.',
      'Sear the salmon flesh-side down for 4 minutes until caramelised.',
      'Flip, pour in the glaze and let it bubble for 3 minutes, spooning it over.',
      'Serve over rice with sliced scallions.',
    ],
    source: { platform: 'instagram', url: 'https://www.instagram.com/p/C2honeysalmon/', creator: '@hungry.harper' },
    saved: false,
    importedAt: daysFromNow(-6),
    createdAt: daysFromNow(-6),
  },
  {
    id: 'r-frittata',
    title: 'Spinach & Cheddar Frittata',
    image: dish('a26c75a2292bd2d34fadd14c1cd412331a0b5fbc'),
    servings: 4,
    cookTime: 25,
    ingredients: [
      i('Eggs', 8, ''),
      i('Baby spinach', 2, 'cups'),
      i('Cheddar', 1, 'cup grated'),
      i('Whole milk', 0.25, 'cup'),
      i('Yellow onion', 1, ''),
      i('Butter', 1, 'tbsp'),
    ],
    steps: [
      'Heat the oven to 200°C. Soften the onion in butter for 5 minutes.',
      'Add spinach and stir until just wilted.',
      'Whisk eggs, milk and cheddar, pour over and cook on the stove for 3 minutes.',
      'Bake for 12 minutes until puffed and set in the middle.',
    ],
    source: { platform: 'instagram', url: 'https://www.instagram.com/reel/C3frittata/', creator: '@eggsactly.emma' },
    saved: false,
    importedAt: null,
    createdAt: daysFromNow(-14),
  },
  {
    id: 'r-fajitas',
    title: 'Sheet Pan Chicken Fajitas',
    image: dish('5bf933d1ec0613a40132de4eb64836aec8be85f9'),
    servings: 4,
    cookTime: 30,
    ingredients: [
      i('Chicken thighs', 500, 'g'),
      i('Bell peppers', 3, ''),
      i('Yellow onion', 1, ''),
      i('Flour tortillas', 8, ''),
      i('Olive oil', 2, 'tbsp'),
      i('Lime', 1, ''),
      i('Fajita seasoning', 2, 'tbsp'),
    ],
    steps: [
      'Heat the oven to 220°C. Slice chicken, peppers and onion into strips.',
      'Toss everything with oil and seasoning on a sheet pan.',
      'Roast for 20 minutes, tossing halfway.',
      'Squeeze over lime and pile into warm tortillas.',
    ],
    source: { platform: 'facebook', url: 'https://www.facebook.com/watch/?v=1029384756', creator: '@thebusyfamilytable' },
    saved: true,
    importedAt: null,
    createdAt: daysFromNow(-20),
  },
  {
    id: 'r-chickpea-curry',
    title: 'Chickpea Coconut Curry',
    image: dish('97e4d5cfeeef7d8a008ff1781cd1ccd6b7fffa16'),
    servings: 4,
    cookTime: 35,
    ingredients: [
      i('Chickpeas', 2, 'cans'),
      i('Coconut milk', 1, 'can'),
      i('Yellow onion', 1, ''),
      i('Garlic', 3, 'cloves'),
      i('Ginger', 1, 'tbsp'),
      i('Baby spinach', 2, 'cups'),
      i('Curry powder', 2, 'tbsp'),
      i('Jasmine rice', 1.5, 'cups'),
    ],
    steps: [
      'Cook the onion for 6 minutes until soft and sweet.',
      'Add garlic, ginger and curry powder and stir for 1 minute.',
      'Pour in coconut milk and chickpeas and simmer for 15 minutes.',
      'Stir through the spinach and serve with rice.',
    ],
    source: { platform: 'facebook', url: 'https://www.facebook.com/reel/88412093', creator: '@mamarosaskitchen' },
    saved: false,
    importedAt: null,
    createdAt: daysFromNow(-25),
  },
  {
    id: 'r-beef-broccoli',
    title: 'Weeknight Beef & Broccoli',
    image: dish('67e086e11062921827ec0fac637763f912e42e36'),
    servings: 3,
    cookTime: 25,
    ingredients: [
      i('Flank steak', 400, 'g'),
      i('Broccoli', 1, 'head'),
      i('Soy sauce', 4, 'tbsp'),
      i('Garlic', 3, 'cloves'),
      i('Ginger', 1, 'tsp'),
      i('Jasmine rice', 1, 'cup'),
    ],
    steps: [
      'Slice the steak thinly against the grain.',
      'Sear in batches for 2 minutes per side, then set aside.',
      'Stir-fry broccoli for 4 minutes with a splash of water.',
      'Add garlic, ginger and soy, return the beef and toss until glossy.',
    ],
    source: { platform: 'facebook', url: 'https://www.facebook.com/share/v/weeknightwins', creator: '@weeknight.wins' },
    saved: false,
    importedAt: null,
    createdAt: daysFromNow(-30),
  },
  {
    id: 'r-shakshuka',
    title: 'Pepper Shakshuka',
    image: dish('99d4230ed78bcd12f8c67fd225937fdf2009d09c'),
    servings: 2,
    cookTime: 30,
    ingredients: [
      i('Eggs', 4, ''),
      i('Crushed tomatoes', 1, 'can'),
      i('Bell peppers', 2, ''),
      i('Yellow onion', 1, ''),
      i('Garlic', 2, 'cloves'),
      i('Cumin', 1, 'tsp'),
      i('Feta', 50, 'g'),
    ],
    steps: [
      'Cook onion and peppers for 8 minutes until soft.',
      'Add garlic and cumin, then the tomatoes. Simmer for 10 minutes.',
      'Make little wells and crack in the eggs. Cover and cook for 6 minutes.',
      'Crumble feta over the top and bring the pan to the table.',
    ],
    source: { platform: 'snapchat', url: 'https://www.snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYbGRu', creator: '@brunchboy.snaps' },
    saved: true,
    importedAt: daysFromNow(-3),
    createdAt: daysFromNow(-3),
  },
  {
    id: 'r-lemon-orzo',
    title: 'Lemon Parmesan Orzo',
    image: dish('085dc9789a7e76994002f1588933a46212cac301'),
    servings: 3,
    cookTime: 18,
    ingredients: [
      i('Orzo', 250, 'g'),
      i('Lemon', 1, ''),
      i('Parmesan', 0.5, 'cup'),
      i('Butter', 2, 'tbsp'),
      i('Frozen peas', 1, 'cup'),
      i('Garlic', 2, 'cloves'),
    ],
    steps: [
      'Toast the orzo in butter with garlic for 2 minutes.',
      'Add 3 cups of hot water and simmer for 10 minutes, stirring often.',
      'Stir in the peas for the last 2 minutes.',
      'Finish with lemon zest, juice and plenty of parmesan.',
    ],
    source: { platform: 'snapchat', url: 'https://www.snapchat.com/spotlight/cozycook_orzo', creator: '@cozycook' },
    saved: false,
    importedAt: null,
    createdAt: daysFromNow(-18),
  },
  {
    id: 'r-peanut-noodles',
    title: 'Spicy Peanut Noodles',
    image: dish('e3436c97ed948f597141fa12cedb901f75fd12aa'),
    servings: 2,
    cookTime: 15,
    ingredients: [
      i('Spaghetti', 200, 'g'),
      i('Peanut butter', 3, 'tbsp'),
      i('Soy sauce', 2, 'tbsp'),
      i('Garlic', 2, 'cloves'),
      i('Scallions', 3, ''),
      i('Chili crisp', 1, 'tbsp'),
    ],
    steps: [
      'Cook the spaghetti for 9 minutes.',
      'Whisk peanut butter, soy, garlic and chili crisp with a splash of hot pasta water.',
      'Toss the noodles in the sauce and top with scallions.',
    ],
    source: { platform: 'snapchat', url: 'https://www.snapchat.com/spotlight/noodlenights', creator: '@noodlenights' },
    saved: false,
    importedAt: null,
    createdAt: daysFromNow(-12),
  },
  {
    id: 'r-smash-tacos',
    title: 'Smash Burger Tacos',
    image: dish('79826d7aaab21e5f32dc99d13885133dfe518170'),
    servings: 4,
    cookTime: 20,
    ingredients: [
      i('Ground beef', 500, 'g'),
      i('Flour tortillas', 8, ''),
      i('Cheddar', 1, 'cup'),
      i('Yellow onion', 0.5, ''),
      i('Pickles', 0.25, 'cup'),
      i('Iceberg lettuce', 1, 'cup shredded'),
    ],
    steps: [
      'Press a thin layer of beef onto each tortilla.',
      'Cook beef-side down in a hot pan for 3 minutes until crusty.',
      'Flip, add cheddar and cook for 1 minute more.',
      'Load with lettuce, onion and pickles. Fold and eat immediately.',
    ],
    source: { platform: 'tiktok', url: 'https://www.tiktok.com/@grillgoblin/video/7312223334445', creator: '@grillgoblin' },
    saved: false,
    importedAt: null,
    createdAt: daysFromNow(-9),
  },
  {
    id: 'r-chicken-soup',
    title: 'Cozy Chicken Noodle Soup',
    image: dish('7e3d9fc7c1b09c61cfa972e5e4736a1fe5bfb9c5'),
    servings: 6,
    cookTime: 45,
    ingredients: [
      i('Chicken thighs', 600, 'g'),
      i('Yellow onion', 1, ''),
      i('Carrots', 3, ''),
      i('Celery', 2, 'stalks'),
      i('Spaghetti', 150, 'g broken'),
      i('Garlic', 3, 'cloves'),
      i('Chicken stock', 2, 'L'),
    ],
    steps: [
      'Soften onion, carrot and celery for 8 minutes.',
      'Add garlic, stock and whole chicken thighs. Simmer for 25 minutes.',
      'Shred the chicken, return it to the pot and add the pasta.',
      'Cook for 8 minutes more and season to taste.',
    ],
    source: { platform: 'web', url: 'https://example.com/recipes/chicken-noodle-soup', creator: '@smittenbites' },
    saved: true,
    importedAt: null,
    createdAt: daysFromNow(-40),
  },
  {
    id: 'r-meatballs',
    title: "Grandma's Sunday Meatballs",
    image: dish('f53011cb9b7287c22fb572f1658adc167a0f89cf'),
    servings: 4,
    cookTime: 50,
    ingredients: [
      i('Ground beef', 500, 'g'),
      i('Parmesan', 0.5, 'cup'),
      i('Eggs', 1, ''),
      i('Garlic', 2, 'cloves'),
      i('Breadcrumbs', 0.5, 'cup'),
      i('Marinara sauce', 1, 'jar'),
      i('Spaghetti', 400, 'g'),
    ],
    steps: [
      'Mix beef, parmesan, egg, garlic and breadcrumbs. Roll into 16 balls.',
      'Brown the meatballs all over for 8 minutes.',
      'Pour in the marinara and simmer gently for 20 minutes.',
      'Serve over spaghetti with extra parmesan.',
    ],
    // Mock source reference for a photographed recipe card (not a real upload).
    source: { platform: 'photo', url: 'https://example.com/recipe-cards/sunday-meatballs', creator: '@grandmaskitchen' },
    saved: true,
    importedAt: null,
    createdAt: daysFromNow(-60),
  },
];

let gid = 0;
const g = (
  name: string,
  qty: number | null,
  unit: string,
  aisle: GroceryItem['aisle'],
  addedBy: string,
  recipeIds: string[],
): GroceryItem => ({
  id: `g-${++gid}`,
  name,
  qty,
  unit,
  aisle,
  addedBy,
  recipeIds,
  checked: false,
  checkedAt: null,
});

export const seedGroceries = (): GroceryItem[] => {
  gid = 0;
  return [
    g('Sun-dried tomatoes', 1, 'jar', 'Pantry', PARTNER_ID, ['r-tuscan-pasta']),
    g('Sesame oil', 1, 'bottle', 'Pantry', ME_ID, ['r-shrimp-rice']),
    g('Honey', 1, 'jar', 'Pantry', PARTNER_ID, ['r-honey-salmon']),
    g('Flour tortillas', 16, '', 'Pantry', ME_ID, ['r-fajitas', 'r-smash-tacos']),
    g('Limes', 2, '', 'Produce', PARTNER_ID, ['r-fajitas']),
    g('Broccoli', 1, 'head', 'Produce', ME_ID, ['r-beef-broccoli']),
    g('Feta', 200, 'g', 'Dairy', PARTNER_ID, ['r-shakshuka']),
    g('Flank steak', 400, 'g', 'Meat & Fish', ME_ID, ['r-beef-broccoli']),
    g('Carrots', 3, '', 'Produce', PARTNER_ID, ['r-chicken-soup']),
    g('Chicken stock', 2, 'L', 'Pantry', ME_ID, ['r-chicken-soup']),
  ];
};

/** Fresh empty kitchen used for new installs. Seed recipe/pantry helpers are unused. */
export const starterRecipes = (): Recipe[] =>
  seedRecipes().filter((r) => (STARTER_RECIPE_IDS as readonly string[]).includes(r.id));

/** Fresh kitchen for new installs: one member, no demo pantry/list, a few starter recipes. */
export const createMockData = () => ({
  members: seedMembers.map((member) => ({ ...member })),
  pantry: [] as PantryItem[],
  recipes: starterRecipes(),
  groceries: [] as GroceryItem[],
});
