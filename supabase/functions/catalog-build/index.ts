// catalog-build — fills hd_catalog with ready-made recipes for one category (a diet or "dessert").
// POST { category, count?: 13 }  → { added, total }
// Admin use only (called from the database), never from the app.
const base = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI = Deno.env.get("OPENAI_API_KEY")!;
const H = { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" };

const RULES: Record<string, string> = {
  keto: "Strict keto: under ~15 g net carbs per serving. No sugar, grains, potatoes, rice, pasta, bread, beans or sweet fruit.",
  carnivore: "Carnivore: only animal foods — meat, poultry, fish, seafood, eggs, butter, tallow, cheese, bone broth, salt. No plants, no spices beyond salt (pepper allowed sparingly).",
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

async function existing(category: string): Promise<string[]> {
  const r = await fetch(`${base}/rest/v1/hd_catalog?select=title&category=eq.${encodeURIComponent(category)}`, { headers: H });
  return ((await r.json()) as { title: string }[]).map((x) => x.title);
}

Deno.serve(async (req) => {
  try {
    const { category, count = 13 } = await req.json();
    const rule = RULES[category];
    if (!rule) return Response.json({ error: "unknown category" }, { status: 400 });
    const have = await existing(category);
    const prompt = `Create ${count} different, popular, home-cookable ${category === "dessert" ? "dessert" : "dinner"} recipes for this category.
${rule}
Mix cuisines (American, Mexican, Italian, Middle Eastern, Asian, Mediterranean, Latin, etc.), proteins and cooking methods. Real, well-known dishes people would search for. Weeknight friendly where possible.
Do NOT repeat any of these existing titles: ${have.join("; ") || "(none)"}.
Return ONLY JSON: {"recipes":[{"title":string,"blurb":string (one appetizing sentence),"servings":number,"cookTime":number (total minutes),"cuisine":string,"tags":[string] (2-4 short tags),"ingredients":[{"name":string,"qty":number|null,"unit":string}],"steps":[string]}]}
Ingredients: real amounts; qty numeric (0.5 not "1/2"); unit short (g, kg, ml, cup, tbsp, tsp, oz, lb, clove, can, pinch) or "" for whole items. 6-14 ingredients.
Steps: 5-9 short imperative steps with times and heat.`;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.8, response_format: { type: "json_object" }, max_tokens: 16000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return Response.json({ error: `openai ${res.status}`, detail: (await res.text()).slice(0, 300) }, { status: 502 });
    const j = await res.json();
    const list = (JSON.parse(j.choices[0].message.content).recipes ?? []) as any[];
    const seen = new Set(have.map((t) => t.toLowerCase()));
    const rows = list
      .filter((r) => r?.title && Array.isArray(r.ingredients) && r.ingredients.length && Array.isArray(r.steps) && r.steps.length && !seen.has(String(r.title).toLowerCase()))
      .map((r) => {
        seen.add(String(r.title).toLowerCase());
        const slug = String(r.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
        return {
          id: `c-${category}-${slug}`,
          category,
          title: String(r.title).slice(0, 120),
          data: {
            title: String(r.title).slice(0, 120),
            blurb: String(r.blurb ?? "").slice(0, 200),
            servings: Number(r.servings) || 4,
            cookTime: Number(r.cookTime) || 30,
            cuisine: String(r.cuisine ?? ""),
            tags: Array.isArray(r.tags) ? r.tags.slice(0, 4).map(String) : [],
            ingredients: r.ingredients.map((i: any) => ({ name: String(i?.name ?? "").slice(0, 80), qty: typeof i?.qty === "number" ? i.qty : null, unit: String(i?.unit ?? "") })).filter((i: any) => i.name),
            steps: r.steps.map((s: any) => String(s).replace(/^\d+[.)]\s*/, "")).filter(Boolean),
          },
        };
      });
    if (rows.length) {
      const up = await fetch(`${base}/rest/v1/hd_catalog?on_conflict=id`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
      if (!up.ok) return Response.json({ error: `insert ${up.status}`, detail: (await up.text()).slice(0, 300) }, { status: 500 });
    }
    return Response.json({ added: rows.length, total: have.length + rows.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
