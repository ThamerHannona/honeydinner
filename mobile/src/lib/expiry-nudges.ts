/**
 * Expiry nudges — FridgeGenie reminds you (local notification, 4:30 pm) the day
 * food is about to go off, and suggests a dinner that uses it.
 *
 * Re-planned whenever the pantry changes: we cancel our own scheduled nudges
 * and schedule fresh ones for the next 7 days. Nothing leaves the phone.
 */
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { daysLeft, namesMatch } from '@/lib/kitchen';
import { useApp } from '@/lib/store';
import type { PantryItem, Recipe } from '@/lib/types';

const TAG = 'hd-expiry';
const HOUR = 16;
const MINUTE = 30;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function bestRecipeFor(items: PantryItem[], recipes: Recipe[]): Recipe | null {
  let best: Recipe | null = null;
  let score = 0;
  for (const r of recipes) {
    const n = items.filter((p) => r.ingredients.some((i) => namesMatch(p.name, i.name))).length;
    if (n > score) {
      score = n;
      best = r;
    }
  }
  return best;
}

const listNames = (items: PantryItem[]) => {
  const names = items.map((p) => p.name.toLowerCase());
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
};

async function ensurePermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } });
  return next.granted;
}

async function cancelOurs() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.content.data?.tag === TAG).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function planExpiryNudges(): Promise<void> {
  const { pantry, recipes, expiryNudges, onboarded } = useApp.getState();
  await cancelOurs().catch(() => {});
  if (!expiryNudges || !onboarded) return;

  // Which items expire on each of the next 7 days (nudge the day before + day of)
  const plans: { when: Date; items: PantryItem[]; today: boolean }[] = [];
  const now = new Date();
  for (let d = 0; d < 7; d++) {
    const when = new Date(now);
    when.setDate(now.getDate() + d);
    when.setHours(HOUR, MINUTE, 0, 0);
    if (when.getTime() <= now.getTime() + 60_000) continue;
    const items = pantry.filter((p) => {
      const left = daysLeft(p.expiresAt);
      return left !== null && (left === d || left === d + 1);
    });
    if (items.length) plans.push({ when, items, today: items.some((p) => daysLeft(p.expiresAt) === d) });
  }
  if (!plans.length) return;
  if (!(await ensurePermission())) return;

  for (const plan of plans.slice(0, 7)) {
    const recipe = bestRecipeFor(plan.items, recipes);
    const title = plan.today ? `Use your ${listNames(plan.items)} today 🥬` : `${listNames(plan.items)} goes off tomorrow`;
    const body = recipe
      ? `FridgeGenie: “${recipe.title}” uses it up. Tap to see dinner ideas.`
      : 'FridgeGenie has dinner ideas that use it up. Tap to see.';
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { tag: TAG, url: recipe ? `/recipe/${recipe.id}` : '/genie-chef' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.when },
    }).catch(() => {});
  }
}

/** Keeps the nudges planned as the kitchen changes, and opens the right screen when one is tapped. */
export function useExpiryNudges() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void planExpiryNudges(), 2500);
    };
    const unsub = useApp.subscribe((s, prev) => {
      if (s.pantry !== prev.pantry || s.expiryNudges !== prev.expiryNudges || s.onboarded !== prev.onboarded) schedule();
    });
    schedule();
    const tap = Notifications.addNotificationResponseReceivedListener((res) => {
      const url = res.notification.request.content.data?.url;
      if (typeof url === 'string' && res.notification.request.content.data?.tag === TAG) router.push(url as never);
    });
    return () => {
      unsub();
      tap.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
