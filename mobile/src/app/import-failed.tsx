import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { ChevronRight, Film, ImagePlus, Keyboard } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { Illustration } from '@/components/brand';
import { PressableScale, Txt, HardShadow } from '@/components/ui';
import { blankDraft } from '@/lib/services/kitchen-ai';
import { useApp } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import type { SourcePlatform } from '@/lib/types';

export default function ImportFailed() {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { url, platform } = useLocalSearchParams<{ url?: string; platform?: string }>();
  const setImportDraft = useApp((s) => s.setImportDraft);

  const pick = async (kind: 'image' | 'video') => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'image' ? ['images'] : ['videos'], quality: 0.8 });
    const uri = res.assets?.[0]?.uri;
    if (res.canceled || !uri) return;
    router.replace({ pathname: '/import-loading', params: { kind, uri } });
  };

  const typeIt = () => {
    setImportDraft(blankDraft((platform as SourcePlatform) || 'web', url || null));
    router.replace('/import-review');
  };

  const options = [
    { key: 'screenshot', label: 'Upload a screenshot', sub: 'Of the caption or the recipe card', icon: ImagePlus, onPress: () => pick('image') },
    { key: 'recording', label: 'Upload a screen recording', sub: "I'll watch it and take notes", icon: Film, onPress: () => pick('video') },
    { key: 'type', label: 'Type it in', sub: 'Quick form, I kept the link for you', icon: Keyboard, onPress: typeIt },
  ];

  return (
    <View className="flex-1" testID="import-failed-screen" style={{ backgroundColor: C.cream }}>
      <SheetHeader />
      <ScrollView testID="import-failed-options" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View className="items-center px-8">
          <Illustration kind="book" size={140} />
          <Txt display weight="extrabold" className="mt-4 text-center text-[26px] leading-8" testID="import-failed-title" style={{ color: C.ink }}>
            Couldn't find the recipe in that post.
          </Txt>
          <Txt weight="semibold" className="mt-2 text-center text-[15px] leading-[22px]" style={{ color: C.inkSoft }}>
            FridgeGenie: Some posts hide it in a voiceover or a private comment. Try one of these instead.
          </Txt>
        </View>
        <View className="mt-7 px-5" style={{ gap: 10 }}>
          {options.map((o, i) => {
            const Icon = o.icon;
            return (
              <Animated.View key={o.key} entering={reduceMotion ? undefined : FadeInDown.delay(i * 60)}>
                <PressableScale testID={`failed-${o.key}`} accessibilityRole="button" accessibilityLabel={o.label} onPress={o.onPress}>
                  <HardShadow radius={16}><View className="min-h-[68px] flex-row items-center rounded-2xl p-3.5" style={[{ backgroundColor: C.paper }, { gap: 12 }]}>
                    <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: i === 2 ? C.leaf : C.creamDeep }}>
                      <Icon size={21} color={i === 2 ? C.paper : C.ink} />
                    </View>
                    <View className="flex-1">
                      <Txt weight="extrabold" className="text-[16px]" style={{ color: C.ink }}>
                        {o.label}
                      </Txt>
                      <Txt weight="semibold" className="text-[13px]" style={{ color: C.inkFaint }}>
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
      </ScrollView>
    </View>
  );
}
