import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Lock, Shuffle, ShoppingBasket, ThumbsUp, Wand2 } from 'lucide-react-native';
import { RecipeImage as Image } from '@/components/recipe-image';
import { HardShadow, MatchStamp, PressableScale, Txt } from '@/components/ui';
import { useTheme } from '@/lib/theme-context';
import { haptic } from '@/lib/theme';
import { quip } from '@/lib/quips';
import { toast, useApp } from '@/lib/store';
import type { Recipe, TonightPlan } from '@/lib/types';
import type { RecipeMatch } from '@/lib/kitchen';

export function TonightCard({
  hero,
  plan,
  partner,
}: {
  hero: { recipe: Recipe; match: RecipeMatch };
  plan: TonightPlan | null;
  partner: string | null;
}) {
  const { C } = useTheme();
  const me = useApp((s) => s.members.find((m) => m.isMe)?.name ?? 'You');
  const [line, setLine] = useState<string | null>(null);
  const locked = !!plan?.recipeId && plan.recipeId === hero.recipe.id;
  const passes = plan?.passes.length ?? 0;
  const { recipe, match } = hero;
  const missing = match.missing.map((i) => i.name);
  const pickedByMe = plan?.lockedBy === me;
  const open = () => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } });

  const pass = () => {
    haptic.tap();
    useApp.getState().passTonight(recipe.id);
    setLine(quip.passed(passes + 1));
  };
  const lock = () => {
    haptic.success();
    useApp.getState().lockTonight(recipe.id);
    setLine(null);
    toast(quip.locked(recipe.title, partner));
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <Animated.View key={`${recipe.id}-${locked}`} entering={ZoomIn.springify().damping(13).stiffness(180)}>
        <HardShadow color={C.ink} x={6} y={6} radius={28}>
          <View testID="tonight-featured-card" className="rounded-[28px] bg-honey p-5" style={{ borderWidth: 1.5, borderColor: C.ink }}>
            {locked ? (
              <View className="mb-1 flex-row items-center self-start rounded-full bg-ink px-3 py-1.5" style={{ gap: 6 }}>
                <Lock size={12} color={C.cream} />
                <Txt weight="extrabold" style={{ color: C.cream, fontSize: 11, letterSpacing: 0.6 }}>
                  TONIGHT’S DINNER · {pickedByMe ? 'YOU PICKED IT' : `${(plan?.lockedBy ?? '').toUpperCase()} PICKED IT`}
                </Txt>
              </View>
            ) : null}
            <View className="mb-2 h-[146px] flex-row items-start justify-between">
              <View className="mt-2" style={{ gap: 8 }}>
                <MatchStamp testID="suggestion-match-0" have={match.have} total={match.total} />
                {locked && plan?.okBy ? (
                  <View className="flex-row items-center self-start rounded-full bg-white px-2.5 py-1" style={{ gap: 4, borderWidth: 1, borderColor: C.ink }}>
                    <ThumbsUp size={12} color={C.ink} />
                    <Txt weight="extrabold" style={{ fontSize: 11 }}>{plan.okBy === me ? 'You’re in' : `${plan.okBy}’s in`}</Txt>
                  </View>
                ) : null}
              </View>
              <PressableScale testID="suggestion-0" accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}`} onPress={open} style={{ marginTop: -30, marginRight: -13 }}>
                <View className="items-center justify-center rounded-full bg-white p-2" style={{ width: 176, height: 176 }}>
                  <Image testID="suggestion-photo-0" source={{ uri: recipe.image }} accessibilityLabel={recipe.title} contentFit="cover" style={{ width: 158, height: 158, borderRadius: 79, borderWidth: 1.5, borderColor: C.ink }} transition={200} />
                </View>
              </PressableScale>
            </View>
            <Txt label weight="extrabold" className="mb-1 text-[15px] uppercase tracking-widest text-onHoney">
              {recipe.cookTime} MIN · {match.missing.length ? `NEED ${match.missing.length} MORE` : 'YOU HAVE IT ALL'}
            </Txt>
            <PressableScale testID="tonight-featured-title" accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}`} onPress={open}>
              <Txt display weight="bold" className="mb-4 text-[27px] leading-[29px]" style={{ letterSpacing: -0.8, color: C.onHoney }}>{recipe.title}</Txt>
            </PressableScale>

            {locked ? (
              <View style={{ gap: 10 }}>
                <PressableScale testID="tonight-cook" accessibilityRole="button" accessibilityLabel="Start cooking" onPress={() => router.push({ pathname: '/cook/[id]', params: { id: recipe.id, servings: String(recipe.servings) } })}>
                  <HardShadow color={C.honey} radius={999}><View className="h-[50px] items-center justify-center rounded-full bg-ink"><Txt weight="extrabold" className="text-[15px] text-cream">Start cooking</Txt></View></HardShadow>
                </PressableScale>
                <View className="flex-row" style={{ gap: 10 }}>
                  {!pickedByMe && !plan?.okBy ? (
                    <PressableScale testID="tonight-ok" accessibilityRole="button" accessibilityLabel="I'm in" style={{ flex: 1 }} onPress={() => { haptic.success(); useApp.getState().okTonight(); toast(`👍 Told ${plan?.lockedBy ?? 'them'} you’re in`); }}>
                      <View className="h-[46px] flex-row items-center justify-center rounded-full border border-ink bg-white" style={{ gap: 6 }}><ThumbsUp size={15} color={C.ink} /><Txt weight="extrabold" className="text-[14px]">I’m in</Txt></View>
                    </PressableScale>
                  ) : null}
                  {missing.length ? (
                    <PressableScale
                      testID="tonight-missing"
                      accessibilityRole="button"
                      accessibilityLabel={partner ? `Ask ${partner} to grab the missing items` : 'Add missing items to the list'}
                      style={{ flex: 1.3 }}
                      onPress={() => {
                        haptic.tap();
                        const s = useApp.getState();
                        missing.forEach((n) => s.addGrocery(n));
                        if (partner && s.requestPickup(missing)) toast(`🛒 Asked ${partner} to grab ${missing.length} thing${missing.length === 1 ? '' : 's'}`);
                        else toast(`${missing.length} added to your list 🛒`);
                      }}
                    >
                      <View className="h-[46px] flex-row items-center justify-center rounded-full border border-ink bg-white" style={{ gap: 6 }}>
                        <ShoppingBasket size={15} color={C.ink} />
                        <Txt weight="extrabold" className="text-[14px]" numberOfLines={1}>{partner ? `${partner}, grab ${missing.length}` : `Add ${missing.length} to list`}</Txt>
                      </View>
                    </PressableScale>
                  ) : null}
                </View>
                <PressableScale testID="tonight-change" accessibilityRole="button" accessibilityLabel="Change tonight's dinner" onPress={() => { haptic.tap(); useApp.getState().unlockTonight(); }}>
                  <Txt weight="bold" className="text-center text-[13px]" style={{ color: C.onHoney, textDecorationLine: 'underline' }}>Change of plans</Txt>
                </PressableScale>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
              <View className="flex-row" style={{ gap: 10 }}>
                <PressableScale testID="tonight-lock" accessibilityRole="button" accessibilityLabel="Let's make this tonight" style={{ flex: 1.3 }} onPress={lock}>
                  <HardShadow color={C.honey} radius={999}><View className="h-[50px] items-center justify-center rounded-full bg-ink"><Txt weight="extrabold" className="text-[14px] text-cream">Let’s make this</Txt></View></HardShadow>
                </PressableScale>
                <PressableScale testID="tonight-pass" accessibilityRole="button" accessibilityLabel="Not tonight, show another" style={{ flex: 1 }} onPress={pass}>
                  <View className="h-[50px] flex-row items-center justify-center rounded-full border border-ink bg-white" style={{ gap: 6 }}><Shuffle size={14} color={C.ink} /><Txt weight="extrabold" className="text-[14px]">Not tonight</Txt></View>
                </PressableScale>
              </View>
              <PressableScale testID="tonight-ask-honey" accessibilityRole="button" accessibilityLabel="Ask your partner to vote" onPress={() => router.push('/ask-honey')}>
                <Txt weight="bold" className="text-center text-[13px]" style={{ color: C.onHoney, textDecorationLine: 'underline' }}>Can’t decide? Let {partner ?? 'Honey'} vote</Txt>
              </PressableScale>
              </View>
            )}
          </View>
        </HardShadow>
      </Animated.View>
      {!locked && line ? (
        <Animated.View key={line} entering={ZoomIn.springify().damping(14)} className="mt-3 flex-row items-center rounded-[18px] px-4 py-3" style={{ backgroundColor: C.forest, gap: 10 }}>
          <Txt className="flex-1" style={{ color: C.onGreen, fontSize: 14, lineHeight: 19 }}>{line}</Txt>
          {passes >= 3 ? (
            <PressableScale testID="tonight-invent" accessibilityRole="button" accessibilityLabel="Ask FridgeGenie for a new idea" onPress={() => router.push('/genie-chef')}>
              <View className="flex-row items-center rounded-full bg-honey px-3 py-2" style={{ gap: 5 }}><Wand2 size={14} color={C.onHoney} /><Txt weight="extrabold" style={{ fontSize: 13, color: C.onHoney }}>Invent</Txt></View>
            </PressableScale>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
