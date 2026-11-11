import { useTheme } from '@/lib/theme-context';
import React, { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ExternalLink, Heart, Minus, Plus } from 'lucide-react-native';
import { Button, PressableScale, Txt } from '@/components/ui';
import { formatIngredientAmount, isBasic, matchRecipe, namesMatch, pantryHas } from '@/lib/kitchen';
import { PLATFORM_LABEL } from '@/lib/services/kitchen-ai';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';

export default function RecipeDetail() {
  const { C } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useApp((s) => s.recipes.find((r) => r.id === id));
  const pantry = useApp((s) => s.pantry);
  const groceries = useApp((s) => s.groceries);
  const toggleSaved = useApp((s) => s.toggleSaved);
  const addToGroceries = useApp((s) => s.addToGroceries);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [servings, setServings] = useState<number>(recipe?.servings ?? 2);
  const [section, setSection] = useState<'ingredients' | 'steps'>('ingredients');
  const match = useMemo(() => (recipe ? matchRecipe(recipe, pantry) : null), [recipe, pantry]);
  const diameter = Math.min(width * 0.64, 270);

  if (!recipe || !match) {
    return (
      <View className="flex-1 items-center justify-center bg-cream px-10" testID="recipe-missing">
        <Txt display weight="bold" className="text-[22px]">Recipe not found</Txt>
        <View className="mt-5 w-full"><Button testID="recipe-missing-back" label="Go back" onPress={() => router.back()} /></View>
      </View>
    );
  }

  const scale = servings / recipe.servings;
  const missing = match.missing;
  const onList = missing.filter((m) => groceries.some((g) => !g.checked && g.recipeIds.includes(recipe.id) && namesMatch(g.name, m.name)));
  const allOnList = missing.length > 0 && onList.length === missing.length;
  const addMissing = () => {
    haptic.success();
    addToGroceries(missing.map((m) => ({
      ...m,
      qty: m.qty === null ? null : m.unit ? Math.round(m.qty * scale * 100) / 100 : Math.ceil(m.qty * scale),
    })), recipe.id);
    toast(`Added ${missing.length} thing${missing.length > 1 ? 's' : ''} to Groceries for ${recipe.title}.`);
  };

  return (
    <View className="flex-1 bg-cream" testID="recipe-detail-screen">
      <ScrollView testID="recipe-detail-scroll" contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View testID="recipe-hero" className="items-center" style={{ backgroundColor: C.leafSoft, paddingTop: insets.top + 28, paddingBottom: 28 }}>
          <View style={{ width: diameter, height: diameter, borderRadius: diameter / 2, borderWidth: 1.5, borderColor: C.ink, padding: 12, backgroundColor: C.white }}>
            <Image testID="recipe-photo" accessibilityRole="image" accessibilityLabel={recipe.title} source={{ uri: recipe.image }} style={{ width: '100%', height: '100%', borderRadius: diameter / 2, borderWidth: 1, borderColor: C.ink, backgroundColor: C.leafSoft }} contentFit="cover" transition={200} />
          </View>
          <View className="absolute bottom-4 right-5 rounded-lg bg-white px-2 py-1"><Txt label weight="extrabold" className="text-[13px] tracking-wider">PHOTO</Txt></View>
          <View className="absolute left-5 right-5 flex-row justify-between" style={{ top: insets.top + 12 }} pointerEvents="box-none">
            <PressableScale testID="recipe-back" accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/recipes'))}>
              <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: C.paperOverlay }}><ChevronLeft size={24} color={C.ink} /></View>
            </PressableScale>
            <PressableScale testID="recipe-save-toggle" accessibilityRole="button" accessibilityLabel={recipe.saved ? 'Unsave recipe' : 'Save recipe'} accessibilityState={{ selected: recipe.saved }} onPress={() => { haptic.success(); toggleSaved(recipe.id); }}>
              <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: C.paperOverlay }}><Heart size={21} color={C.ink} fill={recipe.saved ? C.honey : 'transparent'} /></View>
            </PressableScale>
          </View>
        </View>

        <View className="-mt-2 rounded-t-[28px] bg-cream px-5 pt-5">
          <PressableScale testID="view-original" accessibilityRole="button" accessibilityLabel="View original recipe" disabled={!recipe.source.url} onPress={() => recipe.source.url && WebBrowser.openBrowserAsync(recipe.source.url)} style={{ alignSelf: 'flex-start' }}>
            <View className="flex-row items-center rounded-full bg-white px-3 py-2" style={{ gap: 5 }}>
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: C.berry }} />
              <Txt weight="bold" className="text-[12px]" numberOfLines={1}>{PLATFORM_LABEL[recipe.source.platform]}{recipe.source.creator ? ` · ${recipe.source.creator}` : ''}{recipe.source.url ? ' · View original' : ''}</Txt>
              {recipe.source.url ? <ExternalLink size={11} color={C.ink} /> : null}
            </View>
          </PressableScale>
          <Txt display weight="extrabold" accessibilityRole="header" className="mb-4 mt-4 text-[32px] leading-[35px]" testID="recipe-title">{recipe.title}</Txt>

          <View className="flex-row border-y border-cream-line py-3" testID="recipe-stats">
            <View className="flex-1 justify-center">
              <Txt display weight="bold" className="text-[22px]">{recipe.cookTime}<Txt className="text-[12px]"> min</Txt></Txt>
              <Txt label weight="extrabold" className="text-[15px] uppercase tracking-wider text-ink-soft">Time</Txt>
            </View>
            <View className="flex-1 border-l border-cream-line pl-3" testID="servings-scaler">
              <View className="flex-row items-center">
                <PressableScale testID="servings-minus" accessibilityRole="button" accessibilityLabel="Fewer servings" disabled={servings <= 1} accessibilityState={{ disabled: servings <= 1 }} onPress={() => setServings((s) => Math.max(1, s - 1))}>
                  <View className="h-11 w-11 items-center justify-center"><Minus size={14} color={servings <= 1 ? C.inkFaint : C.ink} /></View>
                </PressableScale>
                <Txt display weight="bold" className="text-[22px]" testID="servings-value">{servings}</Txt>
                <PressableScale testID="servings-plus" accessibilityRole="button" accessibilityLabel="More servings" disabled={servings >= 20} accessibilityState={{ disabled: servings >= 20 }} onPress={() => setServings((s) => Math.min(20, s + 1))}>
                  <View className="h-11 w-11 items-center justify-center"><Plus size={14} color={servings >= 20 ? C.inkFaint : C.ink} /></View>
                </PressableScale>
              </View>
              <Txt label weight="extrabold" className="text-[15px] uppercase tracking-wider text-ink-soft">Servings</Txt>
            </View>
            <View className="flex-1 justify-center border-l border-cream-line pl-3">
              <Txt display weight="bold" className="text-[22px]" style={{ color: C.leafDark }} testID="recipe-kitchen-match">{match.have}<Txt className="text-[12px]">/{match.total}</Txt></Txt>
              <Txt label weight="extrabold" className="text-[15px] uppercase tracking-wider text-ink-soft">In kitchen</Txt>
            </View>
          </View>

          <View className="mb-2 mt-4 flex-row rounded-full bg-cream-deep p-1" testID="recipe-segments" accessibilityRole="tablist">
            {(['ingredients', 'steps'] as const).map((tab) => (
              <PressableScale key={tab} testID={`recipe-tab-${tab}`} accessibilityRole="tab" accessibilityState={{ selected: section === tab }} accessibilityLabel={tab === 'ingredients' ? 'Ingredients' : 'Steps'} onPress={() => { haptic.select(); setSection(tab); }} style={{ flex: 1 }}>
                <View className="h-11 items-center justify-center rounded-full" style={{ backgroundColor: section === tab ? C.ink : 'transparent' }}>
                  <Txt weight="extrabold" className="text-[14px]" style={{ color: section === tab ? C.cream : C.ink }}>{tab === 'ingredients' ? 'Ingredients' : 'Steps'}</Txt>
                </View>
              </PressableScale>
            ))}
          </View>
          {section === 'ingredients' ? (
            <View testID="ingredient-list">
              {recipe.ingredients.map((ing, i) => {
                const have = pantryHas(pantry, ing.name);
                const basic = isBasic(ing.name);
                return (
                  <View key={`${ing.name}-${i}`} testID={`recipe-ingredient-${i}`} accessibilityLabel={`${ing.name}, ${formatIngredientAmount(ing, scale)}, ${have ? 'in kitchen' : basic ? 'basic ingredient' : 'needed'}`} className="min-h-[54px] flex-row items-center border-b border-cream-line py-3" style={{ gap: 10 }}>
                    <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: have ? C.leaf : 'transparent', borderWidth: have ? 0 : 1.5, borderColor: C.ink }}>
                      {have ? <Check size={14} color={C.ink} strokeWidth={3} /> : null}
                    </View>
                    <Txt weight="bold" className="flex-1 text-[15px]">{ing.name}{basic ? <Txt className="text-[11px] text-ink-soft"> · basic</Txt> : null}</Txt>
                    <Txt weight="semibold" className="text-[13px] text-ink-soft">{formatIngredientAmount(ing, scale)}</Txt>
                    {!have && !basic ? <View className="rounded-full bg-honey px-2 py-1"><Txt label weight="extrabold" className="text-[13px]" style={{ color: C.onHoney }}>NEED</Txt></View> : null}
                  </View>
                );
              })}
              {missing.length === 0 ? <Txt testID="recipe-all-ingredients" weight="bold" className="mt-4 text-[14px] text-leaf-dark">You have everything. Let's cook!</Txt> : null}
            </View>
          ) : (
            <View testID="recipe-steps">
              {recipe.steps.map((step, i) => (
                <View key={i} testID={`recipe-step-${i}`} className="flex-row border-b border-cream-line py-4" style={{ gap: 12 }}>
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-honey"><Txt weight="extrabold" className="text-[13px]" style={{ color: C.onHoney }}>{i + 1}</Txt></View>
                  <Txt weight="semibold" className="flex-1 text-[16px] leading-6">{step}</Txt>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <View testID="recipe-footer" className="flex-row border-t border-cream-line bg-cream px-5 pt-3" style={{ paddingBottom: insets.bottom + 12, gap: 10 }}>
        <View style={{ flex: 0.8 }}>
          <Button testID="add-missing" variant="outline" className="rounded-full bg-transparent px-2" label={allOnList ? 'View list' : missing.length ? `Add ${missing.length} to list` : 'All in kitchen'} onPress={allOnList ? () => router.navigate('/groceries') : addMissing} disabled={missing.length === 0} />
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="start-cooking" variant="dark" className="rounded-full px-2" label="Start cooking" onPress={() => router.push({ pathname: '/cook/[id]', params: { id: recipe.id, servings: String(servings) } })} />
        </View>
      </View>
    </View>
  );
}
