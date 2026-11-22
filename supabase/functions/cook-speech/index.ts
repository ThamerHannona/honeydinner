// cook-speech — turns a cooking-step line into a warm spoken voice and caches
// the MP3 in the public `cook-speech` Storage bucket.
// Body: { text, voice?: "coral" | "nova" | "shimmer", speed?: number }  →  { url, cached }
// Secrets: OPENAI_API_KEY (required). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are provided by the edge runtime automatically.

import { consumeUsage, gateUsage } from "../_shared/plus.ts";

const cors: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-hd-app-user-id",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...cors } });

const BUCKET = "cook-speech";
const VOICES = new Set(["coral", "nova", "shimmer", "alloy", "echo", "fable", "onyx", "sage"]);
const INSTRUCTIONS =
  "Speak warmly and naturally, like a calm friend talking you through a recipe in a cozy kitchen. " +
  "Keep a normal, slightly brisk pace — clear and encouraging, not slow or dreamy.";

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

async function speak(text: string, voice: string, speed: number, key: string): Promise<Uint8Array | null> {
  const attempts: Record<string, unknown>[] = [
    { model: "gpt-4o-mini-tts", voice, input: text, instructions: INSTRUCTIONS, response_format: "mp3", speed },
    { model: "tts-1-hd", voice, input: text, response_format: "mp3", speed },
    { model: "tts-1", voice, input: text, response_format: "mp3", speed },
  ];
  for (const body of attempts) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.log("[cook-speech]", body.model, res.status, (await res.text().catch(() => "")).slice(0, 160));
      continue;
    }
    return new Uint8Array(await res.arrayBuffer());
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

    const body = await req.json().catch(() => null) as { text?: unknown; voice?: unknown; recipeId?: unknown } | null;
    const text = String(body?.text ?? "").trim().slice(0, 4000);
    if (!text) return json({ error: "Missing text" }, 400);
    const recipeId = typeof body?.recipeId === "string" ? body.recipeId : null;
    const blocked = await gateUsage(req, "cook", { cors, recipeId });
    if (blocked) return blocked;
    const requested = String(body?.voice ?? "coral").toLowerCase();
    const voice = VOICES.has(requested) ? requested : "coral";
    const speedRaw = Number((body as { speed?: unknown } | null)?.speed ?? 1.1);
    const speed = Number.isFinite(speedRaw) ? Math.min(4, Math.max(0.25, speedRaw)) : 1.1;

    const path = `${await sha(`v2|${voice}|${speed}|${text}`)}.mp3`;
    const publicUrl = `${base}/storage/v1/object/public/${BUCKET}/${path}`;
    const head = await fetch(publicUrl, { method: "HEAD" }).catch(() => null);
    if (head?.ok) { await consumeUsage(req, "cook", { recipeId }); return json({ url: publicUrl, cached: true }); }

    const bytes = await speak(text, voice, speed, key);
    if (!bytes) return json({ error: "Couldn't speak this step" }, 502);

    const up = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${service}`,
        apikey: service,
        "content-type": "audio/mpeg",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!up.ok) {
      console.log("[cook-speech] upload", up.status, (await up.text().catch(() => "")).slice(0, 160));
      return json({ error: "Couldn't cache speech" }, 502);
    }
    await consumeUsage(req, "cook", { recipeId });
    return json({ url: publicUrl, cached: false });
  } catch (e) {
    console.log("[cook-speech] error", e);
    return json({ error: "Couldn't speak this step" }, 500);
  }
});
