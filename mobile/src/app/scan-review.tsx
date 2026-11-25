import { goBack } from '@/lib/nav';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useMemo, useState } from 'react';
import { TextInput, View, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { Plus, Trash2 } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { Button, PressableScale, Txt, GenieBubble } from '@/components/ui';
import { guessEmoji, kitchenGaps } from '@/lib/kitchen';
import { toast, useApp } from '@/lib/store';
import { haptic, fonts } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import type { DetectedItem, StorageLocation } from '@/lib/types';
import { quip } from '@/lib/quips';

const NEXT: Record<StorageLocation, StorageLocation> = { fridge: 'freezer', freezer: 'pantry', pantry: 'fridge' };
const LOC_LABEL: Record<StorageLocation, string> = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry' };

export default function ScanReview() {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  const draft = useApp((s) => s.scanDraft);
  const addDetectedItems = useApp((s) => s.addDetectedItems);
  const [items, setItems] = useState<DetectedItem[]>(draft);
  const insets = useSafeAreaInsets();
  const pantry = useApp((s) => s.pantry);
  const diets = useApp((s) => s.diets);
  const groceries = useApp((s) => s.groceries);
  const addGrocery = useApp((s) => s.addGrocery);
  // After the scan, check the whole kitchen (what's already there + this scan) for dinner gaps.
  const gaps = useMemo(() => kitchenGaps([...pantry, ...items.filter((i) => i.name.trim())], diets), [pantry, items, diets]);
  const onList = (n: string) => groceries.some((g) => !g.checked && g.name.toLowerCase() === n.toLowerCase());

  const update = (id: string, p: Partial<DetectedItem>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const valid = items.filter((i) => i.name.trim());

  const save = () => {
    if (!valid.length) return;
    Keyboard.dismiss();
    haptic.success();
    addDetectedItems(valid);
    toast(quip.stocked(valid.length));
    const counts: Record<StorageLocation, number> = { fridge: 0, freezer: 0, pantry: 0 };
    for (const item of valid) counts[item.location] += 1;
    const location = (['fridge', 'pantry', 'freezer'] as StorageLocation[]).sort((a, b) => counts[b] - counts[a])[0];
    if (!useApp.getState().onboarded) { goBack(); return; }
    router.dismissAll();
    router.navigate({ pathname: '/pantry', params: { location, stocked: String(Date.now()) } });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" testID="scan-review-screen" style={{ backgroundColor: C.cream }}>
      <SheetHeader title={`${items.length} items`} subtitle="Edit anything before adding." />
      <KeyboardAwareScrollView bottomOffset={16} testID="scan-review-form" style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
        <GenieBubble testID="scan-review-note" text={gaps.length ? `Heads up: for a full dinner you're missing ${gaps.map((g) => g.label).join(', ').replace(/, ([^,]*)$/, ' and $1')}. Did I miss something in the photo? Add it below.` : 'Keep only what’s really in your kitchen. Missing something? Add it below.'} />
        {gaps.length ? (
          <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }} testID="scan-review-gaps">
            {gaps.map((g) => {
              const listed = onList(g.buy);
              return (
                <PressableScale key={g.key} testID={`scan-gap-${g.key}`} accessibilityRole="button" accessibilityLabel={`Add ${g.buy} to the shopping list`} onPress={() => { if (listed) return; haptic.success(); addGrocery(g.buy); toast(`Added ${g.buy} to the list`); }}>
                  <View className="h-10 flex-row items-center rounded-full px-3.5" style={{ gap: 6, backgroundColor: listed ? C.plateSage : C.honey, borderWidth: 1.5, borderColor: C.ink }}>
                    <Plus size={15} color={C.ink} />
                    <Txt weight="extrabold" style={{ fontSize: 13 }}>{listed ? `${g.buy} on the list ✓` : `List: ${g.buy}`}</Txt>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ) : null}
        <View className="mt-4" style={{ gap: 8 }}>
          {items.map((it, idx) => (
            <Animated.View key={it.id} entering={reduceMotion ? undefined : FadeInDown.delay(idx * 40)} exiting={reduceMotion ? undefined : FadeOut} layout={reduceMotion ? undefined : LinearTransition}>
              <View className="flex-row items-center rounded-2xl p-2.5" style={[{ backgroundColor: C.paper }, { gap: 10 }]} testID={`detected-${idx}`}>
                <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: C.cream }}>
                  <Txt display italic className="text-[22px]" style={{ color: C.ink }}>{it.name.charAt(0).toUpperCase() || '?'}</Txt>
                </View>
                <View className="flex-1">
                  <TextInput
                    testID={`detected-name-${idx}`}
                    accessibilityLabel={`Item ${idx + 1} name`}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    value={it.name}
                    onChangeText={(t) => update(it.id, { name: t, emoji: guessEmoji(t) })}
                    style={{ fontFamily: fonts.bold, fontSize: 16, color: C.ink, minHeight: 44, paddingVertical: 8 }}
                    placeholder="Item name"
                    placeholderTextColor={C.inkFaint}
                  />
                  <TextInput
                    testID={`detected-quantity-${idx}`}
                    accessibilityLabel={`Item ${idx + 1} quantity`}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    value={it.quantity}
                    onChangeText={(t) => update(it.id, { quantity: t })}
                    style={{ fontFamily: fonts.semibold, fontSize: 16, color: C.inkSoft, minHeight: 44, paddingVertical: 8 }}
                    placeholder="Quantity"
                    placeholderTextColor={C.inkFaint}
                  />
                </View>
                <PressableScale
                  testID={`detected-loc-${idx}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Stored in ${LOC_LABEL[it.location]}, tap to change`}
                  onPress={() => update(it.id, { location: NEXT[it.location] })}
                >
                  <View className="h-11 min-w-[44px] items-center justify-center rounded-full px-3" style={{ backgroundColor: it.location === 'freezer' ? C.plateLilac : it.location === 'fridge' ? C.leafSoft : C.honeySoft }}>
                    <Txt label weight="extrabold" className="text-[13px]" style={{ color: C.ink }}>
                      {LOC_LABEL[it.location]}
                    </Txt>
                  </View>
                </PressableScale>
                <PressableScale testID={`detected-remove-${idx}`} accessibilityRole="button" accessibilityLabel={`Remove ${it.name}`} onPress={() => setItems((c) => c.filter((x) => x.id !== it.id))}>
                  <View className="h-11 w-11 items-center justify-center">
                    <Trash2 size={18} color={C.inkFaint} />
                  </View>
                </PressableScale>
              </View>
            </Animated.View>
          ))}
        </View>
        <PressableScale
          testID="detected-add"
          accessibilityRole="button"
          accessibilityLabel="Add an item"
          className="mt-2 self-start"
          onPress={() =>
            setItems((c) => [...c, { id: `d-new-${Date.now()}`, name: '', emoji: '🥫', quantity: '1', location: 'fridge', expiresInDays: 7 }])
          }
        >
          <View className="h-11 flex-row items-center" style={{ gap: 6 }}>
            <Plus size={18} color={C.leafDark} strokeWidth={2.8} />
            <Txt weight="extrabold" className="text-[15px]" style={{ color: C.leafDark }}>
              Add something I missed
            </Txt>
          </View>
        </PressableScale>
      </KeyboardAwareScrollView>
      <View className="px-5 pt-3" style={{ paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: C.line }}>
        <Button testID="scan-add-all" label={`Add ${valid.length} items to kitchen`} onPress={save} disabled={valid.length === 0} />
      </View>
    </KeyboardAvoidingView>
  );
}
