import { useKitchenRefresh } from '@/lib/use-kitchen-refresh';
import { useTheme } from '@/lib/theme-context';
import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { RecipeImage as Image } from '@/components/recipe-image';
import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { ScreenHeader } from '@/components/app';
import { IconButton, PressableScale, Txt } from '@/components/ui';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { matchRecipe } from '@/lib/kitchen';
import { useApp } from '@/lib/store';

import type { SourcePlatform } from '@/lib/types';

const SOURCES: { id: SourcePlatform; label: string }[] = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'snapchat', label: 'Snapchat' },
  { id: 'photo', label: 'Photos' },
  { id: 'web', label: 'Web' },
];

type MatchFilter = 'ready' | 'missing' | null;

export default function RecipesScreen() {
  const { C, inputStyle } = useTheme();
  const { refreshing, onRefresh, revision } = useKitchenRefresh();
  const PASTELS = [C.plateWheat, C.plateSage, C.plateRose, C.plateLilac];
  const recipes = useApp((s) => s.recipes);
  const pantry = useApp((s) => s.pantry);
  const [source, setSource] = useState<SourcePlatform | null>(null);
  const [matchFilter, setMatchFilter] = useState<MatchFilter>(null);
  const [quickOnly, setQuickOnly] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const searchRef = useRef<TextInput>(null);
  const matches = useMemo(() => recipes.map((recipe) => ({ recipe, match: matchRecipe(recipe, pantry) })), [recipes, pantry, revision]);
  const readyCount = matches.filter(({ match }) => match.missing.length === 0).length;
  const visible = matches.filter(({ recipe, match }) => {
    if (source && recipe.source.platform !== source) return false;
    if (matchFilter === 'ready' && match.missing.length !== 0) return false;
    if (matchFilter === 'missing' && (match.missing.length < 1 || match.missing.length > 2)) return false;
    if (quickOnly && recipe.cookTime >= 30) return false;
    const search = query.trim().toLowerCase();
    return !search || [recipe.title, recipe.source.creator ?? '', ...recipe.ingredients.map((ingredient) => ingredient.name)].some((text) => text.toLowerCase().includes(search));
  });
  const filtersActive = !!source || !!matchFilter || quickOnly || !!query.trim();
  const clearFilters = () => { setSource(null); setMatchFilter(null); setQuickOnly(false); setQuery(''); };
  const filterChip = (label: string, active: boolean, id: string, onPress: () => void) => (
    <PressableScale testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress}>
      <View className="h-11 items-center justify-center rounded-full px-4" style={{ backgroundColor: active ? C.ink : 'transparent', borderWidth: 1, borderColor: C.ink }}>
        <Txt label weight="extrabold" style={{ fontSize: 15, color: active ? C.cream : C.ink }}>{label}</Txt>
      </View>
    </PressableScale>
  );

  return (
    <KeyboardAvoidingView className="flex-1 bg-cream" testID="recipes-screen" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title="Recipes" eyebrow={`${recipes.filter((recipe) => recipe.saved).length} saved · ${readyCount} ready tonight`} right={
        <IconButton testID="recipes-search-toggle" label={searchOpen ? 'Close recipe search' : 'Search recipes'} onPress={() => { setSearchOpen(!searchOpen); if (searchOpen) setQuery(''); }}>
          {searchOpen ? <X size={21} color={C.ink} /> : <Search size={21} color={C.ink} />}
        </IconButton>
      } />
      <ScrollView testID="recipes-data" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.inkSoft} colors={[C.forest]} />} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}>
        {searchOpen ? (
          <View className="mb-4 px-5" testID="recipes-search-container">
            <TextInput ref={searchRef} testID="recipes-search-input" accessibilityLabel="Search recipes or ingredients" value={query} onChangeText={setQuery} placeholder="Search recipes or ingredients…" placeholderTextColor={C.inkFaint} autoFocus returnKeyType="search" onSubmitEditing={() => searchRef.current?.blur()} style={inputStyle} />
          </View>
        ) : null}
        <ScrollView horizontal testID="recipes-source-filters" showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 20 }}>
          {SOURCES.filter((item) => item.id !== 'web' || recipes.some((recipe) => recipe.source.platform === 'web')).map((item) => {
            const active = source === item.id;
            const count = recipes.filter((recipe) => recipe.source.platform === item.id).length;
            return (
              <PressableScale key={item.id} testID={`recipes-source-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.label}, ${count} recipes`} accessibilityState={{ selected: active }} onPress={() => setSource(active ? null : item.id)}>
                <View className="items-center" style={{ width: 62, gap: 6 }}>
                  <View className="items-center justify-center rounded-full" style={{ width: 60, height: 60, backgroundColor: active ? C.honey : C.white, borderWidth: active ? 2 : 1.5, borderColor: active ? C.ink : C.checkboxBorder, padding: 3 }}>
                    <View className="h-full w-full items-center justify-center rounded-full" style={{ borderWidth: 1, borderColor: active ? C.ink : C.creamDeep }}>
                      <Txt testID={`recipes-source-count-${item.id}`} weight="extrabold" style={{ fontSize: 18, color: active ? C.onHoney : C.ink }}>{count}</Txt>
                    </View>
                  </View>
                  <Txt label weight="extrabold" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.3 }}>{item.label}</Txt>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
        <ScrollView horizontal testID="recipes-match-filters" showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 18 }}>
          {filterChip('Can make now', matchFilter === 'ready', 'recipes-filter-ready', () => setMatchFilter(matchFilter === 'ready' ? null : 'ready'))}
          {filterChip('Missing 1–2', matchFilter === 'missing', 'recipes-filter-missing', () => setMatchFilter(matchFilter === 'missing' ? null : 'missing'))}
          {filterChip('Under 30 min', quickOnly, 'recipes-filter-quick', () => setQuickOnly(!quickOnly))}
        </ScrollView>
        {filtersActive ? (
          <View className="mb-3 flex-row items-center justify-between px-5">
            <Txt testID="recipes-results-count" weight="bold" style={{ color: C.inkSoft, fontSize: 13 }}>{visible.length} {visible.length === 1 ? 'recipe' : 'recipes'}</Txt>
            <PressableScale testID="recipes-clear-filters" accessibilityRole="button" accessibilityLabel="Clear all recipe filters" onPress={clearFilters} style={{ minHeight: 44, justifyContent: 'center' }}><Txt weight="extrabold" style={{ fontSize: 13, textDecorationLine: 'underline' }}>Clear filters</Txt></PressableScale>
          </View>
        ) : null}
        <View testID="recipes-grid" className="flex-row px-5" style={{ gap: 12 }}>
          {[0, 1].map((column) => (
            <View key={column} className="flex-1" style={{ gap: 18 }}>
              {visible.filter((_, index) => index % 2 === column).map(({ recipe, match }, index) => {
                const missing = match.missing.length;
                const pastel = PASTELS[(index * 2 + column) % PASTELS.length];
                return (
                  <PressableScale key={recipe.id} revealIndex={index} testID={`recipe-card-${recipe.id}`} accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}, ${recipe.cookTime} minutes, ${missing === 0 ? 'can make now' : `missing ${missing} ingredients`}`} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}>
                    <View className="overflow-hidden" style={{ height: (index + column) % 2 === 0 ? 216 : 174, borderRadius: 23, borderWidth: 1.5, borderColor: C.ink, backgroundColor: pastel, padding: 10 }}>
                      <Image testID={`recipe-photo-${recipe.id}`} source={{ uri: recipe.image }} contentFit="cover" accessibilityLabel={recipe.title} style={{ flex: 1, borderRadius: 15 }} transition={180} />
                      <View className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1">
                        <Txt label weight="extrabold" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{SOURCES.find((item) => item.id === recipe.source.platform)?.label}</Txt>
                      </View>
                      <View testID={`recipe-match-${recipe.id}`} className="absolute bottom-2.5 right-2.5 rounded-full px-2.5 py-1" style={{ backgroundColor: missing <= 2 && missing > 0 ? C.honey : missing === 0 ? C.leaf : C.white }}>
                        <Txt label weight="extrabold" style={{ fontSize: 13, color: missing <= 2 ? C.onHoney : C.ink }}>{missing > 0 && missing <= 2 ? `NEED ${missing}` : `${match.have}/${match.total}`}</Txt>
                      </View>
                    </View>
                    <Txt display weight="bold" className="mt-2" style={{ fontSize: 21, lineHeight: 24 }}>{recipe.title}</Txt>
                    <Txt className="mt-1" style={{ fontSize: 13, color: C.inkSoft }}>{recipe.cookTime} min</Txt>
                  </PressableScale>
                );
              })}
            </View>
          ))}
        </View>
        {visible.length === 0 ? (
          <View testID="recipes-empty-state" className="px-5 py-10">
            <AnimatedFridgeGenie size={88} mood="idle" testID="recipes-empty-genie" />
            <Txt display weight="bold" style={{ fontSize: 25, marginTop: 12 }}>{recipes.length ? 'Nothing quite matches.' : 'Your next keeper awaits.'}</Txt>
            <Txt className="mt-2" style={{ color: C.inkSoft }}>{recipes.length ? 'Try another source, ingredient or filter.' : 'Add a recipe with the + button to start your collection.'}</Txt>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
