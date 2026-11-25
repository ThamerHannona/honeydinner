import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useMutation } from '@tanstack/react-query';
import { Check, ChefHat, Clock, Plus, RefreshCw, Sparkles, X } from 'lucide-react-native';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { Button, PressableScale, Txt } from '@/components/ui';
import { goBack } from '@/lib/nav';
import { openPaywall, PlusRequiredError } from '@/lib/plus';
import { toast, useApp } from '@/lib/store';
import { haptic, signature } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import { DIETS, askGenieForRecipes, dishPhoto, ideaToDraft, type GenieIdea } from '@/lib/services/genie-recipes';
import type { Diet } from '@/lib/types';
import { kitchenInsight, pantryHas, matchRecipe } from '@/lib/kitchen';
import { RecipeImage } from '@/components/recipe-image';
import { catalogForDiets, useCatalog } from '@/lib/catalog';
import { CookWithPicker, MacroPicker, MacroRow, TalkButton, macroSummary } from '@/components/genie-builder';
import { parseMacros, sayAloud, stopSpeaking, useDictation, type MacroTargets } from '@/lib/use-dictation';
import { namesMatch } from '@/lib/kitchen';

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
  const [picked, setPicked] = useState<string[]>([]);
  const [onlyThese, setOnlyThese] = useState<boolean>(false);
  const [macros, setMacros] = useState<MacroTargets>({});
  const [request, setRequest] = useState<string>('');
  const [ideas, setIdeas] = useState<GenieIdea[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [thinking, setThinking] = useState<number>(0);
  const catalogItems = useCatalog((s) => s.items);
  const fromCookbook = useMemo(() => {
    const list = catalogForDiets(catalogItems, diets).map((r) => ({ r, m: matchRecipe(r, pantry) }));
    return list.filter((x) => x.m.have > 0).sort((a, b) => b.m.score - a.m.score).slice(0, 5);
  }, [catalogItems, diets, pantry]);
  // FridgeGenie's live read of your kitchen (out of protein? one buy away from more dinners?)
  const insight = useMemo(() => {
    const own = new Set(recipes.map((r) => r.title.toLowerCase()));
    return kitchenInsight([...recipes, ...catalogForDiets(catalogItems, diets).filter((r) => !own.has(r.title.toLowerCase()))], pantry, diets);
  }, [recipes, catalogItems, diets, pantry]);
  const addGrocery = useApp((s) => s.addGrocery);
  const groceries = useApp((s) => s.groceries);
  const onList = (name: string) => groceries.some((g) => !g.checked && g.name.toLowerCase() === name.toLowerCase());
  // Ideas remember the kitchen they were made for; if you add/remove food after, offer fresh ones.
  const pantryKey = useMemo(() => pantry.map((p) => p.name.toLowerCase()).sort().join('|'), [pantry]);
  const [ideasFor, setIdeasFor] = useState('');
  const ideasStale = ideas.length > 0 && !!ideasFor && ideasFor !== pantryKey;
  // Opened from an expiry nudge: "use these up"
  const params = useLocalSearchParams<{ use?: string; recipe?: string }>();
  const useUp = useMemo(() => (params.use ? String(params.use).split('|').map((x) => x.trim()).filter(Boolean) : []), [params.use]);
  const nudgeRecipe = useMemo(() => (params.recipe ? recipes.find((r) => r.id === String(params.recipe)) : undefined), [params.recipe, recipes]);

  const counts = useMemo(() => ({
    fridge: pantry.filter((p) => p.location === 'fridge').length,
    freezer: pantry.filter((p) => p.location === 'freezer').length,
    pantry: pantry.filter((p) => p.location === 'pantry').length,
  }), [pantry]);

  type AskVars = { request?: string; picked?: string[]; macros?: MacroTargets; voice?: boolean };
  const ask = useMutation({
    mutationFn: (vars?: AskVars) =>
      askGenieForRecipes({
        diets,
        pantry,
        servings: Math.max(2, members.length),
        avoid: [...recipes.map((r) => r.title), ...ideas.map((i) => i.title)],
        mood: [useUp.length ? `MUST use up these before they spoil: ${useUp.join(', ')}` : '', mood ?? ''].filter(Boolean).join('. ') || undefined,
        lang: useApp.getState().recipeLanguage,
        must: vars?.picked ?? picked,
        only: onlyThese,
        request: vars?.request ?? request,
        macros: vars?.macros ?? macros,
      }),
    onSuccess: (list, vars) => {
      haptic.success();
      setIdeas(list);
      setIdeasFor(pantryKey);
      useApp.getState().setGenieUsed();
      setSaved({});
      if (vars?.voice && list[0]) {
        const top = list[0];
        const m = top.macros && top.macros.calories ? ` About ${top.macros.calories} calories and ${top.macros.protein} grams of protein a serving.` : '';
        const need = top.ingredients.filter((x) => !x.have && !pantryHas(pantry, x.name)).map((x) => x.name);
        sayAloud(`I've got ${list.length} ideas. My top pick is ${top.title}, ready in ${top.cookTime} minutes.${m} ${need.length ? `You'd just need ${need.slice(0, 3).join(', ')}.` : 'You have everything for it.'}`);
      }
    },
    onError: (e: Error) => {
      if (e instanceof PlusRequiredError) openPaywall('genie');
      else toast(e.message);
    },
  });

  // Talk to FridgeGenie: understand the ingredients and macro targets in what was said, then cook up ideas.
  const dictation = useDictation((text) => {
    const said = text.toLowerCase();
    const mentioned = pantry.map((p) => p.name).filter((n) => {
      const core = n.toLowerCase();
      return said.includes(core) || core.split(' ').some((w) => w.length > 3 && said.includes(w) && namesMatch(n, w));
    });
    const nextPicked = Array.from(new Set([...picked, ...mentioned]));
    const nextMacros = { ...macros, ...parseMacros(text) };
    setRequest(text);
    setPicked(nextPicked);
    setMacros(nextMacros);
    ask.mutate({ request: text, picked: nextPicked, macros: nextMacros, voice: true });
  });
  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (useUp.length && !ideas.length && !ask.isPending) ask.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useUp.join('|')]);

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
          <Text accessibilityRole="header" style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36, lineHeight: 42, letterSpacing: -1.2, color: C.ink, marginTop: 6, textAlign: 'center' }}>
            What can I make?
          </Text>
          <View style={{ position: 'relative', paddingHorizontal: signature.highlight.padding, marginTop: 2 }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: 4, bottom: 2, left: 0, right: 0, borderRadius: signature.highlight.radius, backgroundColor: C.honey, transform: [{ rotate: signature.highlight.rotate }] }} />
            <Txt weight="extrabold" className="text-[14px]" style={{ color: C.onHoney }}>
              {counts.fridge} in the fridge · {counts.freezer} in the freezer · {counts.pantry} in the pantry
            </Txt>
          </View>
        </View>

        <TalkButton listening={dictation.listening} partial={dictation.partial} onStart={() => void dictation.start().then((ok) => { if (!ok) toast('Turn on the microphone for Honey, Dinner? in Settings to talk to FridgeGenie.'); })} onStop={dictation.stop} />
        {request && !dictation.listening ? (
          <View className="mx-5 mt-2 flex-row items-center rounded-2xl px-3 py-2" style={{ backgroundColor: C.paper, gap: 8 }} testID="genie-request">
            <Txt weight="semibold" className="flex-1 text-[13px]" style={{ color: C.inkSoft }} numberOfLines={2}>You said: “{request}”</Txt>
            <PressableScale testID="genie-request-clear" accessibilityRole="button" accessibilityLabel="Clear request" onPress={() => setRequest('')}><X size={16} color={C.inkSoft} /></PressableScale>
          </View>
        ) : null}

        {useUp.length ? (
          <View testID="genie-use-up" className="mx-5 mt-6 rounded-[22px] p-4" style={{ backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink }}>
            <Txt label weight="extrabold" className="text-[12px]" style={{ color: C.leafDark, letterSpacing: 1.2 }}>USE THESE UP SOON</Txt>
            <View className="mt-2 flex-row flex-wrap" style={{ gap: 6 }}>
              {useUp.map((n) => (
                <View key={n} className="rounded-full px-3 py-1.5" style={{ backgroundColor: C.honey }}>
                  <Txt weight="extrabold" className="text-[13px]" style={{ color: C.onHoney }}>{n}</Txt>
                </View>
              ))}
            </View>
            {nudgeRecipe ? (
              <PressableScale testID="genie-use-up-recipe" accessibilityRole="button" accessibilityLabel={`Open ${nudgeRecipe.title}`} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: nudgeRecipe.id } })}>
                <View className="mt-3 flex-row items-center rounded-2xl bg-white p-2.5" style={{ gap: 12 }}>
                  <RecipeImage source={{ uri: nudgeRecipe.image }} style={{ width: 56, height: 56, borderRadius: 14 }} contentFit="cover" />
                  <View className="flex-1">
                    <Txt weight="extrabold" className="text-[15px]" numberOfLines={2}>{nudgeRecipe.title}</Txt>
                    <Txt weight="semibold" className="text-[12px]" style={{ color: C.inkSoft }}>From your recipes · {matchRecipe(nudgeRecipe, pantry).have}/{matchRecipe(nudgeRecipe, pantry).total} in your kitchen</Txt>
                  </View>
                  <Txt weight="extrabold" className="text-[13px]" style={{ color: C.leafDark }}>Open ›</Txt>
                </View>
              </PressableScale>
            ) : null}
            <Txt weight="semibold" className="mt-3 text-[13px]" style={{ color: C.inkSoft }}>{ask.isPending ? 'Cooking up ideas that use them…' : 'New ideas that use them are below.'}</Txt>
          </View>
        ) : null}

        {insight ? (
          <Animated.View key={insight.text} entering={FadeIn} testID="genie-insight" className="mx-5 mt-6 rounded-3xl p-4" style={{ backgroundColor: C.forest }}>
            <View className="flex-row items-start" style={{ gap: 10 }}>
              <Sparkles size={18} color={C.honey} style={{ marginTop: 2 }} />
              <Txt weight="semibold" className="flex-1 text-[15px] leading-[21px]" style={{ color: C.onGreen }}>{insight.text}</Txt>
            </View>
            {insight.buy ? (
              <PressableScale
                testID="genie-insight-add"
                accessibilityRole="button"
                accessibilityLabel={`Add ${insight.buy} to the list`}
                onPress={() => {
                  if (onList(insight.buy!)) return;
                  haptic.success();
                  addGrocery(insight.buy!);
                  toast(`Added ${insight.buy} to the list`);
                }}
                className="mt-3 self-start"
              >
                <View className="h-10 flex-row items-center rounded-full px-4" style={{ backgroundColor: C.honey, gap: 6 }}>
                  {onList(insight.buy) ? <Check size={16} color={C.ink} /> : <Plus size={16} color={C.ink} />}
                  <Txt weight="extrabold" className="text-[14px]">{onList(insight.buy) ? 'On your list' : `Add ${insight.buy} to the list`}</Txt>
                </View>
              </PressableScale>
            ) : null}
          </Animated.View>
        ) : null}

        {fromCookbook.length ? (
          <View testID="genie-cookbook" className="mt-6 px-5">
            <Txt label weight="extrabold" className="mb-3 text-[13px] uppercase tracking-widest" style={{ color: C.inkSoft }}>From the cookbook · best for your kitchen</Txt>
            <View style={{ gap: 10 }}>
              {fromCookbook.map(({ r, m }) => (
                <PressableScale key={r.id} testID={`genie-cookbook-${r.id}`} accessibilityRole="button" accessibilityLabel={`Open ${r.title}`} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r.id } })}>
                  <View className="flex-row items-center rounded-2xl bg-white p-2.5" style={{ gap: 12, borderWidth: 1, borderColor: C.hairline }}>
                    <RecipeImage source={{ uri: r.image }} style={{ width: 56, height: 56, borderRadius: 14 }} contentFit="cover" />
                    <View className="flex-1">
                      <Txt weight="extrabold" className="text-[15px]" numberOfLines={2}>{r.title}</Txt>
                      <Txt weight="semibold" className="text-[12px]" style={{ color: C.inkSoft }}>{r.cookTime} min · {m.have}/{m.total} in your kitchen</Txt>
                      {m.missing.length ? (
                        <Txt weight="bold" className="text-[12px]" numberOfLines={1} style={{ color: m.proteinMissing ? C.berry : C.ink }}>Need: {m.missing.slice(0, 3).map((x) => x.name).join(', ')}{m.missing.length > 3 ? '…' : ''}</Txt>
                      ) : (
                        <Txt weight="extrabold" className="text-[12px]" style={{ color: C.leafDark }}>You have everything ✓</Txt>
                      )}
                    </View>
                    <Txt weight="extrabold" className="text-[13px]" style={{ color: C.leafDark }}>Open ›</Txt>
                  </View>
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}

        <CookWithPicker pantry={pantry} picked={picked} onChange={setPicked} only={onlyThese} onOnly={setOnlyThese} />
        <MacroPicker value={macros} onChange={setMacros} />

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
              label={ask.isPending ? THINKING[thinking] : ideas.length ? 'Show me different ideas' : picked.length || macroSummary(macros) ? `Make the best dinner${picked.length ? ` with ${picked.length} pick${picked.length === 1 ? '' : 's'}` : ''}${macroSummary(macros) ? ` · ${macroSummary(macros)}` : ''}` : `Make me dinner · ${dietLabel}`}
              onPress={() => ask.mutate(undefined)}
            />
            {pantry.length === 0 ? (
              <Txt className="mt-3 text-center text-[13px]" style={{ color: C.inkSoft }}>Your kitchen is empty — FridgeGenie will suggest easy dinners with a short shopping list. Scan a receipt or your fridge for better matches.</Txt>
            ) : null}
          </View>
        </View>

        {/* ideas */}
        {ideasStale && !ask.isPending ? (
          <Animated.View entering={FadeIn} className="mx-5 mt-6 flex-row items-center rounded-2xl p-3" style={{ backgroundColor: C.honey, gap: 10 }} testID="genie-ideas-stale">
            <Txt weight="bold" className="flex-1 text-[14px]" style={{ color: C.onHoney }}>Your kitchen changed since these ideas. Want new ones?</Txt>
            <PressableScale testID="genie-ideas-refresh" accessibilityRole="button" accessibilityLabel="Get new ideas" onPress={() => ask.mutate(undefined)}>
              <View className="h-10 flex-row items-center rounded-full px-3.5" style={{ backgroundColor: C.ink, gap: 6 }}>
                <RefreshCw size={15} color={C.cream} />
                <Txt weight="extrabold" className="text-[13px]" style={{ color: C.cream }}>New ideas</Txt>
              </View>
            </PressableScale>
          </Animated.View>
        ) : null}

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
                  <MacroRow macros={idea.macros} onHoney={i === 0} />
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
