import { useKitchenRefresh } from '@/lib/use-kitchen-refresh';
import { useTheme } from '@/lib/theme-context';
import React, { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Camera, Check, ChevronRight, Plus, Search, Sparkles, X } from 'lucide-react-native';
import { ScreenHeader } from '@/components/app';
import { ListReveal, PressableScale, Txt, StatusDot } from '@/components/ui';
import { expiryLabel, freshness, matchRecipe } from '@/lib/kitchen';
import { filterPantry, PANTRY_LOCATIONS } from '@/lib/pantry';
import { useApp } from '@/lib/store';
import { haptic, fonts } from '@/lib/theme';
import type { PantryItem, StorageLocation } from '@/lib/types';



export default function PantryScreen() {
  const { C } = useTheme();
  const { refreshing, onRefresh, revision } = useKitchenRefresh();
  const PASTELS = [C.plateWheat, C.plateSage, C.plateRose, C.plateLilac];
  const pantry = useApp((s) => s.pantry);
  const recipes = useApp((s) => s.recipes);
  const markUsed = useApp((s) => s.markUsed);
  const restorePantryItem = useApp((s) => s.restorePantryItem);
  const [location, setLocation] = useState<StorageLocation>('fridge');
  const [query, setQuery] = useState<string>('');
  const [removed, setRemoved] = useState<PantryItem | null>(null);
  const items = useMemo(() => filterPantry(pantry, location, query), [pantry, location, query, revision]);
  const expiring = pantry.filter((item) => freshness(item.expiresAt) === 'soon');
  const usefulRecipes = recipes.filter((recipe) => matchRecipe(recipe, pantry).usesExpiring > 0).length;
  const usedUp = (id: string) => { const item = markUsed(id); if (item) { haptic.success(); setRemoved(item); } };
  return (
    <KeyboardAvoidingView className="flex-1 bg-cream" testID="pantry-screen" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title="Kitchen" eyebrow={`${pantry.length} ITEMS · AT HOME`} right={<PressableScale testID="kitchen-scan" accessibilityRole="button" accessibilityLabel="Scan your fridge" onPress={() => router.push({ pathname: '/scan', params: { mode: 'fridge' } })}><View className="h-11 w-11 items-center justify-center rounded-full bg-ink"><Camera size={19} color={C.cream} /></View></PressableScale>} />
      <View className="px-5 pt-1">
        <PressableScale testID="kitchen-expiring-recipes" accessibilityRole="button" accessibilityLabel="See recipes that use expiring items" onPress={() => router.navigate('/')}>
          <View className="mb-4 flex-row items-center rounded-t-[22px] rounded-br-[22px] bg-forest p-4" style={{ gap: 12 }}>
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-honey"><Sparkles size={20} color={C.onHoney} /></View>
            <View className="flex-1"><Txt display weight="bold" className="text-[17px] text-onGreen">{expiring.length ? `${expiring.length} things need using soon` : 'Your kitchen is looking fresh'}</Txt><Txt className="mt-0.5 text-[13px] text-onGreen">{usefulRecipes} recipes use them up</Txt></View>
            <ChevronRight size={19} color={C.honey} />
          </View>
        </PressableScale>
        <View className="flex-row rounded-full bg-cream-deep p-1" testID="pantry-segments" accessibilityRole="tablist">
          {PANTRY_LOCATIONS.map((segment) => <PressableScale key={segment.key} testID={`segment-${segment.key}`} accessibilityRole="tab" accessibilityLabel={segment.label} accessibilityState={{ selected: location === segment.key }} onPress={() => setLocation(segment.key)} style={{ flex: 1 }}><View className="h-11 items-center justify-center rounded-full" style={{ backgroundColor: location === segment.key ? C.ink : 'transparent' }}><Txt weight="extrabold" className="text-[14px]" style={{ color: location === segment.key ? C.cream : C.inkSoft }}>{segment.label}</Txt></View></PressableScale>)}
        </View>
        <View className="mb-3 mt-4 h-11 flex-row items-center rounded-full px-3" style={{ gap: 8, borderWidth: 1, borderColor: C.line }}>
          <Search size={17} color={C.inkSoft} />
          <TextInput testID="pantry-search" accessibilityLabel="Search pantry items" placeholder={`Search your ${location}…`} placeholderTextColor={C.inkFaint} value={query} onChangeText={setQuery} style={{ flex: 1, height: 44, fontFamily: fonts.semibold, fontSize: 14, color: C.ink }} returnKeyType="search" />
          {query ? <PressableScale testID="pantry-search-clear" accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={18} color={C.inkSoft} /></PressableScale> : null}
        </View>
        <View className="mb-1 flex-row items-center justify-between">
          <Txt testID="pantry-item-count" className="text-[11px] text-ink-soft">{items.length} item{items.length === 1 ? '' : 's'} · swipe left when used up</Txt>
          <PressableScale testID="pantry-add-button" accessibilityRole="button" accessibilityLabel="Add item" onPress={() => router.push({ pathname: '/pantry-add', params: { location } })}><View className="h-11 flex-row items-center" style={{ gap: 4 }}><Plus size={15} color={C.ink} /><Txt weight="extrabold" className="text-[12px]">Add item</Txt></View></PressableScale>
        </View>
      </View>
      {removed ? <View testID="pantry-used-up-banner" className="mx-5 mb-2 flex-row items-center rounded-xl bg-leaf-soft px-3" style={{ gap: 8 }} accessibilityLiveRegion="polite"><Check size={16} color={C.leafDark} /><Txt weight="bold" className="flex-1 text-[13px] text-leaf-dark">{removed.name} used up</Txt><PressableScale testID="pantry-undo" accessibilityRole="button" onPress={() => { restorePantryItem(removed); setRemoved(null); }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Txt weight="extrabold" className="text-[14px] text-leaf-dark">Undo</Txt></PressableScale></View> : null}
      <FlatList testID="pantry-list" data={items} refreshing={refreshing} onRefresh={onRefresh} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" ListEmptyComponent={<View testID="pantry-empty" className="items-center px-6 py-12"><Txt display weight="bold" className="text-center text-[23px]">{query.trim() ? 'No matching ingredients' : `Your ${location} is empty`}</Txt><Txt className="mt-2 text-center text-[15px] text-ink-soft">{query.trim() ? 'Try another search or choose a different location.' : 'Add an item to get your kitchen started.'}</Txt></View>} renderItem={({ item, index }) => {
        const f = freshness(item.expiresAt);
        const color = f === 'expired' ? C.berry : f === 'soon' ? C.honeyDark : f === 'fresh' ? C.leafDark : C.inkSoft;
        return <ListReveal index={index}><ReanimatedSwipeable friction={2} rightThreshold={64} overshootRight={false} onSwipeableOpen={() => usedUp(item.id)} renderRightActions={() => <View className="w-24 items-center justify-center rounded-xl bg-leaf" style={{ gap: 3 }}><Check size={23} color={C.white} /><Txt weight="extrabold" className="text-[12px] text-white">Used up</Txt></View>}>
          <View testID={`pantry-item-${item.id}`} accessible accessibilityLabel={`${item.name}, ${item.quantity}`} accessibilityActions={[{ name: 'activate', label: 'Mark used up' }]} onAccessibilityAction={() => usedUp(item.id)} className="min-h-[66px] flex-row items-center border-b border-cream-line bg-cream py-2.5" style={{ gap: 12 }}>
            <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: PASTELS[index % PASTELS.length] }}><Txt display italic weight="bold" style={{ fontSize: 21, color: C.inkSoft }}>{item.name.charAt(0)}</Txt></View>
            <View className="flex-1"><Txt weight="extrabold" className="text-[15px] leading-5">{item.name}</Txt><Txt className="mt-0.5 text-[13px] text-ink-soft">{item.quantity}</Txt></View>
            <View testID={`pantry-expiry-${item.id}`} accessibilityLabel={`${f}: ${expiryLabel(item.expiresAt)}`} className="flex-row items-center" style={{ gap: 5 }}>{f === 'none' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.muted }} /> : <StatusDot status={f === 'expired' ? 'today' : f} />}<Txt label weight="extrabold" style={{ fontSize: 13, color: f === 'expired' ? C.ink : color }}>{expiryLabel(item.expiresAt)}</Txt></View>
          </View>
        </ReanimatedSwipeable></ListReveal>;
      }} />
    </KeyboardAvoidingView>
  );
}
