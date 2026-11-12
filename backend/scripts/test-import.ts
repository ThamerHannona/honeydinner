import { importRecipeFromUrl } from "../src/services/recipe-import";

const URLS = [
  "https://www.tiktok.com/@cookingwithkianaa/video/7514784389268557086",
  "https://www.tiktok.com/@geoffreyzakarian/video/7480299561106361646",
  "https://www.tiktok.com/@gidsgids/video/7468087658774826282?lang=en",
];

function compact(recipe: Awaited<ReturnType<typeof importRecipeFromUrl>>) {
  return {
    title: recipe.title,
    creator: recipe.source.creator,
    platform: recipe.source.platform,
    url: recipe.source.url,
    ingredients: recipe.ingredients.slice(0, 8),
    steps: recipe.steps.slice(0, 4),
    image: recipe.image,
  };
}

async function main() {
  for (const url of URLS) {
    console.log("\n=== Import:", url);
    try {
      const recipe = await importRecipeFromUrl(url);
      console.log(JSON.stringify(compact(recipe), null, 2));
    } catch (e) {
      console.log(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }, null, 2));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

