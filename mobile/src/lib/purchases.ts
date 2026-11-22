// RevenueCat wrapper. If the iOS API key is missing or the native module
// isn't available, the app stays on the free tier and never crashes.
import { Platform } from 'react-native';
import { PLUS_ENTITLEMENT, PLUS_MONTHLY_ID, PLUS_YEARLY_ID } from '@/lib/plus';
import { useApp } from '@/lib/store';

export type PlusPlan = {
  id: 'monthly' | 'yearly';
  productId: string;
  title: string;
  priceString: string;
  price: number;
  pkg: unknown;
};

type Offers = { monthly: PlusPlan | null; yearly: PlusPlan | null };

let configured = false;

function key(): string {
  return (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '').trim();
}

async function loadPurchases(): Promise<typeof import('react-native-purchases') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('react-native-purchases');
  } catch {
    return null;
  }
}

export async function initPurchases(): Promise<void> {
  const apiKey = key();
  if (!apiKey || Platform.OS !== 'ios' || configured) return;
  const RC = await loadPurchases();
  if (!RC) return;
  try {
    const appUserID = useApp.getState().appUserId;
    RC.default.configure({ apiKey, appUserID: appUserID || undefined });
    configured = true;
    await refreshPlusStatus();
  } catch {
    configured = false;
  }
}

export async function refreshPlusStatus(): Promise<boolean> {
  if (!configured) {
    useApp.getState().setPlus(false);
    return false;
  }
  const RC = await loadPurchases();
  if (!RC) return false;
  try {
    const info = await RC.default.getCustomerInfo();
    const ent = info.entitlements.active[PLUS_ENTITLEMENT];
    const on = !!ent;
    useApp.getState().setPlus(on);
    return on;
  } catch {
    return useApp.getState().isPlus;
  }
}

function asPlan(id: 'monthly' | 'yearly', productId: string, pkg: { product: { title: string; priceString: string; price: number } }): PlusPlan {
  return {
    id,
    productId,
    title: pkg.product.title || (id === 'yearly' ? 'Yearly' : 'Monthly'),
    priceString: pkg.product.priceString,
    price: pkg.product.price,
    pkg,
  };
}

export async function loadPlusPlans(): Promise<Offers> {
  const fallback: Offers = {
    monthly: { id: 'monthly', productId: PLUS_MONTHLY_ID, title: 'Monthly', priceString: '$7.99', price: 7.99, pkg: null },
    yearly: { id: 'yearly', productId: PLUS_YEARLY_ID, title: 'Yearly', priceString: '$49.99', price: 49.99, pkg: null },
  };
  if (!configured) return fallback;
  const RC = await loadPurchases();
  if (!RC) return fallback;
  try {
    const offerings = await RC.default.getOfferings();
    const pkgs = [
      ...(offerings.current?.availablePackages ?? []),
      ...Object.values(offerings.all).flatMap((o) => o.availablePackages),
    ];
    const seen = new Set<string>();
    let monthly = fallback.monthly;
    let yearly = fallback.yearly;
    for (const pkg of pkgs) {
      const pid = pkg.product.identifier;
      if (seen.has(pid)) continue;
      seen.add(pid);
      if (pid === PLUS_MONTHLY_ID || pkg.packageType === RC.PACKAGE_TYPE.MONTHLY) {
        monthly = asPlan('monthly', pid, pkg);
      }
      if (pid === PLUS_YEARLY_ID || pkg.packageType === RC.PACKAGE_TYPE.ANNUAL) {
        yearly = asPlan('yearly', pid, pkg);
      }
    }
    return { monthly, yearly };
  } catch {
    return fallback;
  }
}

export async function purchasePlan(plan: PlusPlan): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!plan.pkg || !configured) {
    return { ok: false, message: 'Purchases aren’t set up on this build yet.' };
  }
  const RC = await loadPurchases();
  if (!RC) return { ok: false, message: 'Purchases aren’t available on this device.' };
  try {
    const { customerInfo } = await RC.default.purchasePackage(plan.pkg as never);
    const on = !!customerInfo.entitlements.active[PLUS_ENTITLEMENT];
    useApp.getState().setPlus(on);
    if (!on) return { ok: false, message: 'Purchase finished, but Plus isn’t active yet. Try Restore.' };
    return { ok: true };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return { ok: false, message: '' };
    return { ok: false, message: err?.message || 'Couldn’t complete the purchase.' };
  }
}

export async function restorePurchases(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!configured) return { ok: false, message: 'Purchases aren’t set up on this build yet.' };
  const RC = await loadPurchases();
  if (!RC) return { ok: false, message: 'Purchases aren’t available on this device.' };
  try {
    const info = await RC.default.restorePurchases();
    const on = !!info.entitlements.active[PLUS_ENTITLEMENT];
    useApp.getState().setPlus(on);
    return on ? { ok: true } : { ok: false, message: 'No Plus subscription to restore on this Apple ID.' };
  } catch (e) {
    return { ok: false, message: (e as { message?: string })?.message || 'Couldn’t restore purchases.' };
  }
}

export function purchasesConfigured(): boolean {
  return configured;
}
