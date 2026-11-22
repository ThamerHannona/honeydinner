import { goBack } from '@/lib/nav';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useState } from 'react';
import { Switch, TextInput, View, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchRecipe } from '@/lib/kitchen';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { Camera, ExternalLink, Minus, Plus, Trash2 } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { PlatformBadge } from '@/components/brand';
import { Button, PressableScale, Txt, AView, GenieBubble } from '@/components/ui';
import { genieSaved } from '@/lib/genie';
import { blankDraft, PLATFORM_LABEL } from '@/lib/services/kitchen-ai';
import { toast, useApp } from '@/lib/store';
import { maybeShowGentlePaywall } from '@/lib/plus';
import { haptic, fonts } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import type { Ingredient, RecipeDraft } from '@/lib/types';

const label = 'mb-2 mt-6 text-[15px] uppercase tracking-widest';

export default function ImportReview() {
  const { C, inputStyle } = useTheme();
  const reduceMotion = useReducedMotion();
  const initial = useApp((s) => s.importDraft);
  const saveRecipe = useApp((s) => s.saveRecipe);
  const addToGroceries = useApp((s) => s.addToGroceries);
  const pantry = useApp((s) => s.pantry);
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<RecipeDraft>(() => initial ?? blankDraft());
  const [addMissing, setAddMissing] = useState<boolean>(true);
  const isManual = !initial?.title;
  const missing = matchRecipe({ ...d, id: 'draft', saved: false, importedAt: null, createdAt: '' }, pantry).missing;

  const patch = (p: Partial<RecipeDraft>) => setD((cur) => ({ ...cur, ...p }));
  const setIng = (idx: number, p: Partial<Ingredient>) =>
    patch({ ingredients: d.ingredients.map((x, i) => (i === idx ? { ...x, ...p } : x)) });
  const setStep = (idx: number, text: string) => patch({ steps: d.steps.map((x, i) => (i === idx ? text : x)) });

  const changePhoto = async () => {
    Keyboard.dismiss();
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    const uri = res.assets?.[0]?.uri;
    if (!res.canceled && uri) patch({ image: uri });
  };

  const canSave = d.title.trim().length > 0 && d.ingredients.some((i) => i.name.trim());

  const save = () => {
    if (!canSave) return;
    Keyboard.dismiss();
    haptic.success();
    const id = saveRecipe(d, !isManual);
    if (addMissing && missing.length) addToGroceries(missing, id);
    toast(genieSaved(d.title.trim()));
    if (!useApp.getState().onboarded) { maybeShowGentlePaywall(!isManual); goBack(); return; }
    router.dismissAll();
    router.navigate('/recipes');
    maybeShowGentlePaywall(!isManual);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" testID="import-review-screen" style={{ backgroundColor: C.cream }}>
      <SheetHeader title={isManual ? 'Type it in' : 'Save to Honey, Dinner?'} subtitle={isManual ? 'Make it one of your keepers.' : 'Preview recipe · review and edit before saving.'} />
      <KeyboardAwareScrollView bottomOffset={16} testID="import-review-form" style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <GenieBubble testID="review-ready-banner"><Txt weight="bold" style={{ color: C.honeyOnForest }}>A recipe worth keeping.</Txt>{'\n'}{isManual ? 'Add your ingredients and steps below.' : d.note ?? 'Pulled from the post. Everything below is editable.'}</GenieBubble>

        {/* Photo */}
        <View className="mt-5 items-center rounded-[24px] border py-4" style={{ borderColor: C.ink, backgroundColor: C.leafSoft }}>
          <View className="rounded-full border p-2" style={{ borderColor: C.ink, backgroundColor: C.paper }}><Image source={{ uri: d.image }} style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: C.creamDeep }} contentFit="cover" /></View>
          <PressableScale testID="review-change-photo" accessibilityRole="button" accessibilityLabel="Change recipe photo" onPress={changePhoto} style={{ position: 'absolute', right: 10, bottom: 10 }}>
            <View className="h-11 flex-row items-center rounded-full px-3.5" style={[{ backgroundColor: C.paperOverlay }, { gap: 6 }]}>
              <Camera size={16} color={C.ink} />
              <Txt weight="extrabold" className="text-[13px]" style={{ color: C.ink }}>
                Change photo
              </Txt>
            </View>
          </PressableScale>
        </View>

        {/* Source */}
        <View className="mt-4 flex-row items-center rounded-2xl p-3" style={[{ backgroundColor: C.paper }, { gap: 10 }]} testID="review-source">
          <PlatformBadge platform={d.source.platform} size={34} />
          <View className="flex-1">
            <Txt weight="bold" className="text-[12px]" style={{ color: C.inkFaint }}>
              From {PLATFORM_LABEL[d.source.platform]}
            </Txt>
            <TextInput
              testID="review-creator"
              accessibilityLabel="Recipe creator"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              value={d.source.creator ?? ''}
              onChangeText={(t) => patch({ source: { ...d.source, creator: t || null } })}
              placeholder="@creator"
              placeholderTextColor={C.inkFaint}
              autoCapitalize="none"
              style={{ fontFamily: fonts.bold, fontSize: 16, color: C.ink, minHeight: 44, paddingVertical: 8 }}
            />
          </View>
          {d.source.url ? (
            <PressableScale testID="review-view-original" accessibilityRole="button" accessibilityLabel="View original recipe" onPress={() => d.source.url && WebBrowser.openBrowserAsync(d.source.url)}>
              <View className="h-11 flex-row items-center rounded-xl px-3" style={{ backgroundColor: C.leafSoft, gap: 5 }}>
                <Txt weight="extrabold" className="text-[13px]" style={{ color: C.leafDark }}>
                  View original
                </Txt>
                <ExternalLink size={14} color={C.leafDark} />
              </View>
            </PressableScale>
          ) : null}
        </View>

        <Txt label weight="extrabold" className={label} style={{ color: C.inkFaint }}>
          Title
        </Txt>
        <TextInput
          testID="review-title"
          accessibilityLabel="Recipe title"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          value={d.title}
          onChangeText={(t) => patch({ title: t })}
          placeholder="What's it called?"
          placeholderTextColor={C.inkFaint}
          style={[inputStyle, { fontFamily: fonts.display, fontSize: 19 }]}
        />

        <View className="mt-2 flex-row" style={{ gap: 12 }}>
          <Stepper label="Servings" value={d.servings} onChange={(v) => patch({ servings: Math.max(1, v) })} testID="review-servings" />
          <Stepper label="Minutes" value={d.cookTime} step={5} onChange={(v) => patch({ cookTime: Math.max(5, v) })} testID="review-time" />
        </View>

        <Txt label weight="extrabold" className={label} style={{ color: C.inkFaint }}>
          Ingredients · {d.ingredients.filter((i) => i.name.trim()).length}
        </Txt>
        <View style={{ gap: 8 }}>
          {d.ingredients.map((ing, idx) => (
            <AView key={idx} entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut} layout={reduceMotion ? undefined : LinearTransition} className="flex-row items-center" style={{ gap: 6 }}>
              <TextInput
                testID={`review-ingredient-qty-${idx}`}
                accessibilityLabel={`Ingredient ${idx + 1} quantity`}
                value={ing.qty === null ? '' : String(ing.qty)}
                onChangeText={(t) => {
                  const n = parseFloat(t.replace(',', '.'));
                  setIng(idx, { qty: t.trim() === '' || Number.isNaN(n) ? null : n });
                }}
                placeholder="Qty"
                keyboardType="decimal-pad"
                placeholderTextColor={C.inkFaint}
                style={[inputStyle, { width: 56, paddingHorizontal: 6, textAlign: 'center', fontSize: 15 }]}
              />
              <TextInput
                testID={`review-ingredient-unit-${idx}`}
                accessibilityLabel={`Ingredient ${idx + 1} unit`}
                value={ing.unit}
                onChangeText={(t) => setIng(idx, { unit: t })}
                placeholder="Unit"
                autoCapitalize="none"
                placeholderTextColor={C.inkFaint}
                style={[inputStyle, { width: 74, paddingHorizontal: 8, fontSize: 14 }]}
              />
              <TextInput
                testID={`review-ingredient-${idx}`}
                accessibilityLabel={`Ingredient ${idx + 1} name`}
                value={ing.name}
                onChangeText={(t) => setIng(idx, { name: t })}
                placeholder="Ingredient"
                placeholderTextColor={C.inkFaint}
                style={[inputStyle, { flex: 1, minWidth: 0, paddingHorizontal: 12, fontSize: 15 }]}
              />
              <PressableScale
                testID={`review-remove-ingredient-${idx}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${ing.name || 'ingredient'}`}
                onPress={() => patch({ ingredients: d.ingredients.filter((_, i) => i !== idx) })}
                hitSlop={4}
              >
                <View className="h-11 w-11 items-center justify-center">
                  <Trash2 size={18} color={C.inkFaint} />
                </View>
              </PressableScale>
            </AView>
          ))}
        </View>
        <AddRow testID="review-add-ingredient" label="Add ingredient" onPress={() => patch({ ingredients: [...d.ingredients, { name: '', qty: null, unit: '' }] })} />

        <Txt label weight="extrabold" className={label} style={{ color: C.inkFaint }}>
          Steps
        </Txt>
        <View style={{ gap: 8 }}>
          {d.steps.map((s, idx) => (
            <AView key={idx} entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut} layout={reduceMotion ? undefined : LinearTransition} className="flex-row items-start" style={{ gap: 8 }}>
              <View className="mt-3 h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: C.ink }}>
                <Txt weight="extrabold" className="text-[13px]" style={{ color: C.paper }}>
                  {idx + 1}
                </Txt>
              </View>
              <TextInput
                testID={`review-step-${idx}`}
                accessibilityLabel={`Recipe step ${idx + 1}`}
                value={s}
                onChangeText={(t) => setStep(idx, t)}
                multiline
                placeholder="Describe this step"
                placeholderTextColor={C.inkFaint}
                style={[inputStyle, { flex: 1, minWidth: 0, height: undefined, minHeight: 52, paddingTop: 14, paddingBottom: 14, fontSize: 15, lineHeight: 21 }]}
              />
              <PressableScale testID={`review-remove-step-${idx}`} accessibilityRole="button" accessibilityLabel={`Remove step ${idx + 1}`} onPress={() => patch({ steps: d.steps.filter((_, i) => i !== idx) })}>
                <View className="mt-1.5 h-11 w-11 items-center justify-center">
                  <Trash2 size={18} color={C.inkFaint} />
                </View>
              </PressableScale>
            </AView>
          ))}
        </View>
        <AddRow testID="review-add-step" label="Add step" onPress={() => patch({ steps: [...d.steps, ''] })} />

        <PressableScale testID="review-add-missing" accessibilityRole="switch" accessibilityLabel="Add missing items to our list" accessibilityState={{ checked: addMissing }} onPress={() => setAddMissing(!addMissing)}>
          <View className="mt-6 flex-row items-center justify-between border-t pt-4" style={{ borderColor: C.line, gap: 12, minHeight: 60 }}>
            <View className="flex-1"><Txt weight="bold" className="text-[15px]" style={{ color: C.ink }}>Add missing items to our list</Txt><Txt className="mt-1 text-[12px]" style={{ color: C.inkSoft }}>{missing.length ? `${missing.length} items your kitchen needs` : 'You have every ingredient'}</Txt></View>
            <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Switch accessible={false} value={addMissing} trackColor={{ false: C.line, true: C.leaf }} thumbColor={C.onInk} /></View>
          </View>
        </PressableScale>
      </KeyboardAwareScrollView>
      <View className="border-t px-5 pt-3" style={[{ borderColor: C.line, backgroundColor: C.cream }, { paddingBottom: insets.bottom + 16 }]}><Button testID="review-save" label="Save recipe" onPress={save} disabled={!canSave} /></View>
    </KeyboardAvoidingView>
  );
}

function Stepper({
  label: l,
  value,
  onChange,
  step = 1,
  testID,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  testID?: string;
}) {
  const { C } = useTheme();
  return (
    <View className="flex-1">
      <Txt label weight="extrabold" className={label} style={{ color: C.inkFaint }}>
        {l}
      </Txt>
      <View className="h-[52px] flex-row items-center justify-between rounded-2xl px-1.5" style={[{ backgroundColor: C.paper }, { borderWidth: 1, borderColor: C.line }]} testID={testID}>
        <PressableScale testID={`${testID}-decrease`} accessibilityRole="button" accessibilityLabel={`Less ${l}`} onPress={() => onChange(value - step)}>
          <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: C.creamDeep }}>
            <Minus size={18} color={C.ink} />
          </View>
        </PressableScale>
        <Txt weight="extrabold" className="text-[18px]" style={{ color: C.ink }}>
          {value}
        </Txt>
        <PressableScale testID={`${testID}-increase`} accessibilityRole="button" accessibilityLabel={`More ${l}`} onPress={() => onChange(value + step)}>
          <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: C.creamDeep }}>
            <Plus size={18} color={C.ink} />
          </View>
        </PressableScale>
      </View>
    </View>
  );
}

function AddRow({ label: l, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const { C } = useTheme();
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={l} onPress={onPress} className="mt-2 self-start">
      <View className="h-11 flex-row items-center" style={{ gap: 6 }}>
        <Plus size={18} color={C.leafDark} strokeWidth={2.8} />
        <Txt weight="extrabold" className="text-[15px]" style={{ color: C.leafDark }}>
          {l}
        </Txt>
      </View>
    </PressableScale>
  );
}
