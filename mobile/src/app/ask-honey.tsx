import React, { useMemo, useState } from 'react';
import { goBack } from '@/lib/nav';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { Avatar, Button, PressableScale, Txt, HardShadow, Highlight, GenieBubble } from '@/components/ui';
import { rankSuggestions } from '@/lib/kitchen';
import { PLATFORM_LABEL } from '@/lib/services/kitchen-ai';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

export default function AskHoney() {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  const recipes = useApp((s) => s.recipes);
  const pantry = useApp((s) => s.pantry);
  const members = useApp((s) => s.members);
  const sendVote = useApp((s) => s.sendVote);
  const partner = members.find((m) => !m.isMe);
  const me = members.find((m) => m.isMe);
  const insets = useSafeAreaInsets();
  const partnerName = partner?.name ?? 'your partner';
  const candidates = useMemo(() => rankSuggestions(recipes, pantry).slice(0, 6), [recipes, pantry]);
  const [picked, setPicked] = useState<string[]>(() => candidates.slice(0, 3).map((c) => c.recipe.id));
  const selectedIds = picked.filter((id) => candidates.some((c) => c.recipe.id === id));
  const ready = selectedIds.length === 3;

  const toggle = (id: string) => {
    haptic.select();
    setPicked((cur) => {
      const valid = cur.filter((item) => candidates.some((c) => c.recipe.id === item));
      return valid.includes(id) ? valid.filter((x) => x !== id) : valid.length >= 3 ? [...valid.slice(1), id] : [...valid, id];
    });
  };
  const send = () => {
    if (!ready) return;
    haptic.success();
    sendVote(selectedIds);
    toast(`Sent! I'll let you know what ${partnerName} picks.`);
    if (router.canGoBack()) goBack();
    else router.replace('/');
  };

  return (
    <View className="flex-1" testID="ask-honey-screen" style={{ backgroundColor: C.cream }}>
      <View className="flex-row items-center px-5 pb-5" style={{ paddingTop: insets.top + 12 }}>
        <PressableScale testID="ask-honey-back" accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? goBack() : router.replace('/')}>
          <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: C.paper }}><ChevronLeft size={23} color={C.ink} /></View>
        </PressableScale>
        <Txt label weight="extrabold" className="flex-1 pr-11 text-center text-[15px] uppercase tracking-widest" style={{ color: C.ink }}>Ask Honey · Tonight</Txt>
      </View>
      <ScrollView testID="ask-honey-options-scroll" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View className="mb-6 mt-1 flex-row items-center" style={{ gap: 10 }}>
          <Avatar member={me} size={38} />
          <HardShadow color={C.ink} radius={18} style={{ flex: 1 }}><GenieBubble testID="ask-honey-message" text="What's for dinner, honey?" /></HardShadow>
        </View>
        <View className="mb-5" testID="ask-honey-headline">
          <Txt display weight="extrabold" accessibilityRole="header" className="text-[34px] leading-[38px]" style={{ color: C.ink }}>Pick a few.</Txt>
          <Txt display weight="extrabold" className="text-[32px] leading-[38px]" style={{ color: C.ink }}>Dinner,</Txt>
          <View className="self-start">
            <Highlight style={{ fontSize: 30, lineHeight: 36 }}>decided together.</Highlight>
          </View>
          <Txt weight="semibold" className="mt-3 text-[13px]" style={{ color: C.inkSoft }}>Pick 3 ideas for {partnerName}. They vote with a heart.</Txt>
        </View>
        <View style={{ gap: 14 }} testID="ask-honey-options">
          {candidates.map(({ recipe, match }, i) => {
            const on = selectedIds.includes(recipe.id);
            return (
              <Animated.View key={recipe.id} entering={reduceMotion ? undefined : FadeInDown.delay(i * 45)}>
                <PressableScale testID={`ask-option-${i}`} accessibilityRole="checkbox" accessibilityLabel={`${recipe.title}, ${recipe.cookTime} minutes, ${match.missing.length === 0 ? 'you have everything' : `missing ${match.missing.length} items`}`} accessibilityState={{ checked: on, selected: on }} onPress={() => toggle(recipe.id)} haptics={false}>
                  <HardShadow color={C.ink} x={5} y={5} radius={23} enabled={on} style={{ transform: [{ translateX: on ? -2 : 0 }, { translateY: on ? -2 : 0 }] }}><View className="flex-row items-center rounded-[23px] p-3" style={{ gap: 12, backgroundColor: on ? C.honeySoft : C.white, borderWidth: 1.5, borderColor: on ? C.ink : C.line }}>
                    <View className="items-center justify-center rounded-[17px]" style={{ width: 82, height: 88, backgroundColor: [C.creamDeep, C.leafSoft, C.plateRose][i % 3] }}>
                      <Image testID={`ask-option-photo-${i}`} accessibilityRole="image" accessibilityLabel={recipe.title} source={{ uri: recipe.image }} style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: C.ink }} contentFit="cover" transition={200} />
                    </View>
                    <View className="flex-1">
                      <Txt display weight="bold" className="text-[19px] leading-[22px]" numberOfLines={3} style={{ color: C.ink }}>{recipe.title}</Txt>
                      <Txt weight="semibold" className="mt-1 text-[12px]" style={{ color: C.inkSoft }}>{recipe.cookTime} min · {PLATFORM_LABEL[recipe.source.platform]}</Txt>
                      <Txt label testID={`ask-option-match-${i}`} weight="extrabold" className="mt-1 text-[13px] uppercase tracking-wide" style={{ color: match.missing.length === 0 ? C.leafDark : C.honeyDark }}>{match.missing.length === 0 ? 'You have everything' : `Missing ${match.missing.length} item${match.missing.length === 1 ? '' : 's'}`}</Txt>
                    </View>
                    <View testID={`ask-option-heart-${i}`} className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: on ? C.honey : C.creamDeep }}>
                      <Animated.View key={on ? 'picked' : 'unpicked'} entering={reduceMotion ? undefined : ZoomIn.duration(150)}>
                        <Heart size={19} color={C.ink} fill={on ? C.ink : 'transparent'} strokeWidth={1.8} />
                      </Animated.View>
                    </View>
                  </View></HardShadow>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      <View className="border-t px-5 pt-3" style={[{ borderColor: C.line, backgroundColor: C.cream }, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Button testID="ask-send" variant="dark" className="rounded-full" label={ready ? 'Send 3 ideas' : `Pick ${3 - selectedIds.length} more`} onPress={send} disabled={!ready} />
        </View>
        <Txt testID="ask-selection-count" weight="semibold" className="mt-2 text-center text-[12px]" style={{ color: C.inkSoft }}>{selectedIds.length}/3 selected · {partnerName} gets your ideas instantly.</Txt>
      </View>
    </View>
  );
}
