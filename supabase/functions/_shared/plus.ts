// Shared Plus entitlement + usage gates for Honey, Dinner? edge functions.
//
// - Missing x-hd-app-user-id: treat as a pre-Plus TestFlight client and allow
//   the request (legacy unlimited). Older builds keep working.
// - REVENUECAT_SECRET_KEY absent: cannot verify Plus, so enforce free limits.
// - Entitlement id is "plus".
//
// Table: public.hd_usage (service role only).

const RC_ENTITLEMENT = "plus";
export const APP_USER_HEADER = "x-hd-app-user-id";

export type Feature = "import" | "scan" | "cook";

const LIMITS = { import: 3, scan: 2 } as const;

export function weekPeriod(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function serviceHeaders(): Record<string, string> | null {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!key || !url) return null;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
}

export function plusCorsHeaders(base: Record<string, string>): Record<string, string> {
  const cur = base["access-control-allow-headers"] ?? "authorization, x-client-info, apikey, content-type";
  if (/\bx-hd-app-user-id\b/i.test(cur)) return base;
  return { ...base, "access-control-allow-headers": `${cur}, x-hd-app-user-id` };
}

export function appUserIdFrom(req: Request): string | null {
  const raw = req.headers.get(APP_USER_HEADER)?.trim() ?? "";
  if (!raw || raw.length > 128 || !/^[A-Za-z0-9_.:-]+$/.test(raw)) return null;
  return raw;
}

async function hasPlus(appUserId: string): Promise<boolean> {
  const secret = Deno.env.get("REVENUECAT_SECRET_KEY")?.trim();
  if (!secret) return false;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return false;
    const body = await res.json() as {
      subscriber?: { entitlements?: Record<string, { expires_date?: string | null; unsubscribe_detected_at?: string | null }> };
    };
    const ent = body.subscriber?.entitlements?.[RC_ENTITLEMENT];
    if (!ent) return false;
    if (!ent.expires_date) return true; // lifetime / non-expiring
    return Date.parse(ent.expires_date) > Date.now();
  } catch {
    return false;
  }
}

async function loadRow(appUserId: string, period: string): Promise<{ imports: number; scans: number; free_cook_recipe_id: string | null } | null> {
  const h = serviceHeaders();
  const base = Deno.env.get("SUPABASE_URL");
  if (!h || !base) return null;
  const url = `${base}/rest/v1/hd_usage?select=imports,scans,free_cook_recipe_id&app_user_id=eq.${encodeURIComponent(appUserId)}&period=eq.${encodeURIComponent(period)}&limit=1`;
  const res = await fetch(url, { headers: h });
  if (!res.ok) return null;
  const rows = await res.json() as { imports?: number; scans?: number; free_cook_recipe_id?: string | null }[];
  const row = rows[0];
  if (!row) return { imports: 0, scans: 0, free_cook_recipe_id: null };
  return {
    imports: Number(row.imports) || 0,
    scans: Number(row.scans) || 0,
    free_cook_recipe_id: row.free_cook_recipe_id ?? null,
  };
}

async function upsert(appUserId: string, period: string, patch: Record<string, unknown>) {
  const h = serviceHeaders();
  const base = Deno.env.get("SUPABASE_URL");
  if (!h || !base) return;
  await fetch(`${base}/rest/v1/hd_usage?on_conflict=app_user_id,period`, {
    method: "POST",
    headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ app_user_id: appUserId, period, ...patch, updated_at: new Date().toISOString() }),
  });
}

export function plusRequiredPayload(feature: Feature, used?: number, limit?: number) {
  return {
    error: feature === "cook"
      ? "Voice and step pictures are part of Honey, Dinner? Plus."
      : feature === "scan"
        ? "You've used this week's free fridge and receipt scans."
        : "You've used this week's free imports.",
    code: "plus_required",
    feature,
    used: used ?? null,
    limit: limit ?? null,
  };
}

function blocked(cors: Record<string, string>, feature: Feature, used?: number, limit?: number): Response {
  return new Response(JSON.stringify(plusRequiredPayload(feature, used, limit)), {
    status: 402,
    headers: { "content-type": "application/json; charset=utf-8", ...cors },
  });
}

/**
 * Returns a Response to send immediately when the request should be blocked,
 * or null when the call may proceed. Missing app user id = legacy allow.
 */
export async function gateUsage(req: Request, feature: Feature, opts?: { recipeId?: string | null; cors?: Record<string, string> }): Promise<Response | null> {
  const cors = opts?.cors ?? {};
  const recipeId = opts?.recipeId;
  const appUserId = appUserIdFrom(req);
  if (!appUserId) return null;
  if (await hasPlus(appUserId)) return null;


  if (feature === "cook") {
    const period = "lifetime";
    const row = await loadRow(appUserId, period) ?? { imports: 0, scans: 0, free_cook_recipe_id: null };
    const id = (recipeId ?? "").trim();
    if (row.free_cook_recipe_id && id && row.free_cook_recipe_id === id) return null;
    if (!row.free_cook_recipe_id) return null; // first full cook is free; consume after success
    return blocked(cors, "cook");
  }

  const period = weekPeriod();
  const row = await loadRow(appUserId, period) ?? { imports: 0, scans: 0, free_cook_recipe_id: null };
  const used = feature === "scan" ? row.scans : row.imports;
  const limit = LIMITS[feature];
  if (used >= limit) return blocked(cors, feature, used, limit);
  return null;
}

/** Record a successful use. No-op for legacy clients (no header) and Plus subscribers. */
export async function consumeUsage(req: Request, feature: Feature, opts?: { recipeId?: string | null }): Promise<void> {
  const recipeId = opts?.recipeId;
  const appUserId = appUserIdFrom(req);
  if (!appUserId) return;
  if (await hasPlus(appUserId)) return;
  if (feature === "cook") {
    const id = (recipeId ?? "").trim();
    if (!id) return;
    const period = "lifetime";
    const row = await loadRow(appUserId, period) ?? { imports: 0, scans: 0, free_cook_recipe_id: null };
    if (row.free_cook_recipe_id) return;
    await upsert(appUserId, period, { free_cook_recipe_id: id, imports: row.imports, scans: row.scans });
    return;
  }
  const period = weekPeriod();
  const row = await loadRow(appUserId, period) ?? { imports: 0, scans: 0, free_cook_recipe_id: null };
  const used = feature === "scan" ? row.scans : row.imports;
  const limit = LIMITS[feature];
  if (used >= limit) return;
  await upsert(appUserId, period, {
    imports: feature === "import" ? used + 1 : row.imports,
    scans: feature === "scan" ? used + 1 : row.scans,
    free_cook_recipe_id: row.free_cook_recipe_id,
  });
}
