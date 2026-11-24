import { reportBrokenPhoto } from '@/lib/use-genie-photos';
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
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';
import { ConfirmDelete } from '@/components/confirm-delete';

import type { SourcePlatform } from '@/lib/types';
import { quip } from '@/lib/quips';
import { catalogForDiets, catalogToRecipe, hasPhoto, refreshCatalog, useCatalog, type CatalogCategory } from '@/lib/catalog';
import { DIETS } from '@/lib/services/genie-recipes';
import { Sparkles } from 'lucide-react-native';

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
  const deleteRecipe = useApp((s) => s.deleteRecipe);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [source, setSource] = useState<SourcePlatform | null>(null);
  const [matchFilter, setMatchFilter] = useState<MatchFilter>(null);
  const [quickOnly, setQuickOnly] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const searchRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<'mine' | 'discover'>('mine');
  const diets = useApp((s) => s.diets);
  const catalogItems = useCatalog((s) => s.items);
  const [category, setCategory] = useState<CatalogCategory | 'forYou'>('forYou');
  const [limit, setLimit] = useState<number>(40);
  const discoverList = useMemo(() => {
    if (mode !== 'discover') return [];
    if (category === 'forYou') return catalogForDiets(catalogItems, diets);
    return catalogItems.filter((c) => c.category === category && hasPhoto(c)).map(catalogToRecipe);
  }, [mode, category, catalogItems, diets]);
  const ownMatches = useMemo(() => recipes.map((recipe) => ({ recipe, match: matchRecipe(recipe, pantry) })), [recipes, pantry, revision]);
  const matches = useMemo(() => (mode === 'discover' ? discoverList.map((recipe) => ({ recipe, match: matchRecipe(recipe, pantry) })) : ownMatches), [mode, discoverList, ownMatches, pantry]);
  const readyCount = ownMatches.filter(({ match }) => match.missing.length === 0).length;
  const visibleAll = matches.filter(({ recipe, match }) => {
    if (mode === 'mine' && source && recipe.source.platform !== source) return false;
    if (matchFilter === 'ready' && match.missing.length !== 0) return false;
    if (matchFilter === 'missing' && (match.missing.length < 1 || match.missing.length > 2)) return false;
    if (quickOnly && recipe.cookTime >= 30) return false;
    const search = query.trim().toLowerCase();
    return !search || [recipe.title, recipe.source.creator ?? '', ...recipe.ingredients.map((ingredient) => ingredient.name)].some((text) => text.toLowerCase().includes(search));
  });
  const visible = mode === 'discover' ? visibleAll.slice(0, limit) : visibleAll;
  const CATEGORIES: { id: CatalogCategory | 'forYou'; label: string }[] = [
    { id: 'forYou', label: diets.length ? 'For your style' : 'All dinners' },
    { id: 'dessert', label: '🍰 Desserts' },
    ...DIETS.map((d) => ({ id: d.id as CatalogCategory, label: `${d.emoji} ${d.label}` })),
  ];
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
      <ScrollView testID="recipes-data" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { onRefresh(); void refreshCatalog(true); }} tintColor={C.inkSoft} colors={[C.forest]} />} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}>
        {searchOpen ? (
          <View className="mb-4 px-5" testID="recipes-search-container">
            <TextInput ref={searchRef} testID="recipes-search-input" accessibilityLabel="Search recipes or ingredients" value={query} onChangeText={setQuery} placeholder="Search recipes or ingredients…" placeholderTextColor={C.inkFaint} autoFocus returnKeyType="search" onSubmitEditing={() => searchRef.current?.blur()} style={inputStyle} />
          </View>
        ) : null}
        <View className="mx-5 mb-4 flex-row rounded-full p-1" style={{ backgroundColor: C.paper, borderWidth: 1, borderColor: C.hairline }}>
          {([['mine', 'My recipes'], ['discover', `Discover · ${catalogItems.length || '…'}`]] as const).map(([k, label]) => (
            <PressableScale key={k} testID={`recipes-mode-${k}`} accessibilityRole="tab" accessibilityState={{ selected: mode === k }} style={{ flex: 1 }} onPress={() => { haptic.select(); setMode(k); setLimit(40); }}>
              <View className="h-10 flex-row items-center justify-center rounded-full" style={{ backgroundColor: mode === k ? C.ink : 'transparent', gap: 6 }}>
                {k === 'discover' ? <Sparkles size={15} color={mode === k ? C.honey : C.ink} /> : null}
                <Txt weight="extrabold" style={{ fontSize: 14, color: mode === k ? C.cream : C.ink }}>{label}</Txt>
              </View>
            </PressableScale>
          ))}
        </View>
        {mode === 'discover' ? (
          <ScrollView horizontal testID="recipes-categories" showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}>
            {CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <PressableScale key={c.id} testID={`recipes-cat-${c.id}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { haptic.select(); setCategory(c.id); setLimit(40); }}>
                  <View className="h-10 items-center justify-center rounded-full px-4" style={{ backgroundColor: on ? C.honey : C.white, borderWidth: on ? 2 : 1, borderColor: on ? C.ink : C.hairline }}>
                    <Txt weight="extrabold" style={{ fontSize: 14, color: on ? C.onHoney : C.ink }}>{c.label}</Txt>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        ) : null}
        {mode === 'mine' ? (
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
        ) : null}
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
                  <PressableScale key={recipe.id} revealIndex={index} testID={`recipe-card-${recipe.id}`} accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}, ${recipe.cookTime} minutes, ${missing === 0 ? 'can make now' : `missing ${missing} ingredients`}`} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })} onLongPress={mode === 'mine' ? () => { haptic.tap(); setPendingDelete({ id: recipe.id, title: recipe.title }); } : undefined} delayLongPress={350}>
                    <View className="overflow-hidden" style={{ height: (index + column) % 2 === 0 ? 216 : 174, borderRadius: 23, borderWidth: 1.5, borderColor: C.ink, backgroundColor: pastel, padding: 10 }}>
                      <Image testID={`recipe-photo-${recipe.id}`} source={{ uri: recipe.image }} onError={() => reportBrokenPhoto(recipe.id, recipe.image)} contentFit="cover" accessibilityLabel={recipe.title} style={{ flex: 1, borderRadius: 15 }} transition={180} />
                      <View className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1">
                        <Txt label weight="extrabold" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{mode === 'discover' ? 'Cookbook' : SOURCES.find((item) => item.id === recipe.source.platform)?.label ?? 'FridgeGenie'}</Txt>
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
        {mode === 'discover' && visibleAll.length > visible.length ? (
          <PressableScale testID="recipes-show-more" accessibilityRole="button" onPress={() => setLimit(limit + 40)} style={{ marginHorizontal: 20, marginTop: 20 }}>
            <View className="h-12 items-center justify-center rounded-full" style={{ borderWidth: 1.5, borderColor: C.ink }}><Txt weight="extrabold" style={{ fontSize: 15 }}>Show more ({visibleAll.length - visible.length})</Txt></View>
          </PressableScale>
        ) : null}
        {visible.length === 0 ? (
          <View testID="recipes-empty-state" className="px-5 py-10">
            <AnimatedFridgeGenie size={88} mood="idle" testID="recipes-empty-genie" />
            <Txt display weight="bold" style={{ fontSize: 25, marginTop: 12 }}>{mode === 'discover' && !catalogItems.length ? 'Loading the cookbook…' : recipes.length ? 'Nothing quite matches.' : 'Your next keeper awaits.'}</Txt>
            <Txt className="mt-2" style={{ color: C.inkSoft }}>{recipes.length ? 'Try another source, ingredient or filter.' : 'Add a recipe with the + button to start your collection.'}</Txt>
          </View>
        ) : null}
      </ScrollView>
      <ConfirmDelete
        visible={!!pendingDelete}
        title={pendingDelete?.title ?? null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteRecipe(pendingDelete.id);
            haptic.success();
            toast(quip.deleted(pendingDelete.title));
          }
          setPendingDelete(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}
