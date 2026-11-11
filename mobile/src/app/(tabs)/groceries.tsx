import { useKitchenRefresh } from '@/lib/use-kitchen-refresh';
import { useTheme } from '@/lib/theme-context';
import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Check, Plus } from 'lucide-react-native';
import { ScreenHeader } from '@/components/app';
import { PressableScale, Txt, HardShadow } from '@/components/ui';
import { formatQty } from '@/lib/kitchen';
import { toast, useApp } from '@/lib/store';
import { fonts, shape } from '@/lib/theme';
import type { Aisle, Member } from '@/lib/types';

const AISLES: Aisle[] = ['Produce', 'Meat & Fish', 'Pantry', 'Dairy', 'Frozen', 'Other'];

function MemberInitial({ member, testID, size = 27 }: { member?: Member; testID: string; size?: number }) {
  const { C } = useTheme();
  return (
    <View testID={testID} accessibilityLabel={member?.name ?? 'Household'} className="items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: member?.isMe ? C.selectedCard : C.plateSage }}>
      <Txt weight="extrabold" style={{ fontSize: size * 0.4, color: member?.isMe ? C.honeyText : C.leafDark }}>{member?.initials ?? '?'}</Txt>
    </View>
  );
}

export default function GroceriesScreen() {
  const { C } = useTheme();
  const { refreshing, onRefresh } = useKitchenRefresh();
  const groceries = useApp((s) => s.groceries);
  const recipes = useApp((s) => s.recipes);
  const members = useApp((s) => s.members);
  const toggleGrocery = useApp((s) => s.toggleGrocery);
  // The existing manual-add store action also handles aisle guessing and duplicates.
  const addManualGrocery = useApp((s) => s.addGrocery);
  const [newItem, setNewItem] = useState<string>('');
  const [storeMode, setStoreMode] = useState<boolean>(false);
  const remaining = groceries.filter((item) => !item.checked).length;
  const done = groceries.length - remaining;
  const addItem = () => {
    const name = newItem.trim();
    if (!name) return;
    addManualGrocery(name);
    setNewItem('');
    Keyboard.dismiss();
    toast(`${name} added to your list`);
  };

  return (
    <KeyboardAvoidingView testID="groceries-screen" className="flex-1 bg-cream" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View testID="groceries-summary">
        <ScreenHeader title="Our list" eyebrow={`${remaining} to get · ${done} done`} right={
          <PressableScale testID="groceries-shared-household" accessibilityRole="button" accessibilityLabel={`Shared list with ${members.map((member) => member.name).join(' and ')}`} onPress={() => router.push('/profile')}>
            <View className="flex-row items-center rounded-full bg-white px-2 py-2" style={{ gap: 5, borderWidth: 1, borderColor: C.line }}>
              {members.slice(0, 2).map((member) => <MemberInitial key={member.id} member={member} testID={`groceries-shared-avatar-${member.id}`} size={29} />)}
              <Txt label weight="extrabold" style={{ fontSize: 13, marginHorizontal: 5 }}>Shared</Txt>
            </View>
          </PressableScale>
        } />
      </View>
      {storeMode ? (
        <View testID="groceries-store-mode" className="mx-5 mb-3 rounded-2xl px-4 py-3" style={{ backgroundColor: C.plateSage, borderWidth: 1, borderColor: C.leafDark }}>
          <Txt weight="extrabold" style={{ color: C.leafDark, fontSize: 14 }}>Shopping mode · {remaining} left</Txt>
          <Txt style={{ color: C.inkSoft, fontSize: 12, marginTop: 3 }}>Tick as you go. Checked items go into your kitchen.</Txt>
        </View>
      ) : null}
      <View className="mx-5 mb-3 mt-1 flex-row items-center rounded-[21px] bg-white" style={{ borderWidth: 1, borderColor: C.hairline }} testID="groceries-add-container">
        <PressableScale testID="groceries-add-button" accessibilityRole="button" accessibilityLabel="Add item to list" accessibilityState={{ disabled: !newItem.trim() }} disabled={!newItem.trim()} onPress={addItem} style={{ width: 46, height: 54, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={19} color={newItem.trim() ? C.ink : C.inkSoft} />
        </PressableScale>
        <TextInput testID="groceries-add-input" accessibilityLabel="New grocery item" value={newItem} onChangeText={setNewItem} onSubmitEditing={addItem} placeholder="Add an item…" placeholderTextColor={C.inkSoft} returnKeyType="done" style={{ flex: 1, height: 54, paddingRight: 15, fontFamily: fonts.semibold, fontSize: 16, color: C.ink }} />
      </View>
      <ScrollView testID="groceries-data" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.inkSoft} colors={[C.forest]} />} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 5, paddingBottom: 20 }}>
        {AISLES.map((aisle) => {
          const items = groceries.filter((item) => item.aisle === aisle).sort((a, b) => Number(a.checked) - Number(b.checked));
          if (items.length === 0) return null;
          const aisleId = aisle.toLowerCase().replace(/[^a-z]+/g, '-');
          return (
            <View key={aisle} testID={`groceries-aisle-${aisleId}`} className="mb-5">
              <Txt label weight="extrabold" accessibilityRole="header" style={{ fontSize: 15, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>{aisle}</Txt>
              {items.map((item, index) => {
                const member = members.find((person) => person.id === item.addedBy);
                const recipeNames = item.recipeIds.map((id) => recipes.find((recipe) => recipe.id === id)?.title).filter((title): title is string => !!title);
                const quantity = [item.qty === null ? null : formatQty(item.qty), item.unit].filter(Boolean).join(' ');
                const context = recipeNames.length ? `For ${recipeNames.join(' & ')}` : 'For the household';
                const attribution = member && !member.isMe ? ` · added by ${member.name}` : '';
                return (
                  <PressableScale key={item.id} revealIndex={index} testID={`grocery-item-${item.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }} accessibilityLabel={`${item.name}${quantity ? `, ${quantity}` : ''}, ${context}`} onPress={() => toggleGrocery(item.id)} scaleTo={0.99}>
                    <View className="flex-row items-center py-3" style={{ gap: 13, minHeight: storeMode ? 79 : 68, borderBottomWidth: 1, borderBottomColor: C.hairline }}>
                      <View testID={`grocery-checkbox-${item.id}`} className="items-center justify-center rounded-full" style={{ width: storeMode ? 32 : shape.checkbox, height: storeMode ? 32 : shape.checkbox, borderWidth: shape.checkboxBorder, borderColor: C.checkboxBorder, backgroundColor: item.checked ? C.cream : C.transparent }}>
                        {item.checked ? <Check size={18} color={C.ink} strokeWidth={3} /> : null}
                      </View>
                      <View className="flex-1">
                        <Txt testID={`grocery-name-${item.id}`} weight="extrabold" style={{ fontSize: storeMode ? 19 : 16, lineHeight: storeMode ? 25 : 21, color: item.checked ? C.inkSoft : C.ink, textDecorationLine: item.checked ? 'line-through' : 'none' }}>{item.name}{quantity ? ` × ${quantity}` : null}</Txt>
                        <Txt testID={`grocery-context-${item.id}`} style={{ marginTop: 1, fontSize: 12, lineHeight: 17, color: C.inkSoft }}>{context}{attribution}</Txt>
                      </View>
                      <MemberInitial member={member} testID={`grocery-member-${item.id}`} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          );
        })}
        {groceries.length === 0 ? (
          <View testID="groceries-empty-state" className="py-10">
            <Txt display weight="bold" style={{ fontSize: 27 }}>A little room on the list.</Txt>
            <Txt className="mt-2" style={{ color: C.inkSoft }}>Add an item above, or add missing ingredients from a recipe.</Txt>
          </View>
        ) : remaining === 0 ? (
          <View testID="groceries-all-done" className="pb-5">
            <Txt display weight="bold" style={{ fontSize: 25 }}>Everything's in the bag.</Txt>
            <Txt className="mt-1" style={{ color: C.inkSoft, fontSize: 13 }}>Your checked items are already in your kitchen.</Txt>
          </View>
        ) : null}
      </ScrollView>
      <View className="px-5 pb-4 pt-3" testID="groceries-shopping-actions">
        <PressableScale testID={storeMode ? 'groceries-done-shopping' : 'groceries-start-shopping'} accessibilityRole="button" accessibilityLabel={storeMode ? 'Done shopping' : "I'm at the store"} onPress={() => { setStoreMode(!storeMode); Keyboard.dismiss(); if (storeMode) toast('Shopping finished. Your list is saved.'); }}>
          <HardShadow color={C.honey} radius={999}><View className="items-center justify-center rounded-full" style={{ height: 57, backgroundColor: C.ink }}>
            <Txt weight="extrabold" style={{ fontSize: 16, color: C.cream }}>{storeMode ? 'Done shopping' : "I'm at the store"}</Txt>
          </View></HardShadow>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}
