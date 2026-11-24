// Plus entitlement constants, usage errors, and small helpers used by screens.


export const PLUS_MONTHLY_ID = 'com.shakeandbakelabs.honeydinner.plus.monthly';
export const PLUS_YEARLY_ID = 'com.shakeandbakelabs.honeydinner.plus.yearly';
export const PLUS_ENTITLEMENT = 'plus';
export const PLUS_OFFERING_ID = 'honeydinner';
export const FREE_IMPORTS_PER_WEEK = 3;
export const FREE_SCANS_PER_WEEK = 2;
export const FREE_GENIE_PER_WEEK = 3;
export const PRIVACY_URL = 'https://shakeandbakelabs.com/honeydinner/privacy';
export const TERMS_URL = 'https://shakeandbakelabs.com/honeydinner/terms';
export const APP_USER_HEADER = 'x-hd-app-user-id';

export type PaywallReason = 'import' | 'scan' | 'cook' | 'genie' | 'gentle' | 'profile';

export type PlusFeature = 'import' | 'scan' | 'cook' | 'genie';

export class PlusRequiredError extends Error {
  code = 'plus_required' as const;
  feature: PlusFeature;
  constructor(feature: PlusFeature, message?: string) {
    super(message ?? 'Honey, Dinner? Plus is needed for this.');
    this.name = 'PlusRequiredError';
    this.feature = feature;
  }
}

export function newAppUserId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return `hd_${g.crypto.randomUUID()}`;
  return `hd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function plusHeaders(extra?: Record<string, string>): Record<string, string> {
  // Lazy to keep this module testable without loading the store.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useApp } = require('@/lib/store') as typeof import('@/lib/store');
  const id = useApp.getState().appUserId;
  return id ? { ...extra, [APP_USER_HEADER]: id } : { ...extra };
}

export function plusErrorFromResponse(status: number, body: unknown, fallback: PlusFeature): PlusRequiredError | null {
  if (status !== 402) return null;
  const d = body && typeof body === 'object' ? (body as { code?: string; feature?: string; error?: string }) : {};
  const feature = d.feature === 'import' || d.feature === 'scan' || d.feature === 'cook' || d.feature === 'genie' ? d.feature : fallback;
  return new PlusRequiredError(feature, d.error);
}

export function openPaywall(reason: PaywallReason) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { router } = require('expo-router') as typeof import('expo-router');
  router.push({ pathname: '/plus', params: { reason } });
}

/** After the first successful imported recipe, gently offer Plus — never on first launch / during the tour. */
export function maybeShowGentlePaywall(imported: boolean) {
  if (!imported) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useApp } = require('@/lib/store') as typeof import('@/lib/store');
  const s = useApp.getState();
  if (!s.onboarded) {
    s.markImported();
    return;
  }
  if (s.gentlePaywallShown || s.isPlus) {
    s.markImported();
    return;
  }
  const first = !s.hasImported;
  s.markImported();
  s.markGentlePaywallShown();
  if (first) setTimeout(() => openPaywall('gentle'), 500);
}

export function weeklyImportLimitCopy() {
  return `${FREE_IMPORTS_PER_WEEK} social or photo imports a week`;
}
