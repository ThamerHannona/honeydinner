const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop";

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with",
  "access-control-allow-methods": "POST, OPTIONS",
};

type SourcePlatform = "tiktok" | "instagram" | "facebook" | "snapchat" | "web" | "photo";

type Ingredient = { name: string; qty: number | null; unit: string };

type RecipeDraft = {
  title: string;
  image: string;
  servings: number;
  cookTime: number;
  ingredients: Ingredient[];
  steps: string[];
  source: { platform: SourcePlatform; url: string | null; creator: string | null };
};

type TikTokMeta = {
  url: string;
  caption: string;
  creator: string | null;
  thumbnail: string | null;
  mediaUrl: string | null;
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

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
  if (/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/.test(host)) return "facebook";
  if (/(^|\.)snapchat\.com$/.test(host)) return "snapchat";
  return "web";
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch post (HTTP ${res.status}).`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function extractTikTokUniversalData(html: string): any {
  const m = html.match(
    /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m?.[1]) throw new Error("Couldn't read this TikTok post (missing data block).");
  try {
    return JSON.parse(m[1]);
  } catch {
    throw new Error("Couldn't read this TikTok post (invalid data block).");
  }
}

function pickTikTokMediaUrl(itemStruct: any): string | null {
  const v = itemStruct?.video;
  if (!v) return null;
  const candidates: unknown[] = [
    v?.downloadAddr,
    v?.playAddr,
    v?.playAddrH264,
    v?.playAddrBytevc1,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
    if (c && typeof c === "object") {
      const urlList = (c as any).urlList;
      if (Array.isArray(urlList) && typeof urlList[0] === "string") return urlList[0];
    }
  }
  return null;
}

async function fetchTikTokMeta(url: string): Promise<TikTokMeta> {
  const html = await fetchText(url, 12_000);
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
  const mediaUrl = pickTikTokMediaUrl(item);

  return {
    url,
    caption: caption.trim(),
    creator,
    thumbnail: thumbnail ?? null,
    mediaUrl,
  };
}

async function downloadCapped(url: string, maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        referer: "https://www.tiktok.com/",
      },
    }).catch(() => null);
    const lenStr = head?.headers?.get("content-length");
    if (lenStr) {
      const len = Number(lenStr);
      if (Number.isFinite(len) && len > maxBytes) throw new Error("Media too large to transcribe.");
    }

    const res = await fetch(url, {
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        referer: "https://www.tiktok.com/",
      },
    });
    if (!res.ok) throw new Error(`Media download failed (HTTP ${res.status}).`);

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new Error("Media too large to transcribe.");
    return buf;
  } finally {
    clearTimeout(t);
  }
}

async function transcribeWithOpenAI(audioBytes: Uint8Array, filename: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY secret.");
  const model = Deno.env.get("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe";

  const form = new FormData();
  form.set("model", model);
  form.set("file", new File([audioBytes], filename, { type: "video/mp4" }));

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Transcription failed (HTTP ${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const json = await res.json().catch(() => null) as any;
  const transcript = typeof json?.text === "string" ? json.text.trim() : "";
  return transcript;
}

function guessTitleFromText(text: string): string | null {
  const firstHashtag = text.trim().match(/^#([A-Za-z][A-Za-z0-9_-]+)/);
  if (firstHashtag?.[1]) {
    const raw = firstHashtag[1].replace(/_/g, " ");
    const spaced = raw.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    if (spaced.length >= 4) return spaced;
  }

  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!cleaned) return null;
  const stopIdx = cleaned.search(/\b(ingredients|directions|instructions|recipe)\b/i);
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

function tokenizeLines(block: string): string[] {
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

function parseFractional(s: string): number | null {
  const t = s.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
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

function parseQtyUnitName(line: string): { qty: number | null; unit: string; name: string } {
  const original = line.trim();
  const m = original.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s+([a-zA-Z]+\.?)\s+(.+)$/,
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

function heuristicStructure(
  text: string,
  titleHint: string | null,
): { title: string; servings: number; cookTime: number; ingredients: Ingredient[]; steps: string[] } | null {
  const ingredientsMatch = text.match(/\b(ingredients?|recipe)\b\s*[:\-]?\s*/i);
  const directionsMatch = text.match(/\b(directions?|instructions?|method|steps)\b\s*[:\-]?\s*/i);

  let title = titleHint ?? guessTitleFromText(text) ?? "Recipe";
  title = title.replace(/\s+/g, " ").trim();

  const ingredientsBlock =
    ingredientsMatch && ingredientsMatch.index != null
      ? text.slice(
        ingredientsMatch.index + ingredientsMatch[0].length,
        directionsMatch && directionsMatch.index != null && directionsMatch.index > ingredientsMatch.index
          ? directionsMatch.index
          : text.length,
      )
      : null;
  const directionsBlock =
    directionsMatch && directionsMatch.index != null ? text.slice(directionsMatch.index + directionsMatch[0].length) : null;

  const ingredients: Ingredient[] = [];
  if (ingredientsBlock) {
    const exploded = explodeIngredientRuns(ingredientsBlock);
    for (const line of tokenizeLines(exploded)) {
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

async function extractRecipeWithOpenAI(input: {
  url: string;
  platform: SourcePlatform;
  creator: string | null;
  thumbnail: string | null;
  caption: string;
  transcript: string | null;
}): Promise<RecipeDraft> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY secret.");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

  const titleHint = guessTitleFromText(input.caption) ?? null;
  const prompt = [
    "Extract a cooking recipe from the provided post content.",
    "",
    "Hard rules:",
    "- Use ONLY information explicitly present in the caption/transcript. Do not invent any ingredients or steps.",
    "- If the recipe cannot be determined (no clear ingredients and no clear steps), respond with JSON: {\"ok\":false,\"reason\":\"...\"}.",
    "- Otherwise respond with JSON: {\"ok\":true,\"recipe\":{...}}.",
    "",
    "Recipe JSON shape:",
    "{",
    "  title: string,",
    "  servings: number | null,",
    "  cookTime: number | null,",
    "  ingredients: Array<{ name: string, qty: number | null, unit: string }>,",
    "  steps: string[]",
    "}",
    "",
    `URL: ${input.url}`,
    `PLATFORM: ${input.platform}`,
    `CREATOR: ${input.creator ?? ""}`,
    `TITLE_HINT: ${titleHint ?? ""}`,
    "",
    "CAPTION:",
    input.caption,
    "",
    "TRANSCRIPT:",
    input.transcript ?? "",
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: "You extract recipes and output strict JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM extraction failed (HTTP ${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
  }

  const raw = await res.json().catch(() => null) as any;
  const content = raw?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("LLM extraction failed (empty response).");

  const parsed = safeJsonParse(content);
  if (!parsed) throw new Error("LLM extraction failed (invalid JSON).");
  if (parsed.ok === false) throw new Error("Couldn't find the recipe in that post.");
  const recipe = parsed.recipe;
  if (!recipe || typeof recipe.title !== "string") throw new Error("LLM extraction failed (invalid recipe).");

  const ingredients: Ingredient[] = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
      .filter((i: any) => i && typeof i.name === "string")
      .map((i: any) => ({ name: String(i.name), qty: typeof i.qty === "number" ? i.qty : null, unit: typeof i.unit === "string" ? i.unit : "" }))
    : [];
  const steps: string[] = Array.isArray(recipe.steps) ? recipe.steps.filter((s: any) => typeof s === "string" && s.trim()).map((s: string) => s.trim()) : [];

  const title = recipe.title.trim();
  if (!title) throw new Error("Couldn't find the recipe in that post.");
  if (ingredients.length === 0 && steps.length === 0) throw new Error("Couldn't find the recipe in that post.");

  return {
    title,
    image: input.thumbnail ?? DEFAULT_IMAGE,
    servings: typeof recipe.servings === "number" && Number.isFinite(recipe.servings) ? recipe.servings : 2,
    cookTime: typeof recipe.cookTime === "number" && Number.isFinite(recipe.cookTime) ? recipe.cookTime : 30,
    ingredients: ingredients.length ? ingredients : [{ name: "", qty: null, unit: "" }],
    steps: steps.length ? steps : [""],
    source: { platform: input.platform, url: input.url, creator: input.creator },
  };
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    if (!Deno.env.get("OPENAI_API_KEY")) {
      return json({ error: "Server is not configured for recipe import." }, { status: 500 });
    }

    const body = await req.json().catch(() => null) as any;
    const rawUrl = typeof body?.url === "string" ? body.url : "";
    const url = normalizeUrl(rawUrl);
    const platform = detectPlatform(url);

    if (platform !== "tiktok") {
      return json({ error: "Only TikTok URLs are supported right now." }, { status: 422 });
    }

    const meta = await fetchTikTokMeta(url);

    // Best-effort transcription (size/time capped). If media fetch fails, fall back to caption-only.
    const maxBytes = Number(Deno.env.get("MAX_TIKTOK_MEDIA_BYTES") ?? "20000000"); // 20MB
    let transcript: string | null = null;
    if (meta.mediaUrl) {
      try {
        const bytes = await downloadCapped(meta.mediaUrl, maxBytes, 18_000);
        transcript = await transcribeWithOpenAI(bytes, "tiktok.mp4");
      } catch {
        transcript = null;
      }
    }

    // Primary: LLM combines caption + transcript (strict no-invention).
    // Fallback: deterministic caption parser (still no invention, but less capable).
    let recipe: RecipeDraft | null = null;
    try {
      recipe = await extractRecipeWithOpenAI({
        url,
        platform: "tiktok",
        creator: meta.creator,
        thumbnail: meta.thumbnail,
        caption: meta.caption,
        transcript,
      });
    } catch {
      recipe = null;
    }

    if (!recipe) {
      const titleHint = guessTitleFromText(meta.caption) ?? null;
      const heur = heuristicStructure(meta.caption, titleHint);
      if (!heur) throw new Error("Couldn't find the recipe in that post.");
      recipe = {
        title: heur.title,
        image: meta.thumbnail ?? DEFAULT_IMAGE,
        servings: heur.servings,
        cookTime: heur.cookTime,
        ingredients: heur.ingredients,
        steps: heur.steps,
        source: { platform: "tiktok", url, creator: meta.creator },
      };
    }

    return json({ recipe }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return json({ error: message }, { status: 422 });
  }
});

