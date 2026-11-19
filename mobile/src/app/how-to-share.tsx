import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { PressableScale, Txt } from '@/components/ui';
import { ShareVideo } from '@/components/share-video';
import { SHARE_STEPS } from '@/components/onboarding-demos';
import { goBack } from '@/lib/nav';
import { haptic } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

const ADD_STEPS = [
  'In TikTok or Instagram, tap Share, then More ••• (iPhone share sheet)',
  'Swipe the row of apps all the way to the end → tap More •••',
  'Tap Edit (top right)',
  'Tap the green + next to Honey, Dinner?',
  'Drag it to the top with ≡, then tap Done. Now it’s always first.',
];

function Steps({ items }: { items: string[] }) {
  const { C } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {items.map((t, i) => (
        <View key={t} className="flex-row items-start" style={{ gap: 10 }}>
          <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: C.ink }}>
            <Txt weight="extrabold" style={{ color: C.cream, fontSize: 12 }}>{i + 1}</Txt>
          </View>
          <Txt weight="semibold" className="flex-1 text-[15px] leading-[21px]">{t}</Txt>
        </View>
      ))}
    </View>
  );
}

export default function HowToShare() {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const [plat, setPlat] = useState<'tiktok' | 'instagram'>('tiktok');
  return (
    <View className="flex-1 bg-cream" testID="how-to-share-screen">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 22 }}>
        <PressableScale testID="how-to-back" accessibilityRole="button" accessibilityLabel="Back" onPress={goBack}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-white"><ArrowLeft size={20} color={C.ink} /></View>
        </PressableScale>
        <Txt label weight="extrabold" className="mt-5 text-[13px]" style={{ color: C.leafDark, letterSpacing: 1.2 }}>HOW TO</Txt>
        <Txt display weight="bold" className="text-[34px] leading-[38px]" style={{ letterSpacing: -1 }}>Save a recipe from TikTok or Instagram</Txt>

        <View className="mb-4 mt-5 flex-row self-center rounded-full p-1" style={{ backgroundColor: C.paper, borderWidth: 1, borderColor: C.hairline }}>
          {(['tiktok', 'instagram'] as const).map((k) => (
            <PressableScale key={k} testID={`how-to-plat-${k}`} accessibilityRole="tab" accessibilityState={{ selected: plat === k }} onPress={() => { haptic.select(); setPlat(k); }}>
              <View className="rounded-full px-5 py-2" style={{ backgroundColor: plat === k ? C.ink : 'transparent' }}>
                <Txt weight="extrabold" className="text-[14px]" style={{ color: plat === k ? C.cream : C.ink }}>{k === 'tiktok' ? 'TikTok' : 'Instagram'}</Txt>
              </View>
            </PressableScale>
          ))}
        </View>
        <ShareVideo key={plat} platform={plat} />
        <View className="mt-5"><Steps items={SHARE_STEPS[plat].slice(0, 3)} /></View>

        <View className="my-8 h-px" style={{ backgroundColor: C.hairline }} />
        <Txt label weight="extrabold" className="text-[13px]" style={{ color: C.leafDark, letterSpacing: 1.2 }}>DON’T SEE HONEY, DINNER?</Txt>
        <Txt display weight="bold" className="mb-4 text-[28px] leading-[32px]" style={{ letterSpacing: -0.8 }}>Add it to your share menu</Txt>
        <ShareVideo platform="add" />
        <View className="mt-5"><Steps items={ADD_STEPS} /></View>
        <Txt weight="semibold" className="mt-5 text-[14px] leading-[20px]" style={{ color: C.inkSoft }}>You only do this once. iPhone remembers it for every app.</Txt>
      </ScrollView>
    </View>
  );
}
