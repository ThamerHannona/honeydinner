import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { goBack } from '@/lib/nav';
import React, { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetHeader } from '@/components/app';
import { Button, Chip, Txt } from '@/components/ui';
import { guessEmoji } from '@/lib/kitchen';
import { expiryInputFromDays, PANTRY_LOCATIONS, parseExpiryDate } from '@/lib/pantry';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import type { StorageLocation } from '@/lib/types';

export default function PantryAdd() {
  const { C, inputStyle } = useTheme();
  const { location } = useLocalSearchParams<{ location?: string }>();
  const addPantryItem = useApp((s) => s.addPantryItem);
  const insets = useSafeAreaInsets();
  const quantityRef = useRef<TextInput>(null);
  const [name, setName] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [loc, setLoc] = useState<StorageLocation>(location === 'freezer' || location === 'pantry' ? location : 'fridge');
  const [expiry, setExpiry] = useState<string>(expiryInputFromDays(7));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) { setError('Please enter an item name.'); return; }
    if (!qty.trim()) { setError('Please enter a quantity, like 2 or 500 g.'); return; }
    const expiresAt = expiry.trim() ? parseExpiryDate(expiry.trim()) : null;
    if (expiry.trim() && !expiresAt) { setError('Enter a real expiry date in YYYY-MM-DD format.'); return; }
    Keyboard.dismiss();
    haptic.success();
    addPantryItem({ name: name.trim(), emoji: guessEmoji(name), quantity: qty.trim(), location: loc, expiresAt });
    toast(`${name.trim()} added to ${loc === 'fridge' ? 'Fridge' : loc === 'freezer' ? 'Freezer' : 'Pantry'}.`);
    if (router.canGoBack()) goBack();
    else router.replace('/pantry');
  };

  return (
    <View className="flex-1" testID="pantry-add-screen" style={{ backgroundColor: C.cream }}>
      <SheetHeader title="Add an item" subtitle="A little less guessing. A little less waste." />
      <KeyboardAwareScrollView bottomOffset={16} style={{ flex: 1 }} testID="pantry-add-form" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Txt label weight="extrabold" className="mb-2 mt-3 text-[15px] uppercase tracking-widest" style={{ color: C.inkSoft }}>Name</Txt>
        <TextInput testID="pantry-add-name" accessibilityLabel="Item name" value={name} onChangeText={(value) => { setName(value); setError(null); }} placeholder="e.g. Avocados" placeholderTextColor={C.inkFaint} style={inputStyle} returnKeyType="next" onSubmitEditing={() => quantityRef.current?.focus()} />
        <Txt label weight="extrabold" className="mb-2 mt-5 text-[15px] uppercase tracking-widest" style={{ color: C.inkSoft }}>Quantity</Txt>
        <TextInput ref={quantityRef} testID="pantry-add-qty" accessibilityLabel="Quantity" value={qty} onChangeText={(value) => { setQty(value); setError(null); }} placeholder="e.g. 3, 500 g, 1 bag" placeholderTextColor={C.inkFaint} style={inputStyle} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
        <Txt label weight="extrabold" className="mb-2 mt-5 text-[15px] uppercase tracking-widest" style={{ color: C.inkSoft }}>Location</Txt>
        <View className="flex-row" style={{ gap: 8 }}>
          {PANTRY_LOCATIONS.map((segment) => <Chip key={segment.key} testID={`pantry-add-loc-${segment.key}`} label={segment.label} active={loc === segment.key} onPress={() => setLoc(segment.key)} />)}
        </View>
        <Txt label weight="extrabold" className="mb-2 mt-5 text-[15px] uppercase tracking-widest" style={{ color: C.inkSoft }}>Expiry date</Txt>
        <TextInput testID="pantry-add-expiry" accessibilityLabel="Expiry date, YYYY-MM-DD" value={expiry} onChangeText={(value) => { setExpiry(value); setError(null); }} placeholder="YYYY-MM-DD" placeholderTextColor={C.inkFaint} autoCapitalize="none" autoCorrect={false} maxLength={10} style={inputStyle} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
        <Txt className="mt-2 text-[12px]" style={{ color: C.inkSoft }}>Year-month-day. Leave blank for no expiry date.</Txt>
        <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
          {[{ label: '3 days', days: 3 }, { label: '1 week', days: 7 }, { label: '1 month', days: 30 }].map((option) => <Chip key={option.days} testID={`pantry-add-expiry-${option.days}`} label={option.label} active={expiry === expiryInputFromDays(option.days)} onPress={() => { setExpiry(expiryInputFromDays(option.days)); setError(null); Keyboard.dismiss(); }} />)}
          <Chip testID="pantry-add-no-expiry" label="No expiry" active={!expiry} onPress={() => { setExpiry(''); setError(null); Keyboard.dismiss(); }} />
        </View>
        {error ? <View testID="pantry-add-error" accessibilityRole="alert" className="mt-4 rounded-xl p-3" style={{ backgroundColor: C.berrySoft }}><Txt weight="bold" className="text-[14px]" style={{ color: C.berry }}>{error}</Txt></View> : null}
        <View className="mt-6"><Button testID="pantry-add-save" label="Add to Pantry" onPress={save} /></View>
      </KeyboardAwareScrollView>
    </View>
  );
}
