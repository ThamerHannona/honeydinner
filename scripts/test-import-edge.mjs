const URLS = [
  "https://www.tiktok.com/@cookingwithkianaa/video/7514784389268557086",
  "https://www.tiktok.com/@geoffreyzakarian/video/7480299561106361646",
  "https://www.tiktok.com/@gidsgids/video/7468087658774826282?lang=en",
  // Minimal caption (recipe mostly in the video): this is the audio/transcription stress test.
  "https://www.tiktok.com/@briscoeskitchenandspice/video/7655428988029947167",
];

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).");
  process.exit(1);
}

const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/import-recipe`;

for (const url of URLS) {
  console.log("\n=== Import:", url);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ url }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    console.log(JSON.stringify({ status: res.status, ...json }, null, 2));
    continue;
  }

  const recipe = json?.recipe;
  if (!recipe) {
    console.log(JSON.stringify({ status: res.status, ...json }, null, 2));
    continue;
  }

  console.log(
    JSON.stringify(
      {
        title: recipe.title,
        creator: recipe.source?.creator,
        platform: recipe.source?.platform,
        url: recipe.source?.url,
        ingredients: (recipe.ingredients || []).slice(0, 10),
        steps: (recipe.steps || []).slice(0, 6),
      },
      null,
      2
    )
  );
}

