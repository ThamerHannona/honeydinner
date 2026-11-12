import { env } from "../env";
import type { RecipeDraft, SourcePlatform } from "../types";
import { z } from "zod";

type PageMeta = {
  title: string | null;
  description: string | null;
  image: string | null;
};

type TikTokMeta = {
  platform: "tiktok";
  url: string;
  caption: string;
  creator: string | null;
  thumbnail: string | null;
  shareTitle: string | null;
};

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Missing URL.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const u = new URL(withScheme);
  u.hash = "";
  return u.toString();
}

function detectPlatform(url: string): SourcePlatform {
  const host = new URL(url).hostname.toLowerCase();
  if (/(^|\.)tiktok\.com$/.test(host) || /(^|\.)vm\.tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)instagram\.com$/.test(host) || /(^|\.)instagr\.am$/.test(host)) return "instagram";
  // YouTube Shorts + recipe sites are treated as generic web sources in the app.
  return "web";
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    ...init,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch post data (HTTP ${res.status}).`);
  return await res.text();
}

function extractMeta(html: string): PageMeta {
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m?.[1] ? decodeHtml(m[1]).trim() : null;
  };
  const title =
    pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
    pick(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
    pick(/<title[^>]*>([^<]+)<\/title>/i);
  const description =
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
    pick(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  const image =
    pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
    pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  return { title, description, image };
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function extractTikTokUniversalData(html: string): any {
  const m = html.match(
    /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!m?.[1]) throw new Error("Couldn't read this TikTok post (missing data block).");
  try {
    return JSON.parse(m[1]);
  } catch {
    throw new Error("Couldn't read this TikTok post (invalid data block).");
  }
}

async function fetchTikTokMeta(url: string): Promise<TikTokMeta> {
  const html = await fetchText(url);
  const data = extractTikTokUniversalData(html);
  const scope = data?.__DEFAULT_SCOPE__;
  const vd = scope?.["webapp.video-detail"];
  const item = vd?.itemInfo?.itemStruct;
  const caption: string | undefined = item?.desc;
  if (!caption || !caption.trim()) throw new Error("Couldn't find a caption for that TikTok post.");

  const uniqueId: string | undefined = item?.author?.uniqueId;
  const creator = uniqueId ? `@${uniqueId}` : null;
  const thumbnail: string | undefined =
    item?.video?.cover ?? item?.video?.originCover ?? item?.video?.dynamicCover ?? item?.video?.thumbnail;
  const shareTitle: string | undefined = vd?.shareMeta?.title ?? vd?.shareMeta?.desc;

  return {
    platform: "tiktok",
    url,
    caption: caption.trim(),
    creator,
    thumbnail: thumbnail ?? null,
    shareTitle: shareTitle?.trim() ?? null,
  };
}

function guessTitleFromText(text: string): string | null {
  const firstHashtag = text.trim().match(/^#([A-Za-z][A-Za-z0-9_-]+)/);
  if (firstHashtag?.[1]) {
    const raw = firstHashtag[1].replace(/_/g, " ");
    const spaced = raw.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    if (spaced.length >= 4) return spaced;
  }

  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  if (!cleaned) return null;
  const stopIdx =
    cleaned.search(/\b(ingredients|directions|instructions|recipe)\b/i) >= 0
      ? cleaned.search(/\b(ingredients|directions|instructions|recipe)\b/i)
      : -1;
  const head = stopIdx > 8 ? cleaned.slice(0, stopIdx).trim() : cleaned;
  const head2 = head.replace(/[#@][\w.]+/g, "").trim();
  if (!head2) return null;
  const title = head2
    .replace(/[🔥😩✨💛💚❤️📝⬇️]+/g, "")
    .replace(/\b(bookmark( this)?|full recipe)\b.*$/i, "")
    .trim();
  if (title.length < 4) return null;
  return title;
}

function splitSection(text: string, headerRe: RegExp): { head: string; rest: string } | null {
  const m = text.match(headerRe);
  if (!m || m.index == null) return null;
  const idx = m.index;
  const after = idx + m[0].length;
  return { head: text.slice(0, idx), rest: text.slice(after) };
}

function tokenizeLines(block: string): string[] {
  // TikTok captions are often a single line with "- item - item" patterns.
  const normalized = block
    .replace(/\r/g, "")
    .replace(/\s+-\s+/g, "\n- ")
    .replace(/\s+\*\s+/g, "\n- ")
    .replace(/•/g, "-");
  return normalized
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("-") ? l.replace(/^-+\s*/, "").trim() : l));
}

function parseQtyUnitName(line: string): { qty: number | null; unit: string; name: string } {
  const original = line.trim();
  const m = original.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s+([a-zA-Z]+\.?)\s+(.+)$/
  );
  if (!m) return { qty: null, unit: "", name: original };
  const qtyText = m[1];
  const unitText = m[3];
  const nameText = m[4];
  if (!qtyText || !unitText || !nameText) return { qty: null, unit: "", name: original };

  const qty1 = parseFractional(qtyText);
  const qty2 = m[2] ? Number(m[2]) : null;
  const qty = qty2 ? (qty1 != null ? (qty1 + qty2) / 2 : qty2) : qty1;
  const unit = normalizeUnit(unitText);
  const name = nameText.trim();
  return { qty: qty ?? null, unit, name };
}

function parseFractional(s: string): number | null {
  const t = s.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  // Captions sometimes drop the space: "11/2" meaning 1 1/2, "31/4" meaning 3 1/4.
  const squashedMixed = t.match(/^(\d+)(\d)\/(\d+)$/);
  if (squashedMixed) return Number(squashedMixed[1]) + Number(squashedMixed[2]) / Number(squashedMixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const num = Number(t);
  return Number.isFinite(num) ? num : null;
}

function normalizeUnit(u: string): string {
  const unit = u.toLowerCase().replace(/\.$/, "");
  const map: Record<string, string> = {
    tbsp: "tbsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    tsp: "tsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    cup: "cup",
    cups: "cup",
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    lb: "lb",
    lbs: "lb",
    pound: "lb",
    pounds: "lb",
    ml: "ml",
    l: "l",
    clove: "cloves",
    cloves: "cloves",
    stick: "stick",
    sticks: "stick",
    can: "can",
    cans: "can",
    pinch: "pinch",
    handful: "handful",
  };
  return map[unit] ?? unit;
}

function heuristicStructure(
  caption: string,
  fallbackTitle: string | null
): Omit<RecipeDraft, "source" | "image"> | null {
  const ingredientsMatch = caption.match(/\b(ingredients?|recipe)\b\s*[:\-]?\s*/i);
  const directionsMatch = caption.match(/\b(directions?|instructions?|method|steps)\b\s*[:\-]?\s*/i);

  let title = fallbackTitle ?? guessTitleFromText(caption) ?? "Recipe";
  title = title.replace(/\s+/g, " ").trim();

  const ingredientsBlock =
    ingredientsMatch && ingredientsMatch.index != null
      ? caption.slice(
          ingredientsMatch.index + ingredientsMatch[0].length,
          directionsMatch && directionsMatch.index != null && directionsMatch.index > ingredientsMatch.index
            ? directionsMatch.index
            : caption.length
        )
      : null;
  const directionsBlock =
    directionsMatch && directionsMatch.index != null
      ? caption.slice(directionsMatch.index + directionsMatch[0].length)
      : null;

  const ingredients: RecipeDraft["ingredients"] = [];
  if (ingredientsBlock) {
    const exploded = explodeIngredientRuns(ingredientsBlock);
    for (const line of tokenizeLines(exploded)) {
      // Skip headings like "For the sauce:"
      if (/^for (the )?/i.test(line) && (/:$/.test(line) || /\*$/.test(line))) continue;
      if (/^\*.*\*$/.test(line)) continue;
      if (/:$/.test(line)) continue;
      const { qty, unit, name } = parseQtyUnitName(line);
      if (!name || name.length < 2) continue;
      ingredients.push({ name, qty, unit });
    }
  }

  const steps: string[] = [];
  if (directionsBlock) {
    const raw = directionsBlock.trim();
    const numbered = raw.split(/\b\d+\.\s*/).map((s) => s.trim()).filter(Boolean);
    if (numbered.length >= 2) {
      for (const s of numbered) steps.push(s.replace(/\s+/g, " ").trim());
    } else {
      for (const line of tokenizeLines(raw)) {
        if (/^tips?\b/i.test(line)) continue;
        if (line.length < 6) continue;
        steps.push(line);
      }
    }
  }

  if (ingredients.length === 0 && steps.length === 0) return null;
  return {
    title,
    servings: 2,
    cookTime: 30,
    ingredients: ingredients.length ? ingredients : [{ name: "", qty: null, unit: "" }],
    steps: steps.length ? steps : [""],
  };
}

function explodeIngredientRuns(block: string): string {
  const s = block.replace(/\r/g, " ").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const matches = [...s.matchAll(/\b(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s+[A-Za-z]/g)];
  if (matches.length <= 1) return block;
  const parts: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]?.index ?? 0;
    const end = (matches[i + 1]?.index ?? s.length);
    const part = s.slice(start, end).trim();
    if (part) parts.push(part);
  }
  return parts.join("\n");
}

async function llmStructure(
  input: { titleHint: string | null; text: string }
): Promise<Omit<RecipeDraft, "source" | "image"> | null> {
  if (!env.OPENAI_API_KEY) return null;

  const schema = zodRecipeSchema();
  const prompt = [
    "Extract a cooking recipe from the provided text.",
    "Rules:",
    "- Use ONLY information that is explicitly present in the text. Do not invent ingredients or steps.",
    "- If the text does not contain a recipe (ingredients and/or steps), respond with: {\"ok\":false,\"reason\":\"...\"}.",
    "- Otherwise respond with: {\"ok\":true,\"recipe\":{...}} exactly in JSON.",
    "",
    `TITLE_HINT: ${input.titleHint ?? ""}`,
    "TEXT:",
    input.text,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: "You are a precise recipe extractor that outputs strict JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    }),
  });
  if (!res.ok) return null;
  const json: any = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Sometimes models wrap JSON in text; try a best-effort extraction.
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) return null;
  if (!validated.data.ok) return null;
  const recipe = validated.data.recipe;
  const normalized = {
    title: recipe.title.trim(),
    servings: recipe.servings ?? 2,
    cookTime: recipe.cookTime ?? 30,
    ingredients: recipe.ingredients.length ? recipe.ingredients : [{ name: "", qty: null, unit: "" }],
    steps: recipe.steps.length ? recipe.steps : [""],
  };
  return normalized;
}

function zodRecipeSchema() {
  return z.union([
    z.object({
      ok: z.literal(false),
      reason: z.string().min(1),
    }),
    z.object({
      ok: z.literal(true),
      recipe: z.object({
        title: z.string().min(1),
        servings: z.number().int().positive().nullable().optional(),
        cookTime: z.number().int().positive().nullable().optional(),
        ingredients: z
          .array(
            z.object({
              name: z.string().min(1),
              qty: z.number().nullable(),
              unit: z.string(),
            })
          )
          .default([]),
        steps: z.array(z.string().min(1)).default([]),
      }),
    }),
  ]);
}

export async function importRecipeFromUrl(rawUrl: string): Promise<RecipeDraft> {
  const url = normalizeUrl(rawUrl);
  const platform = detectPlatform(url);

  if (platform === "tiktok") {
    const meta = await fetchTikTokMeta(url);
    const titleHint = guessTitleFromText(meta.caption) ?? guessTitleFromText(meta.shareTitle ?? "") ?? null;

    const llm = await llmStructure({ titleHint, text: meta.caption });
    const heur = heuristicStructure(meta.caption, titleHint);
    const structured = llm ?? heur;
    if (!structured) throw new Error("Couldn't find the recipe in that post.");

    return {
      title: structured.title,
      image:
        meta.thumbnail ??
        "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop",
      servings: structured.servings,
      cookTime: structured.cookTime,
      ingredients: structured.ingredients,
      steps: structured.steps,
      source: { platform: "tiktok", url: meta.url, creator: meta.creator },
    };
  }

  // Basic support for other platforms: metadata → heuristic; LLM optional.
  const html = await fetchText(url);
  const meta = extractMeta(html);
  const text = [meta.title, meta.description].filter(Boolean).join("\n\n").trim();
  if (!text) throw new Error("Couldn't read that link.");
  const titleHint = meta.title ?? guessTitleFromText(text);
  const llm = await llmStructure({ titleHint: titleHint ?? null, text });
  const heur = heuristicStructure(text, titleHint ?? null);
  const structured = llm ?? heur;
  if (!structured) throw new Error("Couldn't find the recipe in that post.");

  return {
    title: structured.title,
    image:
      meta.image ??
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop",
    servings: structured.servings,
    cookTime: structured.cookTime,
    ingredients: structured.ingredients,
    steps: structured.steps,
    source: { platform, url, creator: null },
  };
}

