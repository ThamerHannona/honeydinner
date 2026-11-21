/**
 * Shared kitchen sync — you + your partner see the same recipes, pantry,
 * groceries and dinner vote.
 *
 * How it works
 *  - Every shared record has a "kind:id" key. `shadow` holds the JSON we last
 *    agreed with the server; anything that differs locally is pushed.
 *  - The server hands back every record changed since our cursor (`since`),
 *    including our own echoes; applying them is idempotent.
 *  - JSON is stringified with sorted keys, because Postgres jsonb reorders keys
 *    and a naive comparison would push the same record forever.
 *  - Last write wins per record. Fine for two people and a grocery list.
 */
import { AppState as RNAppState } from 'react-native';
import { useEffect } from 'react';
import { toast, useApp } from '@/lib/store';
import type { Household, HouseholdMember, SentRecipe } from '@/lib/types';

const SHARED_KINDS = ['recipe', 'pantry', 'grocery', 'vote'] as const;

type Change = { kind: string; id: string; data?: unknown; deleted?: boolean };
type RemoteRecord = { kind: string; id: string; data: unknown; deleted: boolean; updated_by: string | null; seq: number };

export class HouseholdError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

function stable(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) throw new HouseholdError('Not configured');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/functions/v1/household`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anon, authorization: `Bearer ${anon}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
    if (!res.ok || !json) throw new HouseholdError(json?.error ?? 'Couldn\'t reach your kitchen', json?.code);
    return json;
  } catch (e) {
    if (e instanceof HouseholdError) throw e;
    throw new HouseholdError('No connection. Try again in a moment.');
  } finally {
    clearTimeout(t);
  }
}

const newMemberId = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function myName(): string {
  return useApp.getState().members.find((m) => m.isMe)?.name ?? '';
}

/** Show the partner's real name locally once they've joined. */
function adoptPartner(members: HouseholdMember[], myId: string) {
  // Skip my own old installs (same name as me) and pick the most recently active other person.
  const me = myName().trim().toLowerCase();
  const others = members.filter((m) => m.memberId !== myId && m.name.trim());
  const partner = others.find((m) => m.name.trim().toLowerCase() !== me) ?? others[0];
  if (!partner) return;
  const current = useApp.getState().members.find((m) => !m.isMe);
  if (current?.name !== partner.name) useApp.getState().invitePartner(partner.name);
}

type JoinResult = { token: string; code: string; householdId: string; members: HouseholdMember[] };

async function enter(action: 'create' | 'join', code?: string) {
  const memberId = newMemberId();
  const res = await call<JoinResult>({ action, code, name: myName(), memberId });
  const h: Household = { code: res.code, token: res.token, memberId, members: res.members, since: 0, shadow: {}, outbox: [] };
  useApp.getState().setHousehold(h);
  adoptPartner(res.members, memberId);
  await syncNow();
  return h;
}

export const createKitchen = () => enter('create');
export const joinKitchen = (code: string) => enter('join', code);

export async function leaveKitchen() {
  const h = useApp.getState().household;
  useApp.getState().setHousehold(null);
  if (h) await call({ action: 'leave', token: h.token }).catch(() => {});
}

export async function renameInKitchen(name: string) {
  const h = useApp.getState().household;
  if (h) await call({ action: 'rename', token: h.token, name }).catch(() => {});
}

function localRecords(): Map<string, { kind: string; id: string; data: unknown; json: string }> {
  const s = useApp.getState();
  const out = new Map<string, { kind: string; id: string; data: unknown; json: string }>();
  const add = (kind: string, id: string, data: unknown) => out.set(`${kind}:${id}`, { kind, id, data, json: stable(data) });
  for (const r of s.recipes) add('recipe', r.id, r);
  for (const p of s.pantry) add('pantry', p.id, p);
  for (const g of s.groceries) add('grocery', g.id, g);
  if (s.vote) add('vote', 'current', s.vote);
  return out;
}

let running = false;
let again = false;

export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  const h0 = useApp.getState().household;
  if (!h0) return;
  running = true;
  try {
    const local = localRecords();
    const changes: Change[] = [];
    for (const [key, rec] of local) if (h0.shadow[key] !== rec.json) changes.push({ kind: rec.kind, id: rec.id, data: rec.data });
    for (const key of Object.keys(h0.shadow)) {
      const [kind, ...rest] = key.split(':');
      if ((SHARED_KINDS as readonly string[]).includes(kind) && !local.has(key)) changes.push({ kind, id: rest.join(':'), deleted: true });
    }
    const outbox = h0.outbox;
    for (const s of outbox) changes.push({ kind: 'sent', id: s.id, data: s });

    const res = await call<{ records: RemoteRecord[]; since: number; members: HouseholdMember[]; code: string | null; memberId: string }>({
      action: 'sync',
      token: h0.token,
      since: h0.since,
      changes,
    });

    const shadow = { ...h0.shadow };
    for (const c of changes) {
      const key = `${c.kind}:${c.id}`;
      if (c.kind === 'sent') shadow[key] = '1';
      else if (c.deleted) delete shadow[key];
      else shadow[key] = local.get(key)!.json;
    }

    const apply: RemoteRecord[] = [];
    const received: SentRecipe[] = [];
    for (const r of res.records) {
      const key = `${r.kind}:${r.id}`;
      if (r.kind === 'sent') {
        const sent = r.data as SentRecipe | null;
        if (!shadow[key] && sent && sent.fromMemberId !== h0.memberId) received.push(sent);
        shadow[key] = '1';
        continue;
      }
      if (r.deleted) delete shadow[key];
      else shadow[key] = stable(r.data);
      apply.push(r);
    }

    // Only overwrite local records that weren't edited while this sync was in flight.
    const now = localRecords();
    const safe = apply.filter((r) => {
      const key = `${r.kind}:${r.id}`;
      const before = local.get(key)?.json;
      const after = now.get(key)?.json;
      return before === after;
    });
    if (safe.length) useApp.getState().applyRemote(safe);

    const h1 = useApp.getState().household;
    if (h1) {
      const sentIds = new Set(outbox.map((o) => o.id));
      useApp.getState().patchHousehold({
        since: res.since,
        shadow,
        members: res.members,
        code: res.code ?? h1.code,
        outbox: h1.outbox.filter((o) => !sentIds.has(o.id)),
      });
      adoptPartner(res.members, h1.memberId);
    }

    for (const s of received.slice(-3)) {
      if (s.to && s.to !== h0.memberId) continue;
      if (s.type === 'tonight') {
        useApp.getState().receiveTonight(s);
        toast(`🍝 ${s.from} picked dinner: ${s.title}`);
      } else if (s.type === 'tonight-ok') {
        useApp.getState().receiveTonight(s);
        toast(`👍 ${s.from} is in for tonight's dinner`);
      } else if (s.type === 'pickup') {
        const list = (s.items ?? []).slice(0, 4).join(', ');
        const more = (s.items?.length ?? 0) > 4 ? ` +${(s.items?.length ?? 0) - 4} more` : '';
        toast(`🛒 ${s.from} asked you to grab: ${list}${more}`);
      } else toast(`${s.from} sent you ${s.title} 🍽️`);
    }
  } catch (e) {
    if (e instanceof HouseholdError && e.code === 'no_household') {
      useApp.getState().setHousehold(null);
      toast('You left the shared kitchen.');
    }
  } finally {
    running = false;
    if (again) {
      again = false;
      void syncNow();
    }
  }
}

/** Keeps the shared kitchen in sync: after local edits, every 12s while open, and on return to the app. */
export function useHouseholdSync() {
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const schedule = (ms: number) => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void syncNow(), ms);
    };
    const unsub = useApp.subscribe((s, prev) => {
      if (!s.household) return;
      if (s.recipes !== prev.recipes || s.pantry !== prev.pantry || s.groceries !== prev.groceries || s.vote !== prev.vote || s.household.outbox !== prev.household?.outbox) {
        schedule(1200);
      }
    });
    const tick = setInterval(() => {
      if (RNAppState.currentState === 'active') void syncNow();
    }, 12000);
    const appSub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') schedule(300);
    });
    schedule(1500);
    return () => {
      unsub();
      clearInterval(tick);
      appSub.remove();
      if (debounce) clearTimeout(debounce);
    };
  }, []);
}
