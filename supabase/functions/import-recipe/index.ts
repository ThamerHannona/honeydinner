// import-recipe — turns a shared TikTok / Instagram / Facebook / web link into a
// clean, step-by-step recipe for Honey, Dinner?
//
// How it reads a post (best effort, in order):
//   1. Post details: caption, creator, cover image, video link (TikTok page → tikwm → oEmbed;
//      other sites → schema.org Recipe JSON-LD → Open Graph tags).
//   2. The video itself:
//        - GEMINI_API_KEY set → Gemini watches the video (voice-over AND on-screen text).
//        - otherwise          → OpenAI transcribes the audio and reads the cover image.
//   3. OpenAI (or Gemini) writes the final recipe. When the post names the dish but leaves out
//      amounts or steps, it fills in a classic home-cook version and flags it, so the user
//      always gets real steps — never hashtags as ingredients.
//
// Secrets: OPENAI_API_KEY (required), GEMINI_API_KEY (optional, recommended),
//          OPENAI_MODEL, OPENAI_TRANSCRIBE_MODEL, GEMINI_MODEL, MAX_VIDEO_BYTES (optional).

import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { consumeUsage, gateUsage } from "../_shared/plus.ts";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ESTIMATED_NOTE =
  "The post didn't spell everything out, so FridgeGenie filled in amounts and steps for a classic version. Tweak anything below.";

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-requested-with, x-hd-app-user-id",
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
  note?: string;
};
type PostInfo = {
  url: string;
  platform: SourcePlatform;
  caption: string;
  creator: string | null;
  thumbnail: string | null;
  videoUrls: string[];
  structured: string | null; // schema.org Recipe JSON, when the site provides one
};
type Extracted = {
  title: string;
  servings: number | null;
  cookTime: number | null;
  ingredients: Ingredient[];
  steps: string[];
  estimated: boolean;
};

class UserFacingError extends Error {}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });

const log = (...a: unknown[]) => console.log("[import-recipe]", ...a);

// ───────────────────────── URL helpers ─────────────────────────

function normalizeUrl(raw: string): string {
  const m = raw.match(/https?:\/\/[^\s]+/i);
  const trimmed = (m ? m[0] : raw).trim();
  if (!trimmed) throw new UserFacingError("Missing link.");
  const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  u.hash = "";
  return u.toString();
}

function detectPlatform(url: string): SourcePlatform {
  const host = new URL(url).hostname.toLowerCase();
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)(instagram\.com|instagr\.am)$/.test(host)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/.test(host)) return "facebook";
  if (/(^|\.)snapchat\.com$/.test(host)) return "snapchat";
  return "web";
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12_000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...init,
      signal: ac.signal,
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

async function getText(url: string, ms = 12_000): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetchWithTimeout(url, {}, ms);
    if (!res.ok) return null;
    return { html: await res.text(), finalUrl: res.url || url };
  } catch {
    return null;
  }
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ""; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ""; } })
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, ""); // invisible LTR/RTL marks

function metaTag(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  );
  const m = html.match(re);
  const v = m?.[1] ?? m?.[2];
  return v ? decodeEntities(v).trim() : null;
}

// ───────────────────────── Post details ─────────────────────────

async function tiktokFromPage(url: string, info: PostInfo) {
  const page = await getText(url);
  if (!page) return;
  info.url = page.finalUrl.split("?")[0] || info.url;
  const m = page.html.match(/<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m?.[1]) return;
  try {
    const item = JSON.parse(m[1])?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
    if (!item) return;
    if (item.desc && !info.caption) info.caption = String(item.desc);
    if (item.author?.uniqueId && !info.creator) info.creator = `@${item.author.uniqueId}`;
    const v = item.video ?? {};
    if (!info.thumbnail) info.thumbnail = v.cover ?? v.originCover ?? v.dynamicCover ?? null;
    for (const c of [v.playAddr, v.downloadAddr, v.playAddrH264]) {
      if (typeof c === "string" && c.startsWith("http")) info.videoUrls.push(c);
      else if (Array.isArray(c?.urlList) && typeof c.urlList[0] === "string") info.videoUrls.push(c.urlList[0]);
    }
  } catch { /* ignore */ }
}

async function tiktokFromTikwm(url: string, info: PostInfo) {
  try {
    const res = await fetchWithTimeout(`https://www.tikwm.com/api/?hd=0&url=${encodeURIComponent(url)}`, {}, 12_000);
    if (!res.ok) return;
    const j = await res.json().catch(() => null) as any;
    const d = j?.code === 0 ? j.data : null;
    if (!d) return;
    const abs = (p: unknown) => (typeof p === "string" && p ? (p.startsWith("http") ? p : `https://www.tikwm.com${p}`) : null);
    if (d.title && !info.caption) info.caption = String(d.title);
    if (d.author?.unique_id && !info.creator) info.creator = `@${d.author.unique_id}`;
    if (!info.thumbnail) info.thumbnail = abs(d.origin_cover) ?? abs(d.cover);
    const play = abs(d.play) ?? abs(d.wmplay);
    if (play) info.videoUrls.unshift(play); // tikwm links download reliably from servers
  } catch { /* ignore */ }
}

async function tiktokFromOembed(url: string, info: PostInfo) {
  try {
    const res = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {}, 8_000);
    if (!res.ok) return;
    const j = await res.json().catch(() => null) as any;
    if (j?.title && !info.caption) info.caption = String(j.title);
    if (j?.author_unique_id && !info.creator) info.creator = `@${j.author_unique_id}`;
    if (j?.thumbnail_url && !info.thumbnail) info.thumbnail = String(j.thumbnail_url);
  } catch { /* ignore */ }
}

function findRecipeJsonLd(html: string): any | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const visit = (node: any): any | null => {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const n of node) { const r = visit(n); if (r) return r; }
      return null;
    }
    const t = node["@type"];
    if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
    return visit(node["@graph"]) ?? null;
  };
  for (const b of blocks) {
    try { const r = visit(JSON.parse(b[1].trim())); if (r) return r; } catch { /* ignore */ }
  }
  return null;
}

async function genericFromPage(url: string, info: PostInfo) {
  const page = await getText(url);
  if (!page) return;
  const { html } = page;
  const recipe = findRecipeJsonLd(html);
  if (recipe) {
    info.structured = JSON.stringify({
      name: recipe.name,
      recipeYield: recipe.recipeYield,
      totalTime: recipe.totalTime ?? recipe.cookTime,
      recipeIngredient: recipe.recipeIngredient,
      recipeInstructions: recipe.recipeInstructions,
    }).slice(0, 12_000);
    const img = Array.isArray(recipe.image) ? recipe.image[0] : recipe.image;
    if (!info.thumbnail) info.thumbnail = typeof img === "string" ? img : img?.url ?? null;
    if (!info.caption) info.caption = String(recipe.name ?? "");
  }
  const desc = [metaTag(html, "og:title"), metaTag(html, "og:description") ?? metaTag(html, "description")]
    .filter(Boolean).join(" — ");
  if (desc && !info.caption) info.caption = desc;
  else if (desc && info.caption.length < 40) info.caption = `${info.caption} — ${desc}`;
  if (!info.thumbnail) info.thumbnail = metaTag(html, "og:image");
  const vid = metaTag(html, "og:video:secure_url") ?? metaTag(html, "og:video:url") ?? metaTag(html, "og:video");
  if (vid?.startsWith("http")) info.videoUrls.push(vid);
}

/** Instagram's public embed page carries the full caption (og:description is cut short). */
async function instagramFromEmbed(url: string, info: PostInfo) {
  const m = url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!m) return;
  const page = await getText(`https://www.instagram.com/p/${m[1]}/embed/captioned/`, 10_000);
  if (!page) return;
  const cap = page.html.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i)?.[1]
    ?? page.html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1];
  if (cap) {
    const text = decodeEntities(cap.replace(/<br\s*\/?>/gi, "\n").replace(/<a [^>]*class="CaptionUsername"[^>]*>[\s\S]*?<\/a>/i, "").replace(/<[^>]+>/g, " "))
      .replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();
    if (text.length > info.caption.length) info.caption = text;
  }
  const vid = page.html.match(/\\?"video_url\\?":\s*\\?"([^"\\]+(?:\\\/[^"\\]+)*)/)?.[1];
  if (vid) info.videoUrls.push(vid.replace(/\\\//g, "/").replace(/\\u0026/g, "&"));
  if (!info.creator) {
    const u = page.html.match(/class="UsernameText"[^>]*>([^<]+)</i)?.[1];
    if (u) info.creator = `@${u.trim()}`;
  }
}

async function getPostInfo(url: string): Promise<PostInfo> {
  const platform = detectPlatform(url);
  const info: PostInfo = { url, platform, caption: "", creator: null, thumbnail: null, videoUrls: [], structured: null };
  if (platform === "tiktok") {
    await tiktokFromPage(url, info);
    await tiktokFromTikwm(info.url, info);
    if (!info.caption || !info.thumbnail) await tiktokFromOembed(info.url, info);
  } else {
    await genericFromPage(url, info);
    if (platform === "instagram") await instagramFromEmbed(url, info);
  }
  info.caption = info.caption.trim().slice(0, 4_000);
  info.videoUrls = [...new Set(info.videoUrls)];
  return info;
}

// ───────────────────────── Video ─────────────────────────

async function downloadVideo(urls: string[], maxBytes: number): Promise<Uint8Array | null> {
  for (const u of urls) {
    try {
      const res = await fetchWithTimeout(u, { headers: { referer: "https://www.tiktok.com/" } }, 25_000);
      if (!res.ok) { log("video http", res.status); continue; }
      const len = Number(res.headers.get("content-length") ?? "0");
      if (len && len > maxBytes) { log("video too large", len); continue; }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > 50_000 && buf.byteLength <= maxBytes) return buf;
    } catch (e) {
      log("video fetch failed", String(e));
    }
  }
  return null;
}

async function transcribe(bytes: Uint8Array): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const form = new FormData();
    form.set("model", Deno.env.get("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe");
    form.set("file", new File([bytes], "video.mp4", { type: "video/mp4" }));
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) { log("transcribe http", res.status); return null; }
    const j = await res.json().catch(() => null) as any;
    const text = typeof j?.text === "string" ? j.text.trim() : "";
    return text || null;
  } catch {
    return null;
  }
}

// ───────────────────────── Recipe writing ─────────────────────────

const RECIPE_RULES = `
You turn a food post (a short cooking video, its caption, or a recipe web page) into a clean recipe a home cook can follow.

Return ONLY JSON:
{"ok":true,"recipe":{"title":string,"servings":number|null,"cookTime":number|null,"ingredients":[{"name":string,"qty":number|null,"unit":string}],"steps":[string],"estimated":boolean}}
or {"ok":false,"reason":string} ONLY if the post is clearly not about food at all.

Rules:
- Use everything the post actually says or shows first: spoken words, on-screen text, caption, recipe card.
- If the post names or shows a dish but leaves out amounts, ingredients or steps, fill the gaps with a classic, reliable home-cook version of THAT dish, consistent with what is shown, and set "estimated": true. Never return an empty ingredient list or empty steps.
- Title: the dish name (Title Case for Latin-script languages). No hashtags, emoji, @handles, bullets or "recipe"/"easy" filler.
- Ingredients: real foods only. Never hashtags, usernames or words like "cooking" or "foodie". qty is a number (0.5 not "1/2") or null; unit is short (g, kg, ml, cup, tbsp, tsp, oz, lb, clove, can, pinch) or "" for whole items.
- Steps: 4–10 short imperative steps, one action each, with times and heat where relevant ("Cook 5 min over medium-high heat").
- cookTime: total minutes. servings: number of people.
- The post may be in any language — Arabic (any dialect: Gulf, Levantine, Egyptian, Iraqi, Maghrebi), Spanish, or others, sometimes mixed with English. Read and understand all of it; Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) are numbers.`;

const LANGUAGE: Record<string, string> = {
  en: "Write the title, ingredient names and steps in English (translate if the post is in another language). Keep well-known dish names recognisable (e.g. 'Maqluba (Upside-Down Rice)').",
  ar: "Write the title, ingredient names and steps in clear, simple Arabic (Modern Standard Arabic as used in home recipes). Keep units as short Latin abbreviations (g, kg, ml, cup, tbsp, tsp) and quantities as numbers.",
  es: "Write the title, ingredient names and steps in Spanish (neutral Latin-American Spanish). Keep units as short abbreviations (g, kg, ml, cup, tbsp, tsp) and quantities as numbers.",
  original: "Write the title, ingredient names and steps in the same language the post uses (if it mixes languages, use the main one). Keep units as short Latin abbreviations and quantities as numbers.",
};
const rules = (lang: string) => `${RECIPE_RULES}\n- Language: ${LANGUAGE[lang] ?? LANGUAGE.en}`;

function sanitize(raw: any): Extracted | null {
  const r = raw?.recipe ?? raw;
  if (!r || typeof r !== "object") return null;
  const clean = (s: string) => s.replace(/[#@][\p{L}\p{N}_.]+/gu, "").replace(/[•·|]+/g, " ").replace(/\s+/g, " ").trim();
  const title = clean(String(r.title ?? "")).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "");
  const ingredients: Ingredient[] = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .map((i: any) => {
      let qty = typeof i?.qty === "number" && Number.isFinite(i.qty) ? i.qty : null;
      let unit = typeof i?.unit === "string" ? i.unit.trim() : "";
      // Models sometimes put the amount in the unit ("3/4 cup", "1 1/2 tbsp") — move it into qty.
      const m = unit.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/);
      if (m) {
        const [w, f] = m[1].includes(" ") ? m[1].split(/\s+/) : ["0", m[1]];
        const frac = (s: string) => (s.includes("/") ? Number(s.split("/")[0]) / Number(s.split("/")[1]) : Number(s));
        const n = Number(w) + frac(f);
        if (Number.isFinite(n) && n > 0) { qty = Math.round(n * 100) / 100; unit = m[2].trim(); }
      }
      return { name: clean(String(i?.name ?? "")), qty, unit };
    })
    .filter((i: Ingredient) => i.name.length > 1 && !/^(cooking|foodie|recipe|food|fyp|viral)$/i.test(i.name));
  const steps: string[] = (Array.isArray(r.steps) ? r.steps : [])
    .map((s: any) => clean(String(s ?? "")).replace(/^\d+[.)]\s*/, ""))
    .filter((s: string) => s.length > 3);
  if (!title || ingredients.length === 0 || steps.length === 0) return null;
  return {
    title,
    servings: typeof r.servings === "number" && r.servings > 0 ? Math.round(r.servings) : null,
    cookTime: typeof r.cookTime === "number" && r.cookTime > 0 ? Math.round(r.cookTime) : null,
    ingredients,
    steps,
    estimated: r.estimated === true,
  };
}

function parseJson(s: string): any | null {
  try { return JSON.parse(s); } catch { /* fall through */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function describePost(info: PostInfo, transcript: string | null): string {
  return [
    `LINK: ${info.url}`,
    `PLATFORM: ${info.platform}`,
    `CREATOR: ${info.creator ?? "unknown"}`,
    "",
    "CAPTION / PAGE TEXT:",
    info.caption || "(none)",
    info.structured ? `\nRECIPE DATA FROM THE PAGE (schema.org):\n${info.structured}` : "",
    transcript ? `\nSPOKEN IN THE VIDEO (transcript):\n${transcript.slice(0, 6_000)}` : "",
  ].join("\n");
}

async function withGemini(info: PostInfo, video: Uint8Array, lang: string): Promise<Extracted | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { inline_data: { mime_type: "video/mp4", data: encodeBase64(video) } },
              {
                text: `${rules(lang)}\n\nWatch the whole video. Read every on-screen text overlay and listen to the voice-over; ` +
                  `also look at what is added to the pan or bowl.\n\n${describePost(info, null)}`,
              },
            ],
          }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) { log("gemini http", res.status, (await res.text().catch(() => "")).slice(0, 200)); return null; }
    const j = await res.json().catch(() => null) as any;
    const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    const parsed = parseJson(text);
    if (parsed?.ok === false) throw new UserFacingError("That post doesn't look like a recipe.");
    return sanitize(parsed);
  } catch (e) {
    if (e instanceof UserFacingError) throw e;
    log("gemini failed", String(e));
    return null;
  }
}

async function imageAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetchWithTimeout(url, { headers: { referer: "https://www.instagram.com/" } }, 8_000);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(type)) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1000 || buf.byteLength > 4_000_000) return null;
    return `data:${type};base64,${encodeBase64(buf)}`;
  } catch {
    return null;
  }
}

/** TikTok/IG cover links are signed and expire within days; keep our own copy in Storage. */
async function persistCover(url: string | null): Promise<string | null> {
  if (!url) return null;
  const base = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !service || url.startsWith(base)) return url;
  try {
    const res = await fetchWithTimeout(url, { headers: { referer: "https://www.instagram.com/" } }, 10_000);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!/^image\//i.test(type)) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `covers/${hash}.${ext}`;
    const up = await fetch(`${base}/storage/v1/object/step-images/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${service}`, "content-type": type, "x-upsert": "true", "cache-control": "31536000" },
      body: buf,
    });
    if (!up.ok) { log("cover upload", up.status); return url; }
    return `${base}/storage/v1/object/public/step-images/${path}`;
  } catch (e) {
    log("cover persist failed", String(e));
    return url;
  }
}

async function withOpenAI(info: PostInfo, transcript: string | null, lang: string): Promise<Extracted | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  const cover = await imageAsDataUrl(info.thumbnail);
  const ask = async (withImage: boolean) => {
    const content: any[] = [{ type: "text", text: `${describePost(info, transcript)}\n\nThe image (if any) is the video's cover frame — read any text on it.` }];
    if (withImage && (cover ?? info.thumbnail)) content.push({ type: "image_url", image_url: { url: cover ?? info.thumbnail, detail: cover ? "high" : "low" } });
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: rules(lang) }, { role: "user", content }],
      }),
    });
    if (!res.ok) { log("openai http", res.status, (await res.text().catch(() => "")).slice(0, 200)); return null; }
    const j = await res.json().catch(() => null) as any;
    return parseJson(j?.choices?.[0]?.message?.content ?? "");
  };
  let parsed = await ask(true).catch(() => null);
  if (!parsed) parsed = await ask(false).catch(() => null); // cover image unreachable → text only
  if (parsed?.ok === false) throw new UserFacingError("That post doesn't look like a recipe.");
  return sanitize(parsed);
}


function dataUrlFromBody(image: unknown): string | null {
  const raw = typeof image === "string" ? image.trim() : "";
  if (!raw) return null;
  if (/^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,/i.test(raw)) return raw;
  const compact = raw.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(compact) || compact.length < 80) return null;
  const mime = compact.startsWith("/9j/") ? "image/jpeg" : compact.startsWith("iVBOR") ? "image/png" : compact.startsWith("UklGR") ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${compact}`;
}

async function persistDataUrlCover(dataUrl: string): Promise<string | null> {
  const base = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !service) return null;
  try {
    const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/i);
    if (!m) return null;
    const type = m[1];
    const raw = m[2].replace(/\s+/g, "");
    const bin = atob(raw);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    if (buf.byteLength < 100) return null;
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `covers/${hash}.${ext}`;
    const up = await fetch(`${base}/storage/v1/object/step-images/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${service}`, "content-type": type, "x-upsert": "true", "cache-control": "31536000" },
      body: buf,
    });
    if (!up.ok) { log("cover upload", up.status); return null; }
    return `${base}/storage/v1/object/public/step-images/${path}`;
  } catch (e) {
    log("cover persist failed", String(e));
    return null;
  }
}

async function fromPhoto(dataUrl: string, lang: string): Promise<Extracted | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: rules(lang) },
        { role: "user", content: [
          { type: "text", text: "This is a photo of a cookbook page, handwritten recipe, or a screenshot of a recipe. Read all visible text and write a clean recipe. If amounts or steps are incomplete, fill in a classic home-cook version of that dish and set estimated: true." },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ] },
      ],
    }),
  });
  if (!res.ok) { log("openai photo http", res.status, (await res.text().catch(() => "")).slice(0, 200)); return null; }
  const j = await res.json().catch(() => null) as any;
  const parsed = parseJson(j?.choices?.[0]?.message?.content ?? "");
  if (parsed?.ok === false) throw new UserFacingError("That photo doesn't look like a recipe.");
  return sanitize(parsed);
}

// ───────────────────────── Handler ─────────────────────────

// ---- Cache: a post we've already read comes back instantly (used when the
// share panel hands a recipe to the app, and for re-shares). ----
const CACHE_TABLE = "hd_recipe_imports";
function cacheHeaders(): Record<string, string> | null {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key || !Deno.env.get("SUPABASE_URL")) return null;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
async function cacheGet(url: string): Promise<{ recipe: unknown; method: string } | null> {
  const h = cacheHeaders();
  if (!h) return null;
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${CACHE_TABLE}?select=recipe,method&url=eq.${encodeURIComponent(url)}&limit=1`, { headers: h });
    if (!r.ok) return null;
    const rows = await r.json() as { recipe: unknown; method: string | null }[];
    return rows[0] ? { recipe: rows[0].recipe, method: `cache:${rows[0].method ?? ""}` } : null;
  } catch {
    return null;
  }
}
async function cachePut(urls: string[], recipe: unknown, method: string) {
  const h = cacheHeaders();
  if (!h) return;
  try {
    const rows = [...new Set(urls.filter(Boolean))].map((url) => ({ url, recipe, method }));
    await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${CACHE_TABLE}?on_conflict=url`, {
      method: "POST",
      headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
  } catch (e) {
    log("cache put failed", String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!Deno.env.get("OPENAI_API_KEY") && !Deno.env.get("GEMINI_API_KEY")) {
      return json({ error: "Server is not configured for recipe import." }, 500);
    }
    const body = await req.json().catch(() => null) as any;
    const blocked = await gateUsage(req, "import", { cors: corsHeaders });
    if (blocked) return blocked;
    const photo = dataUrlFromBody(body?.image);
    const LANG: string = ["en", "ar", "es", "original"].includes(body?.lang) ? body.lang : "en";
    if (photo) {
      const recipe = await fromPhoto(photo, LANG);
      if (!recipe) throw new UserFacingError("Couldn't find the recipe in that photo.");
      const cover = (await persistDataUrlCover(photo)) ?? DEFAULT_IMAGE;
      const draft: RecipeDraft = {
        title: recipe.title,
        image: cover,
        servings: recipe.servings ?? 2,
        cookTime: recipe.cookTime ?? 30,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        source: { platform: "photo", url: null, creator: null },
        ...(recipe.estimated ? { note: ESTIMATED_NOTE } : {}),
      };
      log("done", "photo", LANG, recipe.title);
      await consumeUsage(req, "import");
      return json({ recipe: draft, method: "openai-photo" });
    }
    const url = normalizeUrl(typeof body?.url === "string" ? body.url : "");
    const cacheKey = LANG === "en" ? url : `${url}#lang=${LANG}`;

    const cached = body?.fresh ? null : await cacheGet(cacheKey);
    if (cached) {
      log("cache hit", url);
      const rec = cached.recipe as RecipeDraft;
      if (rec?.image && !rec.image.includes('/storage/v1/object/public/')) {
        const kept = await persistCover(rec.image);
        if (kept && kept !== rec.image) {
          rec.image = kept;
          await cachePut([cacheKey], rec, cached.method).catch(() => {});
        }
      }
      await consumeUsage(req, "import");
      return json({ recipe: rec, method: cached.method });
    }

    const info = await getPostInfo(url);
    log("post", info.platform, { caption: info.caption.slice(0, 80), videos: info.videoUrls.length, structured: !!info.structured });
    if (!info.caption && !info.videoUrls.length && !info.structured) {
      throw new UserFacingError("Couldn't open that post. It may be private.");
    }

    const maxBytes = Number(Deno.env.get("MAX_VIDEO_BYTES") ?? "24000000");
    const needVideo = !info.structured; // a site's recipe card beats any video
    const video = needVideo && info.videoUrls.length ? await downloadVideo(info.videoUrls, maxBytes) : null;
    log("video bytes", video?.byteLength ?? 0);

    let recipe: Extracted | null = null;
    let method = "";
    if (video) {
      recipe = await withGemini(info, video, LANG);
      if (recipe) method = "gemini-video";
    }
    if (!recipe) {
      const transcript = video ? await transcribe(video) : null;
      recipe = await withOpenAI(info, transcript, LANG);
      if (recipe) method = transcript ? "openai-transcript" : "openai-caption";
    }
    if (!recipe) throw new UserFacingError("Couldn't find the recipe in that post.");
    log("done", method, LANG, recipe.title, { ingredients: recipe.ingredients.length, steps: recipe.steps.length, estimated: recipe.estimated });

    const draft: RecipeDraft = {
      title: recipe.title,
      image: (await persistCover(info.thumbnail)) ?? DEFAULT_IMAGE,
      servings: recipe.servings ?? 2,
      cookTime: recipe.cookTime ?? 30,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      source: { platform: info.platform, url: info.url, creator: info.creator },
      ...(recipe.estimated ? { note: ESTIMATED_NOTE } : {}),
    };
    await cachePut(LANG === "en" ? [url, info.url] : [cacheKey, `${info.url}#lang=${LANG}`], draft, method);
    await consumeUsage(req, "import");
    return json({ recipe: draft, method });
  } catch (e) {
    const message = e instanceof UserFacingError ? e.message : "Import failed";
    log("error", String(e));
    return json({ error: message }, 422);
  }
});
