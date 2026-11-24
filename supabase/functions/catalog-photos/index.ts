// catalog-photos — gives catalog recipes a real photo of the dish (a few per call; run on a schedule).
// POST { batch?: 6 } → { done, left }
const base = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" };

Deno.serve(async (req) => {
  const { batch = 6 } = await req.json().catch(() => ({}));
  const r = await fetch(`${base}/rest/v1/hd_catalog?select=id,title,data&image=is.null&order=created_at.asc&limit=${Math.min(12, batch)}`, { headers: H });
  const rows = (await r.json()) as { id: string; title: string; data: { ingredients?: { name: string }[] } }[];
  let done = 0;
  await Promise.all(rows.map(async (row) => {
    try {
      const res = await fetch(`${base}/functions/v1/step-image`, {
        method: "POST",
        headers: { authorization: `Bearer ${service}`, "content-type": "application/json" },
        body: JSON.stringify({
          title: row.title,
          step: "The finished dish, beautifully plated on a ceramic plate, ready to serve.",
          ingredients: (row.data.ingredients ?? []).slice(0, 12).map((i) => i.name),
        }),
      });
      const j = await res.json().catch(() => null) as { url?: string } | null;
      if (!j?.url) return;
      await fetch(`${base}/rest/v1/hd_catalog?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ image: j.url }) });
      done++;
    } catch { /* try again next run */ }
  }));
  const left = await fetch(`${base}/rest/v1/hd_catalog?select=id&image=is.null`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  return Response.json({ done, left: left.headers.get("content-range")?.split("/")[1] ?? "?" });
});
