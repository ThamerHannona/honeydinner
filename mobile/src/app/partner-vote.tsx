import { useTheme } from '@/lib/theme-context';
import React, { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring, useReducedMotion } from 'react-native-reanimated';
import { Clock, Heart, Smartphone, X } from 'lucide-react-native';
import { Logo } from '@/components/brand';
import { Avatar, Button, PressableScale, Txt, HardShadow } from '@/components/ui';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';
import type { Recipe } from '@/lib/types';

/** What the partner sees on their phone when you "Ask Honey". */
export default function PartnerVote() {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  const vote = useApp((s) => s.vote);
  const recipes = useApp((s) => s.recipes);
  const members = useApp((s) => s.members);
  const pickVote = useApp((s) => s.pickVote);
  const partner = members.find((m) => !m.isMe);
  const me = members.find((m) => m.isMe);
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<string | null>(null);

  const options = (vote?.optionIds ?? []).map((id) => recipes.find((r) => r.id === id)).filter((r): r is Recipe => !!r);

  const submit = () => {
    if (!choice) return;
    haptic.success();
    pickVote(choice);
    const r = recipes.find((x) => x.id === choice);
    toast(`${partner?.name} picked ${r?.title ?? 'dinner'}!`);
    router.back();
  };

  return (
    <View className="flex-1 bg-cream" testID="partner-vote-screen">
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center justify-between px-5">
        <View className="flex-row items-center rounded-full bg-white/80 px-3 py-1.5" style={{ gap: 6 }}>
          <Smartphone size={14} color={C.inkSoft} />
          <Txt weight="extrabold" className="text-[12px] text-ink-soft">
            {partner?.name}'s phone · demo
          </Txt>
        </View>
        <PressableScale testID="partner-close" accessibilityLabel="Close" onPress={() => router.back()}>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-white/80">
            <X size={20} color={C.ink} />
          </View>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 16 }}>
        <Logo size="md" />
        <View className="mt-3 flex-row items-center" style={{ gap: 8 }}>
          <Avatar member={me} size={26} />
          <Txt weight="bold" className="text-[15px] text-ink-soft">
            {me?.name} wants your vote for tonight
          </Txt>
        </View>

        <View className="mt-5" style={{ gap: 14 }}>
          {options.map((r, i) => (
            <Animated.View key={r.id} entering={reduceMotion ? undefined : FadeInDown.delay(i * 90).springify().damping(16)}>
              <VoteCard recipe={r} index={i} selected={choice === r.id} onPick={() => setChoice(r.id)} />
            </Animated.View>
          ))}
          {options.length === 0 ? (
            <Txt weight="semibold" className="mt-10 text-center text-ink-soft">
              No dinner request right now.
            </Txt>
          ) : null}
        </View>
      </ScrollView>

      <View className="px-5 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button testID="partner-submit" label={choice ? 'Send my pick' : 'Tap a heart to vote'} onPress={submit} disabled={!choice} />
      </View>
    </View>
  );
}

function VoteCard({ recipe, index, selected, onPick }: { recipe: Recipe; index: number; selected: boolean; onPick: () => void }) {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));
  const w = Math.min(width, 520) - 40;

  const press = () => {
    haptic.medium();
    heart.value = reduceMotion ? 1 : withSequence(withSpring(1.45, { damping: 6, stiffness: 400 }), withSpring(1, { damping: 10 }));
    onPick();
  };

  return (
    <PressableScale testID={`vote-card-${index}`} onPress={press} haptics={false} scaleTo={0.98} accessibilityState={{ selected }} accessibilityLabel={`Vote for ${recipe.title}`}>
      <HardShadow color={C.ink} x={5} y={5} radius={24} enabled={selected} style={{ transform: [{ translateX: selected ? -2 : 0 }, { translateY: selected ? -2 : 0 }] }}><View className="overflow-hidden rounded-3xl bg-white" style={{ borderWidth: 3, borderColor: selected ? C.ink : C.transparent, backgroundColor: selected ? C.selectedCard : C.paper }}>
        <Image source={{ uri: recipe.image }} style={{ width: w, height: 170, backgroundColor: C.creamDeep }} contentFit="cover" />
        <View className="flex-row items-center p-4" style={{ gap: 12 }}>
          <View className="flex-1">
            <Txt display weight="bold" className="text-[19px] leading-6">
              {recipe.title}
            </Txt>
            <View className="mt-1 flex-row items-center" style={{ gap: 4 }}>
              <Clock size={13} color={C.inkFaint} />
              <Txt weight="bold" className="text-[13px] text-ink-faint">
                {recipe.cookTime} min
              </Txt>
            </View>
          </View>
          <Animated.View style={heartStyle}>
            <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: selected ? C.berry : C.berrySoft }}>
              <Heart size={26} color={selected ? C.onGreen : C.berry} fill={selected ? C.onGreen : 'transparent'} strokeWidth={2.4} />
            </View>
          </Animated.View>
        </View>
      </View></HardShadow>
    </PressableScale>
  );
}
