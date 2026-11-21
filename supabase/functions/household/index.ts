// household — shared kitchen for Honey, Dinner? (you + your partner).
//
// One household = one shared set of recipes, pantry, groceries and dinner vote.
// A phone joins with the household's 6-letter code and gets a private device
// token; every later call is authorised by that token. Tables are RLS-locked;
// only this function (service role) touches them.
//
// POST { action: "create", name, memberId }             → { token, code, householdId, members }
// POST { action: "join", code, name, memberId }         → { token, code, householdId, members }
// POST { action: "sync", token, since, changes[] }      → { records[], since, members, code }
//        changes: [{ kind, id, data, deleted }]
// POST { action: "rename", token, name }                → { ok }
// POST { action: "leave", token }                       → { ok }

const cors: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...cors } });

const KINDS = new Set(["recipe", "pantry", "grocery", "vote", "sent"]);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

const BASE = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function randomCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  const s = [...b].map((x) => ALPHABET[x % ALPHABET.length]).join("");
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
const normCode = (c: string) => {
  const s = c.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 6 ? `${s.slice(0, 3)}-${s.slice(3)}` : "";
};
const newToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
const cleanName = (n: unknown) => String(n ?? "").trim().slice(0, 40);
const cleanId = (n: unknown) => String(n ?? "").trim().slice(0, 80);

async function members(householdId: string) {
  const rows = await rest(`hd_devices?select=member_id,name,last_seen&household_id=eq.${householdId}&order=last_seen.desc.nullslast`);
  // one entry per member (a person may re-join from a reinstall)
  const seen = new Map<string, { memberId: string; name: string }>();
  for (const r of rows as { member_id: string; name: string }[]) if (!seen.has(r.member_id)) seen.set(r.member_id, { memberId: r.member_id, name: r.name });
  return [...seen.values()];
}

async function device(token: string) {
  if (!token || token.length < 40) return null;
  const rows = await rest(`hd_devices?select=household_id,member_id,name&token=eq.${encodeURIComponent(token)}&limit=1`);
  return (rows as { household_id: string; member_id: string; name: string }[])[0] ?? null;
}

async function addDevice(householdId: string, memberId: string, name: string) {
  const token = newToken();
  await rest("hd_devices", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ token, household_id: householdId, member_id: memberId, name }),
  });
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "create") {
      const name = cleanName(body.name);
      const memberId = cleanId(body.memberId);
      if (!memberId) return json({ error: "Missing member" }, 400);
      let hh: { id: string; code: string } | null = null;
      for (let i = 0; i < 5 && !hh; i++) {
        try {
          const rows = await rest("hd_households", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ code: randomCode() }),
          });
          hh = rows[0];
        } catch { /* code collision, retry */ }
      }
      if (!hh) return json({ error: "Couldn't create the kitchen" }, 500);
      const token = await addDevice(hh.id, memberId, name);
      return json({ token, code: hh.code, householdId: hh.id, members: await members(hh.id) });
    }

    if (action === "join") {
      const code = normCode(String(body.code ?? ""));
      const name = cleanName(body.name);
      const memberId = cleanId(body.memberId);
      if (!code) return json({ error: "That code should be 6 letters and numbers." }, 400);
      if (!memberId) return json({ error: "Missing member" }, 400);
      const rows = await rest(`hd_households?select=id,code&code=eq.${code}&limit=1`);
      const hh = (rows as { id: string; code: string }[])[0];
      if (!hh) return json({ error: "No kitchen with that code. Check it and try again." }, 404);
      const token = await addDevice(hh.id, memberId, name);
      return json({ token, code: hh.code, householdId: hh.id, members: await members(hh.id) });
    }

    const dev = await device(String(body.token ?? ""));
    if (!dev) return json({ error: "Not in a kitchen", code: "no_household" }, 401);

    if (action === "sync") {
      const changes = Array.isArray(body.changes) ? body.changes.slice(0, 400) : [];
      const rows = changes
        .map((c: any) => ({
          household_id: dev.household_id,
          kind: String(c?.kind ?? ""),
          id: cleanId(c?.id),
          data: c?.deleted ? null : c?.data ?? null,
          deleted: !!c?.deleted,
          updated_by: dev.member_id,
        }))
        .filter((r) => KINDS.has(r.kind) && r.id);
      if (rows.length) {
        await rest("hd_records?on_conflict=household_id,kind,id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        });
      }
      const since = Math.max(0, Number(body.since ?? 0) || 0);
      const records = await rest(
        `hd_records?select=kind,id,data,deleted,updated_by,seq&household_id=eq.${dev.household_id}&seq=gt.${since}&order=seq.asc&limit=1000`,
      ) as { seq: number }[];
      const newSince = records.length ? records[records.length - 1].seq : since;
      await rest(`hd_devices?token=eq.${encodeURIComponent(String(body.token))}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_seen: new Date().toISOString() }),
      }).catch(() => {});
      const hh = await rest(`hd_households?select=code&id=eq.${dev.household_id}&limit=1`);
      return json({ records, since: newSince, members: await members(dev.household_id), code: hh?.[0]?.code ?? null, memberId: dev.member_id });
    }

    if (action === "rename") {
      const name = cleanName(body.name);
      await rest(`hd_devices?household_id=eq.${dev.household_id}&member_id=eq.${encodeURIComponent(dev.member_id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ name }),
      });
      return json({ ok: true });
    }

    if (action === "leave") {
      await rest(`hd_devices?token=eq.${encodeURIComponent(String(body.token))}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.log("[household] error", String(e));
    return json({ error: "Something went wrong. Try again." }, 500);
  }
});
