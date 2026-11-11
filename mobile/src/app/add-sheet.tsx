import { useTheme } from '@/lib/theme-context';
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { ChevronRight, Download, Receipt, ScanLine } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { PressableScale, Txt, HardShadow } from '@/components/ui';




export default function AddSheet() {
  const { C } = useTheme();
const OPTIONS = [
  {
    key: 'import',
    title: 'Import Recipe',
    sub: 'From TikTok, Instagram, Facebook, Snap or any link',
    icon: Download,
    bg: C.leaf,
    go: () => router.replace('/import'),
  },
  {
    key: 'receipt',
    title: 'Scan Receipt',
    sub: 'Add everything you just bought',
    icon: Receipt,
    bg: C.honey,
    go: () => router.replace({ pathname: '/scan', params: { mode: 'receipt' } }),
  },
  {
    key: 'fridge',
    title: 'Scan Fridge',
    sub: "Snap a shelf, I'll spot what's there",
    icon: ScanLine,
    bg: C.ink,
    go: () => router.replace({ pathname: '/scan', params: { mode: 'fridge' } }),
  },
] as const;
  const reduceMotion = useReducedMotion();
  return (
    <View className="flex-1 bg-cream" testID="add-sheet">
      <SheetHeader title="Add to your kitchen" />
      <View className="px-5" style={{ gap: 10 }}>
        {OPTIONS.map((o, i) => {
          const Icon = o.icon;
          return (
            <Animated.View key={o.key} entering={reduceMotion ? undefined : FadeInDown.delay(i * 60).duration(300)}>
              <PressableScale testID={`add-${o.key}`} onPress={o.go} accessibilityRole="button" accessibilityLabel={o.title}>
                <HardShadow radius={16}><View className="flex-row items-center rounded-2xl bg-white p-3.5" style={{ gap: 14 }}>
                  <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: o.bg }}>
                    <Icon size={24} color={o.key === 'receipt' ? C.onHoney : o.key === 'fridge' ? C.cream : C.onGreen} strokeWidth={2.4} />
                  </View>
                  <View className="flex-1">
                    <Txt weight="extrabold" className="text-[17px]">
                      {o.title}
                    </Txt>
                    <Txt weight="semibold" className="text-[13px] text-ink-faint">
                      {o.sub}
                    </Txt>
                  </View>
                  <ChevronRight size={20} color={C.inkFaint} />
                </View></HardShadow>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
