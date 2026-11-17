import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useMutation } from '@tanstack/react-query';
import { Check, ChefHat, Clock, Plus, RefreshCw, Sparkles, X } from 'lucide-react-native';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { Button, PressableScale, Txt } from '@/components/ui';
import { goBack } from '@/lib/nav';
import { toast, useApp } from '@/lib/store';
import { haptic, signature } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import { DIETS, askGenieForRecipes, dishPhoto, ideaToDraft, type GenieIdea } from '@/lib/services/genie-recipes';
import type { Diet } from '@/lib/types';
import { pantryHas } from '@/lib/kitchen';

const MOODS = ['Quick', 'Comfort food', 'Light', 'Something new'] as const;
const THINKING = [
  'Peeking in the fridge…',
  'Checking what expires first…',
  'Matching your eating style…',
  'Plating up some ideas…',
];

export default function GenieChef() {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const pantry = useApp((s) => s.pantry);
  const recipes = useApp((s) => s.recipes);
  const members = useApp((s) => s.members);
  const diets = useApp((s) => s.diets);
  const setDiets = useApp((s) => s.setDiets);
  const saveRecipe = useApp((s) => s.saveRecipe);
  const updateRecipe = useApp((s) => s.updateRecipe);
  const [mood, setMood] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<GenieIdea[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [thinking, setThinking] = useState<number>(0);

  const counts = useMemo(() => ({
    fridge: pantry.filter((p) => p.location === 'fridge').length,
    freezer: pantry.filter((p) => p.location === 'freezer').length,
    pantry: pantry.filter((p) => p.location === 'pantry').length,
  }), [pantry]);

  const ask = useMutation({
    mutationFn: () =>
      askGenieForRecipes({
        diets,
        pantry,
        servings: Math.max(2, members.length),
        avoid: [...recipes.map((r) => r.title), ...ideas.map((i) => i.title)],
        mood: mood ?? undefined,
        lang: useApp.getState().recipeLanguage,
      }),
    onSuccess: (list) => {
      haptic.success();
      setIdeas(list);
      setSaved({});
    },
    onError: (e: Error) => toast(e.message),
  });

  useEffect(() => {
    if (!ask.isPending) return;
    setThinking(0);
    const t = setInterval(() => setThinking((n) => (n + 1) % THINKING.length), 1600);
    return () => clearInterval(t);
  }, [ask.isPending]);

  const toggleDiet = (d: Diet) => {
    haptic.tap();
    setDiets(diets.includes(d) ? diets.filter((x) => x !== d) : [...diets, d]);
  };

  const keep = (idea: GenieIdea, andCook: boolean) => {
    let id = saved[idea.title];
    if (!id) {
      id = saveRecipe(ideaToDraft(idea), false);
      setSaved((s) => ({ ...s, [idea.title]: id }));
      // fetch a photo of the finished dish in the background
      void dishPhoto(idea).then((url) => {
        if (url) updateRecipe(id, { image: url });
      });
    }
    haptic.success();
    if (andCook) router.push({ pathname: '/recipe/[id]', params: { id } });
    else toast(`Saved ${idea.title}`);
  };

  const dietLabel = diets.length ? DIETS.filter((d) => diets.includes(d.id)).map((d) => d.label).join(' + ') : 'anything goes';

  return (
    <View className="flex-1" style={{ backgroundColor: C.cream }} testID="genie-chef-screen">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row justify-end px-5">
          <PressableScale testID="genie-chef-close" accessibilityLabel="Close" onPress={goBack}>
            <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: C.paper }}><X size={20} color={C.ink} /></View>
          </PressableScale>
        </View>

        {/* hero */}
        <View className="items-center px-6">
          <AnimatedFridgeGenie size={ask.isPending ? 132 : 118} mood={ask.isPending ? 'working' : 'idle'} testID="genie-chef-mascot" />
          <Text accessibilityRole="header" style={{ fontFamily: 'CaveatBrush_400Regular', fontSize: 40, lineHeight: 46, color: C.ink, marginTop: 6, textAlign: 'center' }}>
            What can I make?
          </Text>
          <View style={{ position: 'relative', paddingHorizontal: signature.highlight.padding, marginTop: 2 }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: 4, bottom: 2, left: 0, right: 0, borderRadius: signature.highlight.radius, backgroundColor: C.honey, transform: [{ rotate: signature.highlight.rotate }] }} />
            <Txt weight="extrabold" className="text-[14px]" style={{ color: C.onHoney }}>
              {counts.fridge} in the fridge · {counts.freezer} in the freezer · {counts.pantry} in the pantry
            </Txt>
          </View>
        </View>

        {/* eating style */}
        <View className="mt-7 px-5">
          <Txt label weight="extrabold" className="mb-3 text-[13px] uppercase tracking-widest" style={{ color: C.inkSoft }}>Your eating style</Txt>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {DIETS.map((d) => {
              const on = diets.includes(d.id);
              return (
                <PressableScale key={d.id} testID={`diet-${d.id}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d.label} onPress={() => toggleDiet(d.id)}>
                  <Animated.View layout={LinearTransition.springify().damping(16)} className="flex-row items-center rounded-full px-3.5 py-2.5" style={{ gap: 6, backgroundColor: on ? C.ink : C.paper, borderWidth: 1.5, borderColor: on ? C.ink : C.hairline }}>
                    <Txt className="text-[15px]">{d.emoji}</Txt>
                    <Txt weight="extrabold" className="text-[14px]" style={{ color: on ? C.cream : C.ink }}>{d.label}</Txt>
                    {on ? <Check size={14} color={C.honey} strokeWidth={3} /> : null}
                  </Animated.View>
                </PressableScale>
              );
            })}
          </View>

          <Txt label weight="extrabold" className="mb-3 mt-6 text-[13px] uppercase tracking-widest" style={{ color: C.inkSoft }}>In the mood for</Txt>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {MOODS.map((m) => {
              const on = mood === m;
              return (
                <PressableScale key={m} testID={`mood-${m}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { haptic.tap(); setMood(on ? null : m); }}>
                  <View className="rounded-full px-3.5 py-2" style={{ backgroundColor: on ? C.honey : 'transparent', borderWidth: 1.5, borderColor: on ? C.honey : C.hairline }}>
                    <Txt weight="bold" className="text-[13px]" style={{ color: on ? C.onHoney : C.ink }}>{m}</Txt>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <View className="mt-7">
            <Button
              testID="genie-chef-go"
              variant="primary"
              loading={ask.isPending}
              icon={ideas.length ? <RefreshCw size={18} color={C.cream} /> : <Sparkles size={18} color={C.cream} />}
              label={ask.isPending ? THINKING[thinking] : ideas.length ? 'Show me different ideas' : `Make me dinner · ${dietLabel}`}
              onPress={() => ask.mutate()}
            />
            {pantry.length === 0 ? (
              <Txt className="mt-3 text-center text-[13px]" style={{ color: C.inkSoft }}>Your kitchen is empty — FridgeGenie will suggest easy dinners with a short shopping list. Scan a receipt or your fridge for better matches.</Txt>
            ) : null}
          </View>
        </View>

        {/* ideas */}
        <View className="mt-8 px-5" style={{ gap: 16 }} testID="genie-ideas">
          {ideas.map((idea, i) => {
            // Same rules as the recipe screen: basics and staples (oil, butter, spices) count as had.
            const missing = idea.ingredients.filter((x) => !x.have && !pantryHas(pantry, x.name));
            const isSaved = !!saved[idea.title];
            return (
              <Animated.View key={idea.title} entering={FadeInDown.delay(i * 110).springify().damping(16)} exiting={FadeOut} testID={`genie-idea-${i}`}>
                <View className="rounded-[26px] p-5" style={{ backgroundColor: i === 0 ? C.honey : C.paper, borderWidth: 1.5, borderColor: C.ink }}>
                  <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                    {idea.tags.map((t) => (
                      <View key={t} className="rounded-full px-2.5 py-1" style={{ backgroundColor: i === 0 ? '#FFFFFF99' : C.cream }}>
                        <Txt weight="extrabold" className="text-[11px] uppercase tracking-wider">{t}</Txt>
                      </View>
                    ))}
                  </View>
                  <Txt display weight="bold" className="mt-3 text-[24px] leading-[27px]" style={{ color: i === 0 ? C.onHoney : C.ink }}>{idea.title}</Txt>
                  <Txt weight="semibold" className="mt-1.5 text-[14px] leading-5" style={{ color: i === 0 ? C.onHoney : C.inkSoft }}>{idea.blurb}</Txt>
                  <View className="mt-3 flex-row items-center" style={{ gap: 14 }}>
                    <View className="flex-row items-center" style={{ gap: 5 }}><Clock size={14} color={C.ink} /><Txt weight="bold" className="text-[13px]">{idea.cookTime} min</Txt></View>
                    <Txt weight="bold" className="text-[13px]">{idea.ingredients.length - missing.length}/{idea.ingredients.length} in your kitchen</Txt>
                  </View>
                  {missing.length ? (
                    <Txt weight="semibold" className="mt-1.5 text-[13px]" style={{ color: i === 0 ? C.onHoney : C.inkSoft }}>Need: {missing.map((m) => m.name).join(', ')}</Txt>
                  ) : (
                    <Txt weight="extrabold" className="mt-1.5 text-[13px]" style={{ color: C.leafDark }}>You have everything ✓</Txt>
                  )}
                  <View className="mt-4 flex-row" style={{ gap: 10 }}>
                    <PressableScale testID={`genie-idea-cook-${i}`} accessibilityRole="button" accessibilityLabel={`Cook ${idea.title}`} style={{ flex: 1.3 }} onPress={() => keep(idea, true)}>
                      <View className="h-12 flex-row items-center justify-center rounded-full" style={{ backgroundColor: C.ink, gap: 7 }}>
                        <ChefHat size={17} color={C.cream} /><Txt weight="extrabold" className="text-[14px]" style={{ color: C.cream }}>Let’s cook this</Txt>
                      </View>
                    </PressableScale>
                    <PressableScale testID={`genie-idea-save-${i}`} accessibilityRole="button" accessibilityLabel={isSaved ? 'Saved' : `Save ${idea.title}`} style={{ flex: 1 }} onPress={() => !isSaved && keep(idea, false)}>
                      <View className="h-12 flex-row items-center justify-center rounded-full" style={{ borderWidth: 1.5, borderColor: C.ink, backgroundColor: i === 0 ? '#FFFFFF80' : 'transparent', gap: 6 }}>
                        {isSaved ? <Check size={17} color={C.ink} /> : <Plus size={17} color={C.ink} />}
                        <Txt weight="extrabold" className="text-[14px]">{isSaved ? 'Saved' : 'Save'}</Txt>
                      </View>
                    </PressableScale>
                  </View>
                </View>
              </Animated.View>
            );
          })}
          {ask.isPending && !ideas.length ? (
            <Animated.View entering={FadeIn} className="items-center py-6">
              <Txt weight="bold" className="text-[14px]" style={{ color: C.inkSoft }}>{THINKING[thinking]}</Txt>
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
