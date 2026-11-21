// persist-covers — one-off/maintenance: copies TikTok/Instagram cover photos (signed links that expire)
// into our own Storage and points the shared-kitchen recipe records at the permanent copy.
// POST { code?: "ABC-123" }  → { updated, failed }
const base = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" };
const CDN = /tiktokcdn|tiktokv|ibyteimg|muscdn|cdninstagram|fbcdn|tikwm/i;

async function persist(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", referer: "https://www.instagram.com/" } });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!type.startsWith("image/")) return null;
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
    return up.ok ? `${base}/storage/v1/object/public/step-images/${path}` : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({})) as { code?: string };
  let hh = "";
  if (body.code) {
    const r = await fetch(`${base}/rest/v1/hd_households?select=id&code=eq.${encodeURIComponent(body.code)}`, { headers: H });
    const rows = await r.json();
    if (!rows[0]) return Response.json({ error: "no such kitchen" }, { status: 404 });
    hh = `&household_id=eq.${rows[0].id}`;
  }
  const r = await fetch(`${base}/rest/v1/hd_records?select=household_id,id,data&kind=eq.recipe&deleted=eq.false${hh}`, { headers: H });
  const recs = (await r.json()) as { household_id: string; id: string; data: { image?: string } }[];
  let updated = 0, failed = 0;
  await Promise.all(recs.filter((x) => x.data?.image && CDN.test(x.data.image)).map(async (x) => {
    const url = await persist(x.data.image!);
    if (!url) { failed++; return; }
    const u = await fetch(`${base}/rest/v1/hd_records?household_id=eq.${x.household_id}&id=eq.${encodeURIComponent(x.id)}&kind=eq.recipe`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ data: { ...x.data, image: url }, updated_at: new Date().toISOString(), updated_by: "server-photo-fix" }),
    });
    if (u.ok) updated++; else failed++;
  }));
  return Response.json({ updated, failed });
});
