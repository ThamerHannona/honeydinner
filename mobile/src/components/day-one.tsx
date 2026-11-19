import React from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { PressableScale, Txt } from '@/components/ui';
import { GenieAvatar } from '@/components/fridge-genie';
import { useTheme } from '@/lib/theme-context';
import { haptic } from '@/lib/theme';
import { useApp } from '@/lib/store';
import { STARTER_RECIPE_IDS } from '@/lib/mock-data';

/** "Day 1" checklist on Tonight: whatever onboarding skipped, with a genie badge per finished item. */
export function DayOneChecklist() {
  const { C } = useTheme();
  const savedOwn = useApp((s) => s.recipes.some((r) => !(STARTER_RECIPE_IDS as readonly string[]).includes(r.id) && !r.id.startsWith('sample-')));
  const scanned = useApp((s) => s.pantry.length > 0);
  const genie = useApp((s) => s.genieUsed);
  const shared = useApp((s) => !!s.household);
  const dismissed = useApp((s) => s.checklistDismissed);
  const items = [
    { id: 'save', done: savedOwn, label: 'Save a recipe from TikTok or IG', hint: 'Share → Honey, Dinner?', go: () => router.push('/add-sheet') },
    { id: 'scan', done: scanned, label: 'Scan your fridge or a receipt', hint: 'One photo, I do the rest', go: () => router.push('/scan') },
    { id: 'genie', done: genie, label: 'Ask me what to make', hint: 'From what you have', go: () => router.push('/genie-chef') },
    { id: 'share', done: shared, label: 'Connect your partner’s kitchen', hint: 'Send a join code', go: () => router.push('/invite') },
  ];
  const doneCount = items.filter((i) => i.done).length;
  if (dismissed || doneCount === items.length) return null;
  return (
    <View testID="day-one-checklist" className="mb-6 rounded-[22px] p-4" style={{ backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink }}>
      <View className="mb-2 flex-row items-center" style={{ gap: 10 }}>
        <GenieAvatar size={34} />
        <View className="flex-1">
          <Txt weight="extrabold" className="text-[16px]">Day 1 with your genie</Txt>
          <Txt className="text-[12px]" style={{ color: C.inkSoft }}>{doneCount}/{items.length} done · I’m keeping score</Txt>
        </View>
        <PressableScale testID="day-one-dismiss" accessibilityRole="button" accessibilityLabel="Hide checklist" onPress={() => { haptic.tap(); useApp.getState().dismissChecklist(); }}>
          <X size={18} color={C.inkSoft} />
        </PressableScale>
      </View>
      <View className="mb-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: C.hairline }}>
        <View style={{ width: `${(doneCount / items.length) * 100}%`, height: '100%', backgroundColor: C.honey }} />
      </View>
      {items.map((i) => (
        <PressableScale key={i.id} testID={`day-one-${i.id}`} accessibilityRole="button" accessibilityLabel={i.label} disabled={i.done} onPress={i.go}>
          <View className="flex-row items-center py-2" style={{ gap: 10, opacity: i.done ? 0.55 : 1 }}>
            {i.done ? (
              <Animated.View entering={ZoomIn.springify().damping(9)} className="items-center justify-center rounded-full bg-honey" style={{ width: 24, height: 24, borderWidth: 1.5, borderColor: C.ink }}>
                <Check size={13} strokeWidth={3} color={C.onHoney} />
              </Animated.View>
            ) : (
              <View className="rounded-full" style={{ width: 24, height: 24, borderWidth: 1.5, borderColor: C.ink }} />
            )}
            <View className="flex-1">
              <Txt weight="bold" className="text-[14px]" style={{ textDecorationLine: i.done ? 'line-through' : 'none' }}>{i.label}</Txt>
              {!i.done ? <Txt className="text-[12px]" style={{ color: C.inkSoft }}>{i.hint}</Txt> : null}
            </View>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}
