// scan-kitchen — reads a fridge-shelf or grocery-receipt photo with OpenAI
// vision and returns pantry line items for the in-app review step.
// Body: { mode: "receipt" | "fridge", image: "<base64 jpeg/png/webp>" }
//    →  { items: [{ name, quantity, location, expiresInDays }] }
// Secrets: OPENAI_API_KEY. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided.

const cors: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...cors } });

const LOCS = new Set(["fridge", "freezer", "pantry"]);

const PROMPT: Record<string, string> = {
  receipt:
    "You are reading a photo of a grocery store receipt. Read EVERY product line, top to bottom, carefully — receipts are dense and abbreviated.\n" +
    "Return JSON {\"items\":[{\"name\":\"friendly grocery name\",\"quantity\":\"e.g. 2, 1.4 lb, 1 dozen, 1 jar\",\"location\":\"fridge|freezer|pantry\",\"expiresInDays\":number|null}]}.\n" +
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
    "Identify the edible food items visibly in this fridge, freezer, or kitchen photo. " +
    "Return JSON {\"items\":[{\"name\":\"item name\",\"quantity\":\"best estimate or 1\",\"location\":\"fridge|freezer|pantry\",\"expiresInDays\":number|null}]}. " +
    "Estimate remaining freshness in days from what you see; null if it does not really expire. " +
    "Skip unidentifiable containers and non-food objects. Do not invent a full fridge of items you cannot see.",
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
  for (const row of list.slice(0, 80)) {
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

async function readImage(key: string, prompt: string, url: string, models: string[]): Promise<unknown> {
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
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url, detail: "high" } },
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
    const body = await req.json().catch(() => null) as { mode?: unknown; image?: unknown } | null;
    const mode = String(body?.mode ?? "") === "fridge" ? "fridge" : String(body?.mode ?? "") === "receipt" ? "receipt" : "";
    if (!mode) return json({ error: "Missing mode" }, 400);
    const url = dataUrl(String(body?.image ?? ""));
    if (!url) return json({ error: "Missing image" }, 400);

    // Receipts are dense small print: lead with the strongest vision models.
    const models = mode === "receipt" ? ["gpt-4.1", "gpt-4o", "gpt-4o-mini"] : ["gpt-4o", "gpt-4o-mini"];
    const parsed = await readImage(key, PROMPT[mode], url, models);
    if (!parsed) return json({ error: "Couldn't read that photo" }, 502);
    const items = parseItems(parsed, mode === "receipt" ? "fridge" : "fridge");
    if (!items.length) return json({ error: "No items found" }, 422);
    return json({ items });
  } catch (e) {
    console.log("[scan-kitchen] error", e);
    return json({ error: "Couldn't read that photo" }, 500);
  }
});
