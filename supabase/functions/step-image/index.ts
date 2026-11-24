// step-image — draws one illustration for a cooking step and caches it in the public
// `step-images` Storage bucket, so each unique step is only ever generated once.
// Body: { title, step, index?, total?, ingredients?: string[] }  →  { url }
// Secrets: OPENAI_API_KEY (required), OPENAI_IMAGE_MODEL (optional).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { consumeUsage, gateUsage } from "../_shared/plus.ts";

const cors: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-hd-app-user-id",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...cors } });

const BUCKET = "step-images";

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function generate(prompt: string, key: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  const preferred = Deno.env.get("OPENAI_IMAGE_MODEL");
  const attempts: Record<string, unknown>[] = [
    ...(preferred ? [{ model: preferred }] : []),
    { model: "gpt-image-1-mini", quality: "low", size: "1536x1024", output_format: "jpeg", output_compression: 75 },
    { model: "gpt-image-1", quality: "low", size: "1536x1024", output_format: "jpeg", output_compression: 75 },
    { model: "dall-e-3", size: "1792x1024", response_format: "b64_json" },
  ];
  for (const a of attempts) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt, n: 1, ...a }),
    });
    if (!res.ok) {
      console.log("[step-image]", a.model, res.status, (await res.text().catch(() => "")).slice(0, 160));
      continue;
    }
    const j = await res.json().catch(() => null) as any;
    const b64 = j?.data?.[0]?.b64_json;
    if (typeof b64 === "string") return { bytes: b64ToBytes(b64), type: a.output_format === "jpeg" ? "image/jpeg" : "image/png" };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const key = Deno.env.get("OPENAI_API_KEY");
    const base = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key || !base || !service) return json({ error: "Not configured" }, 500);

    const body = await req.json().catch(() => null) as any;
    const title = String(body?.title ?? "").slice(0, 120).trim();
    const step = String(body?.step ?? "").slice(0, 500).trim();
    if (!title || !step) return json({ error: "Missing title or step" }, 400);
    const recipeId = typeof body?.recipeId === "string" ? body.recipeId : null;
    // Finished-dish photos (recipe covers) are free for everyone; only cooking-mode step pictures are Plus.
    const isCover = body?.cover === true || (!recipeId && /^the finished dish/i.test(step));
    if (!isCover) {
      const blocked = await gateUsage(req, "cook", { cors, recipeId });
      if (blocked) return blocked;
    }
    const ingredients = Array.isArray(body?.ingredients) ? body.ingredients.map(String).slice(0, 15).join(", ") : "";

    const path = `${await sha(`v2|${title}|${step}`)}.jpg`;
    const publicUrl = `${base}/storage/v1/object/public/${BUCKET}/${path}`;
    const head = await fetch(publicUrl, { method: "HEAD" }).catch(() => null);
    if (head?.ok) { if (!isCover) await consumeUsage(req, "cook", { recipeId }); return json({ url: publicUrl, cached: true }); }

    const prompt =
      `Warm, natural-light cookbook photograph of a home cook doing this step of "${title}": ${step}. ` +
      `Show the pan, bowl or board and the food at exactly this stage, close-up, from a slightly overhead angle. ` +
      (ingredients ? `Ingredients in this recipe: ${ingredients}. ` : "") +
      `Cozy home kitchen, cream and wood tones. No text, no labels, no logos, no faces.`;
    const img = await generate(prompt, key);
    if (!img) return json({ error: "Couldn't draw this step" }, 502);

    const up = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${service}`, "content-type": img.type, "x-upsert": "true", "cache-control": "31536000" },
      body: img.bytes,
    });
    if (!up.ok) {
      console.log("[step-image] upload", up.status, (await up.text().catch(() => "")).slice(0, 160));
      return json({ error: "Couldn't save the image" }, 502);
    }
    if (!isCover) await consumeUsage(req, "cook", { recipeId });
    return json({ url: publicUrl, cached: false });
  } catch (e) {
    console.log("[step-image] error", String(e));
    return json({ error: "Failed" }, 500);
  }
});
