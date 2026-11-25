import { useTheme } from '@/lib/theme-context';
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Clapperboard, Receipt, Refrigerator } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { PressableScale, Txt, HardShadow } from '@/components/ui';




export default function AddSheet() {
  const { C } = useTheme();
const OPTIONS = [
  {
    key: 'import',
    title: 'Save a recipe',
    sub: 'TikTok, IG or any link',
    icon: Clapperboard,
    bg: C.leaf,
    go: () => router.replace('/import'),
  },
  {
    key: 'receipt',
    title: 'Scan a receipt',
    sub: 'Stock what you bought',
    icon: Receipt,
    bg: C.honey,
    go: () => router.replace({ pathname: '/scan', params: { mode: 'receipt' } }),
  },
  {
    key: 'fridge',
    title: 'Snap the fridge',
    sub: "I'll spot what's there",
    icon: Refrigerator,
    bg: C.ink,
    go: () => router.replace({ pathname: '/scan', params: { mode: 'fridge' } }),
  },
] as const;
  const reduceMotion = useReducedMotion();
  return (
    <View className="flex-1 bg-cream" testID="add-sheet">
      <SheetHeader title="Add to your kitchen" />
      <View className="flex-row px-5" style={{ gap: 10 }}>
        {OPTIONS.map((o, i) => {
          const Icon = o.icon;
          const fg = o.key === 'receipt' ? C.onHoney : o.key === 'fridge' ? C.cream : C.onGreen;
          return (
            <Animated.View key={o.key} style={{ flex: 1 }} entering={reduceMotion ? undefined : FadeInDown.delay(i * 45).duration(240)}>
              <PressableScale testID={`add-${o.key}`} onPress={o.go} accessibilityRole="button" accessibilityLabel={`${o.title}. ${o.sub}`}>
                <HardShadow radius={24}>
                  <View className="items-center rounded-[24px] bg-white px-2 pb-4 pt-5" style={{ borderWidth: 1.5, borderColor: C.ink, minHeight: 178 }}>
                    <View className="items-center justify-center rounded-[22px]" style={{ width: 72, height: 72, backgroundColor: o.bg, borderWidth: 1.5, borderColor: C.ink }}>
                      <Icon size={36} color={fg} strokeWidth={2.2} />
                    </View>
                    <Txt weight="extrabold" className="mt-3 text-center text-[16px] leading-[19px]">{o.title}</Txt>
                    <Txt weight="semibold" className="mt-1 text-center text-[12px] leading-[15px]" style={{ color: C.inkSoft }}>{o.sub}</Txt>
                  </View>
                </HardShadow>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
