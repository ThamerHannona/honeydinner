// FridgeGenie's "build it your way" panel: talk to FridgeGenie, pick the ingredients to cook with,
// and set macro targets (e.g. 50 g protein, under 60 g carbs) per serving.
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming, useReducedMotion } from 'react-native-reanimated';
import { Check, Mic, Plus, Square, X } from 'lucide-react-native';
import { PressableScale, Txt } from '@/components/ui';
import { useTheme } from '@/lib/theme-context';
import { haptic } from '@/lib/theme';
import { freshness, isProtein } from '@/lib/kitchen';
import type { PantryItem } from '@/lib/types';
import type { MacroTargets } from '@/lib/use-dictation';

export const MACRO_PRESETS: { id: string; label: string; set: MacroTargets }[] = [
  { id: 'p40', label: '40g+ protein', set: { proteinMin: 40 } },
  { id: 'p50', label: '50g+ protein', set: { proteinMin: 50 } },
  { id: 'c30', label: 'Under 30g carbs', set: { carbsMax: 30 } },
  { id: 'c60', label: 'Under 60g carbs', set: { carbsMax: 60 } },
  { id: 'k500', label: 'Under 500 cal', set: { caloriesMax: 500 } },
  { id: 'k700', label: 'Under 700 cal', set: { caloriesMax: 700 } },
];

export function macroSummary(m: MacroTargets): string {
  return [
    m.proteinMin ? `${m.proteinMin}g+ protein` : '',
    m.carbsMax !== undefined ? `≤${m.carbsMax}g carbs` : '',
    m.caloriesMax ? `≤${m.caloriesMax} cal` : '',
    m.fatMax !== undefined ? `≤${m.fatMax}g fat` : '',
  ].filter(Boolean).join(' · ');
}

export function TalkButton({ listening, partial, onStart, onStop }: { listening: boolean; partial: string; onStart: () => void; onStop: () => void }) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = listening && !reduced ? withRepeat(withTiming(1.18, { duration: 650 }), -1, true) : withTiming(1);
  }, [listening, reduced, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: listening ? 0.35 : 0 }));
  return (
    <View className="mx-5 mt-5">
      <PressableScale testID="genie-talk" accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Talk to FridgeGenie'} onPress={() => { haptic.tap(); if (listening) onStop(); else onStart(); }}>
        <View className="flex-row items-center rounded-[26px] p-4" style={{ backgroundColor: listening ? C.forest : C.ink, gap: 14 }}>
          <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: C.honey }, ring]} />
            <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: C.honey }}>
              {listening ? <Square size={18} color={C.ink} fill={C.ink} /> : <Mic size={22} color={C.ink} />}
            </View>
          </View>
          <View className="flex-1">
            <Txt weight="extrabold" style={{ color: C.cream, fontSize: 17 }}>{listening ? 'Listening… tap when done' : 'Talk to FridgeGenie'}</Txt>
            <Txt weight="semibold" numberOfLines={3} style={{ color: listening ? C.onGreen : '#FFFFFFB3', fontSize: 13, marginTop: 2 }}>
              {listening ? (partial ? `“${partial}”` : 'Say what you have or what you want…') : '“Chicken and rice, 50 grams of protein, something spicy”'}
            </Txt>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

export function CookWithPicker({
  pantry,
  picked,
  onChange,
  only,
  onOnly,
}: {
  pantry: PantryItem[];
  picked: string[];
  onChange: (next: string[]) => void;
  only: boolean;
  onOnly: (v: boolean) => void;
}) {
  const { C } = useTheme();
  const [extra, setExtra] = useState<string>('');
  const [showAll, setShowAll] = useState<boolean>(false);
  // proteins first, then what's about to expire, then the rest
  const options = useMemo(() => {
    const seen = new Set<string>();
    const rank = (p: PantryItem) => (isProtein(p.name) ? 0 : freshness(p.expiresAt) === 'soon' ? 1 : 2);
    return [...pantry]
      .filter((p) => freshness(p.expiresAt) !== 'expired')
      .sort((a, b) => rank(a) - rank(b))
      .map((p) => p.name)
      .filter((n) => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [pantry]);
  const extras = picked.filter((p) => !options.some((o) => o.toLowerCase() === p.toLowerCase()));
  const visible = showAll ? options : options.slice(0, 14);
  const isOn = (n: string) => picked.some((p) => p.toLowerCase() === n.toLowerCase());
  const toggle = (n: string) => {
    haptic.select();
    onChange(isOn(n) ? picked.filter((p) => p.toLowerCase() !== n.toLowerCase()) : [...picked, n]);
  };
  const addExtra = () => {
    const n = extra.trim();
    if (!n) return;
    if (!isOn(n)) onChange([...picked, n]);
    setExtra('');
  };
  return (
    <View className="mt-7 px-5" testID="genie-cook-with">
      <View className="mb-3 flex-row items-center justify-between">
        <Txt label weight="extrabold" className="text-[13px] uppercase tracking-widest" style={{ color: C.inkSoft }}>Cook with{picked.length ? ` · ${picked.length}` : ''}</Txt>
        {picked.length ? (
          <PressableScale testID="genie-cook-with-clear" accessibilityRole="button" accessibilityLabel="Clear picked ingredients" onPress={() => onChange([])}>
            <Txt weight="extrabold" className="text-[13px]" style={{ color: C.leafDark }}>Clear</Txt>
          </PressableScale>
        ) : null}
      </View>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {[...extras, ...visible].map((n) => {
          const on = isOn(n);
          return (
            <PressableScale key={n} testID={`cook-with-${n}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => toggle(n)}>
              <View className="flex-row items-center rounded-full px-3 py-2" style={{ gap: 5, backgroundColor: on ? C.ink : C.paper, borderWidth: 1.5, borderColor: on ? C.ink : C.hairline }}>
                {on ? <Check size={13} color={C.honey} strokeWidth={3} /> : null}
                <Txt weight="bold" className="text-[13px]" style={{ color: on ? C.cream : C.ink }}>{n}</Txt>
              </View>
            </PressableScale>
          );
        })}
        {options.length > 14 ? (
          <PressableScale testID="cook-with-more" accessibilityRole="button" onPress={() => setShowAll(!showAll)}>
            <View className="rounded-full px-3 py-2" style={{ borderWidth: 1.5, borderColor: C.hairline }}>
              <Txt weight="extrabold" className="text-[13px]" style={{ color: C.leafDark }}>{showAll ? 'Less' : `+${options.length - 14} more`}</Txt>
            </View>
          </PressableScale>
        ) : null}
      </View>
      <View className="mt-3 flex-row items-center rounded-full bg-white px-4" style={{ borderWidth: 1, borderColor: C.hairline, height: 46, gap: 8 }}>
        <TextInput
          testID="cook-with-input"
          value={extra}
          onChangeText={setExtra}
          onSubmitEditing={addExtra}
          placeholder={options.length ? 'Add another ingredient…' : 'Type an ingredient you have…'}
          placeholderTextColor={C.inkSoft}
          returnKeyType="done"
          style={{ flex: 1, fontSize: 15, color: C.ink }}
        />
        {extra.trim() ? (
          <PressableScale testID="cook-with-add" accessibilityRole="button" accessibilityLabel="Add ingredient" onPress={addExtra}>
            <Plus size={20} color={C.leafDark} />
          </PressableScale>
        ) : null}
      </View>
      {picked.length ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <PressableScale testID="cook-with-only" accessibilityRole="switch" accessibilityState={{ checked: only }} onPress={() => { haptic.tap(); onOnly(!only); }} className="mt-3 self-start">
            <View className="flex-row items-center rounded-full px-3 py-2" style={{ gap: 8, backgroundColor: only ? C.honey : 'transparent', borderWidth: 1.5, borderColor: only ? C.honey : C.hairline }}>
              <View className="h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: only ? C.ink : 'transparent', borderWidth: 1.5, borderColor: C.ink }}>
                {only ? <Check size={12} color={C.honey} strokeWidth={3} /> : null}
              </View>
              <Txt weight="bold" className="text-[13px]" style={{ color: only ? C.onHoney : C.ink }}>Only these (plus salt, oil & spices)</Txt>
            </View>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function MacroPicker({ value, onChange }: { value: MacroTargets; onChange: (m: MacroTargets) => void }) {
  const { C } = useTheme();
  const [custom, setCustom] = useState<boolean>(false);
  const active = (set: MacroTargets) => (Object.keys(set) as (keyof MacroTargets)[]).every((k) => value[k] === set[k]);
  const toggle = (set: MacroTargets) => {
    haptic.select();
    const key = Object.keys(set)[0] as keyof MacroTargets;
    const next = { ...value };
    if (active(set)) delete next[key];
    else Object.assign(next, set);
    onChange(next);
  };
  const field = (key: keyof MacroTargets, label: string, unit: string) => (
    <View className="flex-1 rounded-2xl bg-white px-3 py-2" style={{ borderWidth: 1, borderColor: C.hairline }}>
      <Txt weight="bold" className="text-[11px] uppercase" style={{ color: C.inkSoft }}>{label}</Txt>
      <View className="flex-row items-baseline" style={{ gap: 3 }}>
        <TextInput
          testID={`macro-input-${key}`}
          value={value[key] !== undefined ? String(value[key]) : ''}
          onChangeText={(t) => {
            const n = parseInt(t.replace(/\D/g, ''), 10);
            const next = { ...value };
            if (Number.isFinite(n)) next[key] = n; else delete next[key];
            onChange(next);
          }}
          keyboardType="number-pad"
          placeholder="–"
          placeholderTextColor={C.inkSoft}
          style={{ fontSize: 20, fontWeight: '800', color: C.ink, minWidth: 34 }}
        />
        <Txt weight="bold" className="text-[13px]" style={{ color: C.inkSoft }}>{unit}</Txt>
      </View>
    </View>
  );
  const summary = macroSummary(value);
  return (
    <View className="mt-7 px-5" testID="genie-macros">
      <View className="mb-3 flex-row items-center justify-between">
        <Txt label weight="extrabold" className="text-[13px] uppercase tracking-widest" style={{ color: C.inkSoft }}>Macros per serving</Txt>
        {summary ? (
          <PressableScale testID="macro-clear" accessibilityRole="button" accessibilityLabel="Clear macro targets" onPress={() => onChange({})}>
            <View className="flex-row items-center" style={{ gap: 3 }}><X size={13} color={C.leafDark} /><Txt weight="extrabold" className="text-[13px]" style={{ color: C.leafDark }}>Clear</Txt></View>
          </PressableScale>
        ) : null}
      </View>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {MACRO_PRESETS.map((p) => {
          const on = active(p.set);
          return (
            <PressableScale key={p.id} testID={`macro-${p.id}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => toggle(p.set)}>
              <View className="rounded-full px-3.5 py-2" style={{ backgroundColor: on ? C.honey : 'transparent', borderWidth: 1.5, borderColor: on ? C.honey : C.hairline }}>
                <Txt weight="bold" className="text-[13px]" style={{ color: on ? C.onHoney : C.ink }}>{p.label}</Txt>
              </View>
            </PressableScale>
          );
        })}
        <PressableScale testID="macro-custom" accessibilityRole="button" accessibilityState={{ expanded: custom }} onPress={() => setCustom(!custom)}>
          <View className="rounded-full px-3.5 py-2" style={{ backgroundColor: custom ? C.ink : 'transparent', borderWidth: 1.5, borderColor: custom ? C.ink : C.hairline }}>
            <Txt weight="bold" className="text-[13px]" style={{ color: custom ? C.cream : C.ink }}>Custom…</Txt>
          </View>
        </PressableScale>
      </View>
      {custom ? (
        <Animated.View entering={FadeIn} className="mt-3 flex-row" style={{ gap: 8 }}>
          {field('proteinMin', 'Protein at least', 'g')}
          {field('carbsMax', 'Carbs up to', 'g')}
          {field('caloriesMax', 'Calories up to', 'cal')}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** "520 cal · 52g protein · 38g carbs · 18g fat" row for an idea card. */
export function MacroRow({ macros, onHoney }: { macros?: { calories: number; protein: number; carbs: number; fat: number } | null; onHoney?: boolean }) {
  const { C } = useTheme();
  if (!macros || !macros.calories) return null;
  const color = onHoney ? C.onHoney : C.ink;
  const cell = (v: string, l: string) => (
    <View className="items-center" style={{ minWidth: 52 }}>
      <Txt weight="extrabold" style={{ fontSize: 16, color }}>{v}</Txt>
      <Txt weight="bold" style={{ fontSize: 11, color, opacity: 0.7 }}>{l}</Txt>
    </View>
  );
  return (
    <View className="mt-3 flex-row items-center justify-between rounded-2xl px-3 py-2" style={{ backgroundColor: onHoney ? '#FFFFFF80' : C.cream }} testID="idea-macros">
      {cell(String(macros.calories), 'cal')}
      {cell(`${macros.protein}g`, 'protein')}
      {cell(`${macros.carbs}g`, 'carbs')}
      {cell(`${macros.fat}g`, 'fat')}
      <Txt weight="bold" style={{ fontSize: 10, color, opacity: 0.6 }}>per serving{'\n'}estimate</Txt>
    </View>
  );
}
