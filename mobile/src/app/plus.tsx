import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { Button, HardShadow, PressableScale, Txt } from '@/components/ui';
import {
  PLUS_MONTHLY_ID,
  PLUS_YEARLY_ID,
  PRIVACY_URL,
  TERMS_URL,
  type PaywallReason,
} from '@/lib/plus';
import { loadPlusPlans, purchasePlan, restorePurchases, type PlusPlan } from '@/lib/purchases';
import { toast, useApp } from '@/lib/store';
import { goBack } from '@/lib/nav';
import { haptic } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

const SCRIPT = { fontFamily: 'CaveatBrush_400Regular', fontSize: 40, lineHeight: 44, letterSpacing: 0.2 } as const;

const FEATURES = [
  'Unlimited recipe imports from social posts, links, and photos',
  'Unlimited fridge and receipt scans',
  'Voice-guided cook mode and step pictures, every time you cook',
];

const INTRO: Record<PaywallReason, string> = {
  gentle: 'That recipe landed. Plus keeps the imports, scans, and hands-free cooking coming.',
  import: "You've used this week's free imports. Plus unlocks as many as you want.",
  scan: "You've used this week's free fridge and receipt scans.",
  cook: "You've had one free cook with voice and step pictures. Plus keeps that going.",
  profile: 'More imports, more scans, and hands-free cooking whenever you need it.',
};

export default function PlusPaywall() {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const raw = useLocalSearchParams<{ reason?: string }>().reason;
  const reason: PaywallReason =
    raw === 'import' || raw === 'scan' || raw === 'cook' || raw === 'gentle' ? raw : 'profile';
  const isPlus = useApp((s) => s.isPlus);
  const [plans, setPlans] = useState<{ monthly: PlusPlan | null; yearly: PlusPlan | null }>({ monthly: null, yearly: null });
  const [picked, setPicked] = useState<'yearly' | 'monthly'>('yearly');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    void loadPlusPlans().then(setPlans);
  }, []);

  const plan = picked === 'yearly' ? plans.yearly : plans.monthly;
  const yearlyPrice = plans.yearly?.price ?? 49.99;
  const founding = picked === 'yearly' && yearlyPrice > 0 && yearlyPrice < 49;

  const buy = async () => {
    if (!plan || busy) return;
    haptic.medium();
    setBusy('buy');
    const res = await purchasePlan(plan);
    setBusy(null);
    if (res.ok) {
      haptic.success();
      toast('Welcome to Honey, Dinner? Plus.');
      goBack();
      return;
    }
    if (res.message) toast(res.message);
  };

  const restore = async () => {
    if (busy) return;
    setBusy('restore');
    const res = await restorePurchases();
    setBusy(null);
    if (res.ok) {
      haptic.success();
      toast('Plus is back on this phone.');
      goBack();
      return;
    }
    toast(res.message);
  };

  return (
    <View className="flex-1" testID="plus-paywall" style={{ backgroundColor: C.cream }}>
      <SheetHeader title="" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: Math.max(36, insets.bottom + 24) }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <AnimatedFridgeGenie size={96} mood={reason === 'gentle' ? 'idle' : 'working'} testID="plus-genie" />
          <Txt style={[SCRIPT, { color: C.ink, textAlign: 'center', marginTop: 8 }]}>Honey, Dinner? Plus</Txt>
          <Txt weight="semibold" className="mt-2 text-center text-[16px] leading-6" style={{ color: C.inkSoft }}>
            {isPlus ? 'You’re already on Plus. Thank you for supporting the kitchen.' : INTRO[reason]}
          </Txt>
        </View>

        <View className="mt-6 overflow-hidden rounded-3xl" style={{ backgroundColor: C.paper }}>
          {FEATURES.map((line, i) => (
            <View
              key={line}
              className="flex-row items-start px-4 py-3.5"
              style={{ gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}
            >
              <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: C.honey }}>
                <Check size={14} color={C.onHoney} strokeWidth={3} />
              </View>
              <Txt weight="bold" className="flex-1 text-[15px] leading-5" style={{ color: C.ink }}>
                {line}
              </Txt>
            </View>
          ))}
        </View>

        {isPlus ? (
          <View className="mt-8">
            <Button testID="plus-close" label="Back to the kitchen" onPress={goBack} />
          </View>
        ) : (
          <>
            <View className="mt-5" style={{ gap: 10 }}>
              <PlanCard
                testID="plus-plan-yearly"
                selected={picked === 'yearly'}
                title="Yearly"
                price={plans.yearly?.priceString ?? '$49.99'}
                detail={founding ? 'Founding Member price · 7-day free trial' : '7-day free trial · best value'}
                badge={founding ? 'Founding Member' : 'Best value'}
                onPress={() => { setPicked('yearly'); haptic.select(); }}
              />
              <PlanCard
                testID="plus-plan-monthly"
                selected={picked === 'monthly'}
                title="Monthly"
                price={plans.monthly?.priceString ?? '$7.99'}
                detail="7-day free trial"
                onPress={() => { setPicked('monthly'); haptic.select(); }}
              />
            </View>

            <View className="mt-6">
              <Button
                testID="plus-subscribe"
                label={busy === 'buy' ? 'Talking to the App Store…' : `Start 7-day free trial`}
                onPress={buy}
                disabled={!plan || !!busy}
              />
            </View>
            <PressableScale testID="plus-restore" accessibilityRole="button" onPress={restore} disabled={!!busy}>
              <Txt weight="extrabold" className="py-4 text-center text-[15px]" style={{ color: C.ink }}>
                {busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
              </Txt>
            </PressableScale>
          </>
        )}

        <Txt weight="semibold" className="mt-2 text-center text-[12px] leading-5" style={{ color: C.inkFaint }} testID="plus-disclosure">
          Honey, Dinner? Plus is an auto-renewing subscription
          {picked === 'yearly'
            ? ` (${PLUS_YEARLY_ID}) billed yearly at ${plans.yearly?.priceString ?? '$49.99'}`
            : ` (${PLUS_MONTHLY_ID}) billed monthly at ${plans.monthly?.priceString ?? '$7.99'}`}
          . Payment is charged to your Apple ID at the end of the 7-day free trial. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. You can manage or cancel in Settings after purchase. Family Sharing is supported.
        </Txt>
        <View className="mt-3 flex-row flex-wrap items-center justify-center" style={{ gap: 14 }}>
          <PressableScale testID="plus-privacy" onPress={() => void Linking.openURL(PRIVACY_URL)}>
            <Txt weight="extrabold" className="text-[13px]" style={{ color: C.ink }}>Privacy Policy</Txt>
          </PressableScale>
          <Txt style={{ color: C.inkFaint }}>·</Txt>
          <PressableScale testID="plus-terms" onPress={() => void Linking.openURL(TERMS_URL)}>
            <Txt weight="extrabold" className="text-[13px]" style={{ color: C.ink }}>Terms of Use</Txt>
          </PressableScale>
        </View>
      </ScrollView>
    </View>
  );
}

function PlanCard({
  selected, title, price, detail, badge, onPress, testID,
}: {
  selected: boolean; title: string; price: string; detail: string; badge?: string; onPress: () => void; testID: string;
}) {
  const { C } = useTheme();
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      <HardShadow color={C.ink} x={5} y={5} radius={18} enabled={selected} style={{ transform: [{ translateX: selected ? -2 : 0 }, { translateY: selected ? -2 : 0 }] }}>
        <View
          className="rounded-[18px] px-4 py-3.5"
          style={{
            backgroundColor: selected ? C.selectedCard : C.paper,
            borderWidth: 2,
            borderColor: selected ? C.ink : C.transparent,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Txt weight="extrabold" className="text-[18px]" style={{ color: C.ink }}>{title}</Txt>
                {badge ? (
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: C.honey }}>
                    <Txt weight="extrabold" className="text-[11px]" style={{ color: C.onHoney }}>{badge}</Txt>
                  </View>
                ) : null}
              </View>
              <Txt weight="semibold" className="mt-0.5 text-[13px]" style={{ color: C.inkSoft }}>{detail}</Txt>
            </View>
            <Txt weight="extrabold" className="text-[18px]" style={{ color: C.ink }}>{price}</Txt>
          </View>
        </View>
      </HardShadow>
    </PressableScale>
  );
}
