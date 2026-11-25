// scan-kitchen — reads a fridge-shelf or grocery-receipt photo with OpenAI
// vision and returns pantry line items for the in-app review step.
// Body: { mode: "receipt" | "fridge", image: "<base64>" } or { mode, images: ["<base64>", ...] }
//    →  { items: [{ name, quantity, location, expiresInDays }] }
// Secrets: OPENAI_API_KEY. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided.

import { consumeUsage, gateUsage } from "../_shared/plus.ts";

const cors: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-hd-app-user-id",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...cors } });

const LOCS = new Set(["fridge", "freezer", "pantry"]);

const PROMPT: Record<string, string> = {
  receipt:
    "You are reading a grocery store receipt. It may come as ONE photo or as SEVERAL photos that are consecutive top-to-bottom sections of the same receipt; neighbouring sections overlap by a few lines, so a line that appears at the bottom of one section and the top of the next is ONE line — count it once.\n" +
    "Work in two passes and return JSON {\"lines\":[\"exact text of every product line, in order\"],\"items\":[{\"name\":\"friendly grocery name\",\"quantity\":\"e.g. 2, 1.4 lb, 1 dozen, 1 jar\",\"location\":\"fridge|freezer|pantry\",\"expiresInDays\":number|null}]}.\n" +
    "Pass 1 (lines): transcribe every purchased-product line exactly as printed, including its quantity/weight line if it has one. Do not skip any.\n" +
    "Pass 2 (items): turn each food/drink line from pass 1 into an item. Every item must come from a transcribed line — never add products that aren't printed.\n" +
    "Rules:\n" +
    "- Decode store abbreviations into the everyday product: 'GV WHL MLK GAL' → Whole milk (1 gallon); 'KS ORG EGGS 24CT' → Organic eggs (24); 'BNLS SKNLS CHKN BRST' → Boneless skinless chicken breast; 'HASS AVOC' → Avocados; 'ORG BBY SPIN 5OZ' → Organic baby spinach (5 oz).\n" +
    "- Drop brand/store prefixes (GV, KS, KIRK, 365, TJ, HEB, MKT, ORG stays as 'Organic').\n" +
    "- Quantity: use the count ('2 @ 3.99' → 2), weight lines ('1.42 lb @ 5.99/lb' → 1.4 lb), or the pack size in the name. Default 1.\n" +
    "- Merge repeated lines of the same product into one item with the summed quantity.\n" +
    "- Only food and drink. Skip tax, subtotal, total, savings, coupons, bag fees, deposits/CRV, card/payment lines, store info, and non-food (paper towels, soap, batteries).\n" +
    "- location: where it lives at home (meat, dairy, produce → fridge; frozen items → freezer; dry goods, cans, spices → pantry).\n" +
    "- expiresInDays: typical unopened shelf life (milk 7, chicken 2, berries 4, eggs 28, frozen 180); null for things that don't really expire.\n" +
    "- If a line is truly unreadable, skip it rather than guessing a random product.",
  fridge:
    "You are taking inventory of a fridge, freezer, pantry shelf or kitchen counter for a cooking app. Be thorough: the user wants EVERYTHING that is there, because missed items mean worse dinner ideas.\n" +
    "You may get ONE photo, or the WHOLE photo first followed by zoomed-in sections of the same photo (they overlap). Use the zoomed sections to read small items and labels, but count every physical item ONCE.\n" +
    "Work in two passes and return JSON {\"zones\":[{\"zone\":\"e.g. top shelf, door shelf 2, crisper drawer\",\"seen\":[\"what you see there\"]}],\"items\":[{\"name\":\"everyday grocery name\",\"quantity\":\"count or amount, e.g. 6, 1 carton, half a bag\",\"location\":\"fridge|freezer|pantry\",\"expiresInDays\":number|null,\"confidence\":\"high|medium\"}]}.\n" +
    "Pass 1 (zones): scan zone by zone: every shelf top to bottom, left to right, then each door shelf, then drawers/crispers, then anything on top or on the counter. List everything you can see in each zone, including partly hidden items, drinks, condiments, sauces, jars, deli packs, leftovers and produce behind glass drawers.\n" +
    "Pass 2 (items): turn pass 1 into a clean list.\n" +
    "Rules:\n" +
    "- Read labels and packaging: name the actual food in plain words ('Chobani' → Greek yogurt, 'Kerrygold' → butter, 'Sriracha' → sriracha sauce). Drop brand names.\n" +
    "- Be specific when you can tell (chicken breasts, ground beef, cheddar cheese, baby spinach, bell peppers, strawberries), generic when you can't (cheese, lunch meat, leftovers in container).\n" +
    "- Include proteins (meat, fish, eggs, tofu, deli meat), dairy, produce, herbs, condiments, sauces, dressings, drinks like milk and juice, bread, tortillas and leftovers. Skip non-food and anything you truly cannot identify.\n" +
    "- Count repeated items (6 eggs visible in a tray → 6; three yogurt cups → 3). Merge duplicates.\n" +
    "- confidence: high when clearly visible, medium when partly hidden but likely. Leave out pure guesses.\n" +
    "- location: where this photo is (fridge unless it's clearly a freezer or a pantry shelf).\n" +
    "- expiresInDays: estimate from what you see (fresh herbs 4, berries 3, opened milk 5, raw chicken 2, eggs 21, condiments 90); null for things that don't really expire.",
};

function dataUrl(image: string): string | null {
  const raw = image.trim();
  if (!raw) return null;
  if (/^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,/i.test(raw)) return raw;
  const compact = raw.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(compact) || compact.length < 80) return null;
  const mime = compact.startsWith("/9j/") ? "image/jpeg" : compact.startsWith("iVBOR") ? "image/png" : compact.startsWith("UklGR") ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${compact}`;
}

function parseItems(raw: unknown, fallbackLoc: string): { name: string; quantity: string; location: string; expiresInDays: number | null }[] {
  const list = Array.isArray(raw) ? raw : (raw as { items?: unknown })?.items;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const row of list.slice(0, 120)) {
    const r = row as Record<string, unknown>;
    const name = String(r?.name ?? "").trim().slice(0, 80);
    if (!name) continue;
    const quantity = String(r?.quantity ?? r?.qty ?? "1").trim().slice(0, 40) || "1";
    const loc = String(r?.location ?? fallbackLoc).toLowerCase();
    const location = LOCS.has(loc) ? loc : fallbackLoc;
    const exp = r?.expiresInDays;
    const expiresInDays = exp === null || exp === undefined || exp === "" ? null : Math.max(0, Math.min(730, Math.round(Number(exp))));
    out.push({ name, quantity, location, expiresInDays: Number.isFinite(expiresInDays as number) || expiresInDays === null ? expiresInDays as number | null : null });
  }
  return out;
}

async function readImage(key: string, prompt: string, urls: string[], models: string[], mode = "receipt"): Promise<unknown> {
  for (const model of models) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: urls.length > 1 ? `${prompt}\n\n${mode === "fridge" ? `Image 1 is the whole photo; images 2-${urls.length} are zoomed-in, overlapping sections of it.` : `There are ${urls.length} sections below, in order from the top of the receipt to the bottom.`}` : prompt },
            ...urls.map((url) => ({ type: "image_url", image_url: { url, detail: "high" } })),
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.log("[scan-kitchen]", model, res.status, (await res.text().catch(() => "")).slice(0, 180));
      continue;
    }
    const body = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = body?.choices?.[0]?.message?.content ?? "";
    try { return JSON.parse(text); } catch { console.log("[scan-kitchen] bad json", text.slice(0, 160)); }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return json({ error: "Not configured" }, 500);
    const body = await req.json().catch(() => null) as { mode?: unknown; image?: unknown; images?: unknown } | null;
    const mode = String(body?.mode ?? "") === "fridge" ? "fridge" : String(body?.mode ?? "") === "receipt" ? "receipt" : "";
    if (!mode) return json({ error: "Missing mode" }, 400);
    const rawImages = Array.isArray((body as { images?: unknown })?.images) ? ((body as { images: unknown[] }).images).slice(0, 6) : [body?.image];
    const urls = rawImages.map((i) => {
      const v = String(i ?? "").trim();
      return /^https:\/\/\S+$/i.test(v) ? v : dataUrl(v);
    }).filter((u): u is string => !!u);
    if (!urls.length) return json({ error: "Missing image" }, 400);

    const blocked = await gateUsage(req, "scan", { cors });
    if (blocked) return blocked;

    // Receipts are dense small print: lead with the strongest vision models.
    const models = ["gpt-4.1", "gpt-4o", "gpt-4o-mini"];
    const parsed = await readImage(key, PROMPT[mode], urls, models, mode);
    const lineCount = Array.isArray((parsed as { lines?: unknown[] } | null)?.lines) ? (parsed as { lines: unknown[] }).lines.length : 0;
    console.log("[scan-kitchen]", mode, `${urls.length} image(s)`, `${lineCount} lines`);
    if (!parsed) return json({ error: "Couldn't read that photo" }, 502);
    const items = parseItems(parsed, mode === "receipt" ? "fridge" : "fridge");
    if (!items.length) return json({ error: "No items found" }, 422);
    await consumeUsage(req, "scan");
    return json({ items });
  } catch (e) {
    console.log("[scan-kitchen] error", e);
    return json({ error: "Couldn't read that photo" }, 500);
  }
});
