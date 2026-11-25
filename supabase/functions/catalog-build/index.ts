// catalog-build — fills hd_catalog with ready-made recipes for one category (a diet or "dessert").
// POST { category, count?: 9, v?: 2 }  → { added, total }
// v2 (the rebuilt cookbook): ids "c2-…", stronger model, distinct named dishes, no repeats across categories.
// Admin use only (called from the database), never from the app.
const base = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI = Deno.env.get("OPENAI_API_KEY")!;
const H = { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" };

const RULES: Record<string, string> = {
  keto: "Strict keto: under ~15 g net carbs per serving. No sugar, grains, potatoes, rice, pasta, bread, beans or sweet fruit.",
  carnivore: "Carnivore: only animal foods — meat, poultry, fish, seafood, eggs, butter, ghee, tallow, lard, bacon, hard and soft cheeses, cream, bone broth, bone marrow, organ meats, salt. No plants (pepper allowed sparingly). Make them genuinely interesting: varied cuts (short rib, picanha, oxtail, pork belly, lamb shoulder, chicken thighs, duck, salmon, scallops), techniques (reverse sear, confit, braise, smash, crispy skin, sous-vide-style low oven) and pairings (egg yolk sauce, brown butter, parmesan crisps, bone broth reductions). At least 5 ingredients.",
  mediterranean: "Mediterranean: olive oil, vegetables, legumes, whole grains, fish, herbs, modest dairy and poultry; little red meat.",
  paleo: "Paleo: meat, fish, eggs, vegetables, fruit, nuts, seeds. No grains, legumes, dairy, refined sugar or processed meats.",
  atkins: "Atkins: low-carb, protein and healthy fat forward, under ~20 g net carbs per serving.",
  "low-carb": "Low-carb: under ~25 g carbs per serving; no bread, pasta or rice (cauliflower rice etc. fine).",
  "high-protein": "High-protein: 35 g+ protein per serving from lean meat, fish, eggs, Greek yogurt, legumes or tofu.",
  "low-fat": "Low-fat: under ~10 g fat per serving; lean proteins, vegetables, grains; no frying.",
  whole30: "Whole30: no sugar of any kind, alcohol, grains, legumes, soy, dairy, or processed meats with additives.",
  vegan: "Vegan: no animal products at all (no meat, fish, eggs, dairy, honey).",
  "plant-based": "Plant-based: whole-food plants first (vegetables, legumes, whole grains); no meat; minimal processed foods.",
  vegetarian: "Vegetarian: no meat or fish; eggs and dairy fine.",
  pescatarian: "Pescatarian: fish and seafood, vegetables, eggs, dairy; no meat or poultry.",
  "gluten-free": "Gluten-free: no wheat, barley, rye, regular pasta, bread, flour tortillas, regular soy sauce (use tamari).",
  "dairy-free": "Dairy-free: no milk, butter, cheese, cream, yogurt (plant alternatives fine).",
  "nut-free": "Nut-free: no tree nuts or peanuts, nut oils, nut butters or nut milks.",
  "low-sugar": "Low-sugar: no added sugar, syrups or sweet sauces; under ~6 g sugar per serving.",
  "low-sodium": "Low-sodium: under ~500 mg sodium per serving; no added salt-heavy sauces, cured meats or stock cubes; flavor with herbs, citrus, spices.",
  halal: "Halal: no pork or pork products, no alcohol in cooking; halal meat and poultry.",
  kosher: "Kosher: no pork or shellfish; never mix meat and dairy in one dish.",
  dessert: "Desserts: crowd-pleasing home desserts — cakes, cookies, pies, puddings, no-bake treats, frozen desserts, Middle Eastern and Latin desserts too (kunafa, baklava, tres leches, flan, churros).",
};

async function existing(category: string, v2: boolean): Promise<{ mine: string[]; all: string[]; sameCategory: string[] }> {
  // (two small queries: the REST API returns at most 1000 rows per call)
  const get = async (q: string) => (await (await fetch(`${base}/rest/v1/hd_catalog?select=id,title,category&${q}`, { headers: H })).json()) as { id: string; title: string; category: string }[];
  const pool = await get(v2 ? "id=like.c2-*" : `category=eq.${encodeURIComponent(category)}`);
  const chapter = await get(`category=eq.${encodeURIComponent(category)}`);
  return {
    mine: pool.filter((x) => x.category === category).map((x) => x.title),
    all: pool.map((x) => x.title),
    // the table is unique on (category, title), so never reuse a title already in this chapter
    sameCategory: chapter.map((x) => x.title),
  };
}

Deno.serve(async (req) => {
  try {
    const { category, count = 9, v = 1 } = await req.json();
    const v2 = Number(v) === 2;
    const rule = RULES[category];
    if (!rule) return Response.json({ error: "unknown category" }, { status: 400 });
    const ex = await existing(category, v2);
    const have = ex.mine;
    const prompt = v2
      ? `You are a recipe developer writing an original cookbook chapter. Create ${count} distinctive, excellent ${category === "dessert" ? "desserts" : "dinners"} for this chapter.
${rule}
What makes a great entry:
- A specific, named dish with a point of view, not a generic formula. Think regional classics and signature home-cooking dishes (e.g. Peruvian pollo a la brasa, Lebanese chicken shawarma with toum, Sichuan dry-fried green beans, Brazilian moqueca, Turkish lahmacun, Korean dakgalbi, Sicilian swordfish involtini, Oaxacan tlayudas, Thai larb, Georgian chicken satsivi), adapted to the rules above when needed.
- Spread across many cuisines (no more than 2 from any one cuisine in this batch), proteins, and techniques (roast, braise, grill, sheet pan, stir-fry, one-pot, stew, skewers, bake, smash, sear).
- Real technique with a reason it works: the step that makes it taste great (blooming spices, browning hard, deglazing, resting meat, finishing with acid/herbs).
- Titles: the dish name people would recognize, optionally with a short clarifier. Never prefix with a cuisine adjective like "Mediterranean ..." or "Asian-style ..." unless it is part of the dish's real name. No diet words in titles (no "Keto", "Paleo", "Vegan" prefixes).
- Must be clearly different from EVERY title already in the cookbook (any chapter), including near-duplicates (a different protein on the same formula counts as a duplicate): ${ex.all.join("; ") || "(none yet)"}.
- Write everything in your own words.`
      : `Create ${count} different, popular, home-cookable ${category === "dessert" ? "dessert" : "dinner"} recipes for this category.
${rule}
Mix cuisines (American, Mexican, Italian, Middle Eastern, Asian, Mediterranean, Latin, etc.), proteins and cooking methods. Real, well-known dishes people would search for. Weeknight friendly where possible.
Do NOT repeat any of these existing titles: ${have.join("; ") || "(none)"}.`;
    const tail = `
Return ONLY JSON: {"recipes":[{"title":string,"blurb":string (one appetizing sentence),"servings":number,"cookTime":number (total minutes),"cuisine":string,"tags":[string] (2-4 short tags),"tip":string (one sentence: the trick that makes it great),"ingredients":[{"name":string,"qty":number|null,"unit":string}],"steps":[string]}]}
Ingredients: real amounts; qty numeric (0.5 not "1/2"); unit short (g, kg, ml, cup, tbsp, tsp, oz, lb, clove, can, pinch) or "" for whole items. Plain grocery names (\"chicken thighs\", not \"4 bone-in, skin-on chicken thighs, patted dry\"). 6-14 ingredients.
Steps: 5-9 short imperative steps with times and heat.`;
    const fullPrompt = `${prompt}\n${tail}`;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI}`, "content-type": "application/json" },
      body: JSON.stringify({ model: v2 ? "gpt-4.1" : "gpt-4.1-mini", temperature: 0.85, response_format: { type: "json_object" }, max_tokens: 16000, messages: [{ role: "user", content: fullPrompt }] }),
    });
    if (!res.ok) return Response.json({ error: `openai ${res.status}`, detail: (await res.text()).slice(0, 300) }, { status: 502 });
    const j = await res.json();
    const list = (JSON.parse(j.choices[0].message.content).recipes ?? []) as any[];
    const seen = new Set([...(v2 ? ex.all : have), ...ex.sameCategory].map((t) => t.toLowerCase()));
    const rows = list
      .filter((r) => r?.title && Array.isArray(r.ingredients) && r.ingredients.length && Array.isArray(r.steps) && r.steps.length && !seen.has(String(r.title).toLowerCase()))
      .map((r) => {
        seen.add(String(r.title).toLowerCase());
        const slug = String(r.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
        return {
          id: `${v2 ? "c2" : "c"}-${category}-${slug}`,
          category,
          title: String(r.title).slice(0, 120),
          data: {
            title: String(r.title).slice(0, 120),
            blurb: String(r.blurb ?? "").slice(0, 200),
            servings: Number(r.servings) || 4,
            cookTime: Number(r.cookTime) || 30,
            cuisine: String(r.cuisine ?? ""),
            tags: Array.isArray(r.tags) ? r.tags.slice(0, 4).map(String) : [],
            tip: String(r.tip ?? "").slice(0, 240),
            ingredients: r.ingredients.map((i: any) => ({ name: String(i?.name ?? "").slice(0, 80), qty: typeof i?.qty === "number" ? i.qty : null, unit: String(i?.unit ?? "") })).filter((i: any) => i.name),
            steps: r.steps.map((s: any) => String(s).replace(/^\d+[.)]\s*/, "")).filter(Boolean),
          },
        };
      });
    if (rows.length) {
      const up = await fetch(`${base}/rest/v1/hd_catalog?on_conflict=id`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
      if (!up.ok) return Response.json({ error: `insert ${up.status}`, detail: (await up.text()).slice(0, 300) }, { status: 500 });
    }
    return Response.json({ added: rows.length, total: have.length + rows.length, titles: rows.map((r) => r.title) });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
