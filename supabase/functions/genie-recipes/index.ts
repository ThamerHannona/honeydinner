// genie-recipes — FridgeGenie invents dinners from what's in the kitchen,
// matched to the household's eating style.
//
// Body: {
//   diets: string[]            e.g. ["keto"], ["vegan"], [] for no rules
//   pantry: [{ name, location: "fridge"|"freezer"|"pantry", daysLeft: number|null }]
//   servings?: number          default 2
//   avoid?: string[]           titles already suggested / in the recipe box
//   mood?: string              optional free text ("quick", "comfort food", …)
//   lang?: "en"|"ar"|"es"      language to write the ideas in (default en)
// }
// → { recipes: [{ title, blurb, servings, cookTime, ingredients:[{name,qty,unit,have}], steps:[], uses:[], tags:[] }] }
// Secrets: OPENAI_API_KEY.
// Free users: 3 rounds a week (onboarding demo is free). Plus: unlimited.

import { consumeUsage, gateUsage } from "../_shared/plus.ts";

const cors: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-hd-app-user-id",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...cors } });

const DIET_RULES: Record<string, string> = {
  carnivore: "Carnivore: only animal foods — meat, fish, seafood, eggs, butter/tallow, hard cheese. No plants, grains, sugar, seed oils. Salt is fine.",
  keto: "Keto: under ~20 g net carbs per serving. No grains, sugar, potatoes, rice, pasta, bread, most fruit, beans. Lots of meat, fish, eggs, cheese, butter, olive oil, avocado, leafy and low-carb veg.",
  atkins: "Atkins: low-carb, high-protein. No sugar, grains, bread, pasta, rice, potatoes. Meat, fish, eggs, cheese, low-carb vegetables, healthy fats.",
  paleo: "Paleo: fresh meat, fish, eggs, vegetables, fruit, nuts, seeds, olive/avocado oil. No grains, legumes, dairy, refined sugar, seed oils, or processed food. Processed meats (sausage, bacon, deli meat, hot dogs) only if named as sugar-free/uncured, e.g. 'sugar-free uncured bacon' — otherwise use fresh meat instead.",
  mediterranean: "Mediterranean: vegetables, legumes, whole grains, olive oil, fish and seafood, some poultry, eggs, yogurt/feta, herbs, lemon. Little red meat, no processed meat or added sugar.",
  "low-fat": "Low-fat: lean proteins (chicken breast, white fish, legumes, egg whites), lots of vegetables, whole grains; minimal oil (≤1 tsp per serving), no fried food, cream, butter or fatty cuts.",
  vegan: "Vegan: absolutely no animal products — no meat, poultry, fish, seafood, eggs, dairy (milk, butter, cheese, cream, yogurt, ghee), honey, gelatin, or animal stock.",
  "plant-based": "Plant-based: whole-food, plant-forward and fully vegan — vegetables, legumes, whole grains, nuts, seeds, fruit; no animal products; minimal processed food and oil.",
  pescatarian: "Pescatarian: no meat or poultry; fish, seafood, eggs and dairy are fine.",
  "low-carb": "Low-carb: under ~40 g carbs per serving; limit bread, pasta, rice, potatoes and sugar; focus on protein and non-starchy vegetables.",
  "high-protein": "High-protein: at least ~35 g protein per serving from lean meat, fish, eggs, Greek yogurt, cottage cheese, tofu, tempeh or legumes.",
  whole30: "Whole30: no added sugar or sweeteners, alcohol, grains, legumes (including soy and peanuts), dairy, or processed additives. Meat, seafood, eggs, vegetables, fruit, natural fats. Sausage/bacon only if named as compliant (sugar-free, no additives).",
  "nut-free": "Nut-free: no tree nuts, peanuts, nut butters, nut oils or nut milks.",
  "low-sugar": "Low-sugar: no added sugar, honey, syrups or sweet sauces; minimal fruit; suitable for diabetics.",
  "low-sodium": "Low-sodium: no added salt beyond a pinch; avoid soy sauce, stock cubes, cured meats, salty cheese and canned foods with salt; season with herbs, citrus, garlic and spices.",
  halal: "Halal: no pork or pork products, no alcohol (including wine in cooking); meat must be halal.",
  kosher: "Kosher: no pork or shellfish; never combine meat and dairy in the same dish.",
  vegetarian: "Vegetarian: no meat or fish; eggs and dairy are fine.",
  "gluten-free": "Gluten-free: no wheat, barley, rye, regular pasta/bread/flour, soy sauce (use tamari).",
  "dairy-free": "Dairy-free: no milk, butter, cheese, cream, yogurt.",
};

const clean = (s: unknown, n = 120) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return json({ error: "Not configured" }, 500);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const onboarding = body.onboarding === true;
    if (!onboarding) {
      const gate = await gateUsage(req, "genie", { cors });
      if (gate) return gate;
    }

    const diets = (Array.isArray(body.diets) ? body.diets : []).map((d) => clean(d, 30).toLowerCase()).filter((d) => DIET_RULES[d]);
    const pantry = (Array.isArray(body.pantry) ? body.pantry : []).slice(0, 120).map((p: any) => ({
      name: clean(p?.name, 60),
      location: ["fridge", "freezer", "pantry"].includes(p?.location) ? p.location : "pantry",
      daysLeft: Number.isFinite(Number(p?.daysLeft)) && p?.daysLeft !== null ? Number(p.daysLeft) : null,
    })).filter((p) => p.name);
    const servings = Math.min(12, Math.max(1, Math.round(Number(body.servings) || 2)));
    const avoid = (Array.isArray(body.avoid) ? body.avoid : []).slice(0, 60).map((t) => clean(t, 80)).filter(Boolean);
    const mood = clean(body.mood, 140);
    // Cook-with picks, spoken/typed request and macro targets (all optional)
    const must = (Array.isArray(body.must) ? body.must : []).slice(0, 20).map((t) => clean(t, 60)).filter(Boolean);
    const onlyThese = body.only === true && must.length > 0;
    const request = clean(body.request, 400);
    const m = (body.macros ?? {}) as Record<string, unknown>;
    const num = (v: unknown, lo: number, hi: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
    const macros = {
      proteinMin: num(m.proteinMin, 5, 200),
      carbsMax: num(m.carbsMax, 0, 300),
      caloriesMax: num(m.caloriesMax, 150, 2500),
      fatMax: num(m.fatMax, 0, 200),
    };
    const macroRules = [
      macros.proteinMin !== null ? `at least ${macros.proteinMin} g protein` : "",
      macros.carbsMax !== null ? `no more than ${macros.carbsMax} g carbs` : "",
      macros.caloriesMax !== null ? `no more than ${macros.caloriesMax} calories` : "",
      macros.fatMax !== null ? `no more than ${macros.fatMax} g fat` : "",
    ].filter(Boolean);
    const lang = ["en", "ar", "es", "original"].includes(String(body.lang)) ? String(body.lang) : "en";
    const LANG_RULE: Record<string, string> = {
      ar: "Write title, blurb, tags, ingredient names and steps in clear, simple Arabic. Keep units as short Latin abbreviations (g, cup, tbsp) and quantities as numbers.",
      es: "Write title, blurb, tags, ingredient names and steps in Spanish. Keep units as short abbreviations and quantities as numbers.",
    };

    const byLoc = (loc: string) =>
      pantry.filter((p) => p.location === loc).map((p) => (p.daysLeft !== null && p.daysLeft <= 3 ? `${p.name} (use within ${Math.max(0, p.daysLeft)}d!)` : p.name)).join(", ") || "(empty)";

    const system =
      "You are FridgeGenie, a warm, practical home-cooking assistant. You invent realistic weeknight dinners that a normal home cook can make tonight.\n" +
      "Return ONLY JSON: {\"recipes\":[{\"title\":string,\"blurb\":string,\"servings\":number,\"cookTime\":number,\"tags\":[string],\"uses\":[string],\"macros\":{\"calories\":number,\"protein\":number,\"carbs\":number,\"fat\":number},\"ingredients\":[{\"name\":string,\"qty\":number|null,\"unit\":string,\"have\":boolean}],\"steps\":[string]}]}\n" +
      "Rules:\n" +
      "- Make exactly 4 different dinners (different proteins/cuisines/techniques).\n" +
      "- Build each mainly from the kitchen inventory. Prioritise items marked 'use within'. Assume basics are available: salt, pepper, water, cooking oil (unless the diet forbids it), common dried spices.\n" +
      "- At most 3 ingredients per recipe that are NOT in the inventory (have=false); prefer 0–1.\n" +
      "- Diet rules are strict and ALL selected styles apply at once: every ingredient must comply with every rule. If the inventory can't make a compliant dinner, use fewer inventory items and add compliant missing items instead.\n" +
      "- Store-bought processed items (sausage, bacon, deli meat, sauces, broth, seasoning mixes) often hide sugar, gluten, dairy or additives. If one would break a selected diet unless it's a clean version, either skip it or name the compliant version in the ingredient (e.g. 'sugar-free andouille sausage (check label)'). Never tag a dish with a diet it doesn't fully meet.\n" +
      "- title: appetising dish name in Title Case. blurb: one short sentence on why it's a good pick tonight (mention what it uses up).\n" +
      "- ingredients: qty as a number (0.5 not 1/2) or null; unit short (g, kg, ml, cup, tbsp, tsp, oz, lb, clove, can, pinch) or \"\" for whole items. Scale to the servings requested.\n" +
      "- steps: 5–9 short imperative steps, one action each, with times and heat levels.\n" +
      "- macros: honest per-serving estimate (kcal and grams) from the ingredient amounts you list. If macro targets are given, every recipe MUST hit them per serving: size the protein portion, swap starches, and adjust fats until it does, then estimate truthfully.\n" +
      "- If the cook picked specific ingredients, build every dinner around them. If the request text says what they want (an ingredient, a flavor, a cuisine, a time limit), follow it.\n" +
      "- uses: names of inventory items the recipe uses. tags: 1–3 short labels like the diet, 'One pan', '20 min'.\n" +
      "- Never repeat a dish from the 'avoid' list.\n" +
      "- Kitchen items may be named in English, Arabic or Spanish — treat them as the same foods.";

    const user = [
      `Servings: ${servings}`,
      `Eating style: ${diets.length ? diets.map((d) => DIET_RULES[d]).join(" ") : "No restrictions — balanced, family-friendly."}`,
      mood ? `They're in the mood for: ${mood}` : "",
      request ? `What they asked FridgeGenie (in their words): "${request}"` : "",
      must.length ? (onlyThese
        ? `Use ONLY these ingredients plus basics (salt, pepper, oil, water, common dried spices): ${must.join(", ")}. Every recipe must use most of them.`
        : `Build every dinner around these ingredients they picked: ${must.join(", ")}. Other kitchen items are fine too.`) : "",
      macroRules.length ? `Macro targets per serving: ${macroRules.join(", ")}.` : "",
      `FRIDGE: ${byLoc("fridge")}`,
      `FREEZER: ${byLoc("freezer")}`,
      `PANTRY: ${byLoc("pantry")}`,
      avoid.length ? `Avoid these dishes: ${avoid.join("; ")}` : "",
      LANG_RULE[lang] ? `Language: ${LANG_RULE[lang]}` : "Language: English.",
    ].filter(Boolean).join("\n");

    let parsed: any = null;
    // Macro math needs the stronger model; plain ideas are fine on mini.
    for (const model of macroRules.length ? ["gpt-4.1", "gpt-4.1-mini"] : ["gpt-4.1-mini", "gpt-4o-mini"]) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.8,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (!res.ok) {
        console.log("[genie-recipes]", model, res.status, (await res.text().catch(() => "")).slice(0, 160));
        continue;
      }
      const j = await res.json() as any;
      try {
        parsed = JSON.parse(j?.choices?.[0]?.message?.content ?? "");
        break;
      } catch { /* try next model */ }
    }
    if (!parsed) return json({ error: "FridgeGenie is stuck. Try again." }, 502);

    const recipes = (Array.isArray(parsed?.recipes) ? parsed.recipes : []).slice(0, 4).map((r: any) => ({
      title: clean(r?.title, 80),
      blurb: clean(r?.blurb, 200),
      servings: Math.max(1, Math.round(Number(r?.servings) || servings)),
      cookTime: Math.max(5, Math.min(240, Math.round(Number(r?.cookTime) || 30))),
      tags: (Array.isArray(r?.tags) ? r.tags : []).slice(0, 3).map((t: unknown) => clean(t, 24)).filter(Boolean),
      macros: r?.macros && typeof r.macros === "object" ? {
        calories: num(r.macros.calories, 0, 4000) ?? 0,
        protein: num(r.macros.protein, 0, 400) ?? 0,
        carbs: num(r.macros.carbs, 0, 600) ?? 0,
        fat: num(r.macros.fat, 0, 400) ?? 0,
      } : null,
      uses: (Array.isArray(r?.uses) ? r.uses : []).slice(0, 12).map((t: unknown) => clean(t, 60)).filter(Boolean),
      ingredients: (Array.isArray(r?.ingredients) ? r.ingredients : []).slice(0, 25).map((i: any) => ({
        name: clean(i?.name, 60),
        qty: typeof i?.qty === "number" && Number.isFinite(i.qty) && i.qty > 0 ? Math.round(i.qty * 100) / 100 : null,
        unit: clean(i?.unit, 12),
        have: i?.have === true,
      })).filter((i: { name: string }) => i.name),
      steps: (Array.isArray(r?.steps) ? r.steps : []).slice(0, 12).map((s: unknown) => clean(s, 300).replace(/^\d+[.)]\s*/, "")).filter(Boolean),
    })).filter((r: any) => r.title && r.ingredients.length && r.steps.length);

    if (!recipes.length) return json({ error: "FridgeGenie couldn't think of anything. Add a few items and try again." }, 422);
    console.log("[genie-recipes] ok", diets.join(",") || "none", lang, pantry.length, "items →", recipes.map((r: any) => r.title).join(" | "));
    if (!onboarding) await consumeUsage(req, "genie").catch(() => {});
    return json({ recipes });
  } catch (e) {
    console.log("[genie-recipes] error", String(e));
    return json({ error: "FridgeGenie is stuck. Try again." }, 500);
  }
});
