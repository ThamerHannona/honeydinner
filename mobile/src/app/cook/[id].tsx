import { useTheme } from '@/lib/theme-context';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInLeft, SlideInRight, useAnimatedStyle, withTiming, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ChevronLeft, Pause, Play, RotateCcw, Sun, Timer, X } from 'lucide-react-native';
import { GenieAvatar } from '@/components/brand';
import { Button, PressableScale, Txt, AView } from '@/components/ui';
import { findTimerMinutes } from '@/lib/kitchen';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';

const KEEP_AWAKE_TAG = 'cooking-mode';

export default function CookMode() {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  // Keep the screen on while cooking (silently skipped where the browser refuses).
  useEffect(() => {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => {});
    };
  }, []);
  const { id } = useLocalSearchParams<{ id: string; servings?: string }>();
  const recipe = useApp((s) => s.recipes.find((r) => r.id === id));
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState<number>(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const steps = recipe?.steps ?? [];
  const total = steps.length;
  const done = idx >= total;

  const go = (n: number) => {
    haptic.select();
    setDir(n > idx ? 1 : -1);
    setIdx(Math.max(0, Math.min(total, n)));
  };

  const bar = useAnimatedStyle(() => ({ width: withTiming(`${(Math.min(idx + 1, total) / Math.max(total, 1)) * 100}%`, { duration: reduceMotion ? 0 : 300 }) }));

  if (!recipe) return null;

  return (
    <View className="flex-1" style={{ backgroundColor: C.night }} testID="cook-mode-screen">
      <StatusBar style="light" backgroundColor={C.night} />
      <View style={{ paddingTop: insets.top + 8 }} className="px-5">
        <View className="flex-row items-center justify-between">
          <PressableScale testID="cook-close" accessibilityLabel="Exit cooking mode" onPress={() => router.back()}>
            <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: C.timerTrack }}>
              <X size={22} color={C.onInk} />
            </View>
          </PressableScale>
          <View className="flex-row items-center rounded-full px-3 py-1.5" style={{ gap: 6, backgroundColor: C.timerTrack }}>
            <Sun size={14} color={C.honey} />
            <Txt weight="bold" className="text-[12px]" style={{ color: C.onInk + 'cc' }}>
              Screen stays awake
            </Txt>
          </View>
          <View className="h-11 w-11" />
        </View>
        <View className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: C.timerTrack }}>
          <Animated.View style={[{ height: '100%', backgroundColor: C.honey, borderRadius: 4 }, bar]} />
        </View>
        <Txt label weight="extrabold" className="mt-3 text-[15px] uppercase tracking-widest" numberOfLines={1} style={{ color: C.onInk + '80' }}>
          {done ? recipe.title : `Step ${idx + 1} of ${total} · ${recipe.title}`}
        </Txt>
      </View>

      <ScrollView testID="cook-step-content" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 16 }} showsVerticalScrollIndicator={false}>
        {done ? (
          <AView entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)} className="items-center" testID="cook-done">
            <GenieAvatar size={110} />
            <Txt display weight="extrabold" className="mt-6 text-center text-[36px] leading-[42px]" style={{ color: C.onInk }}>
              Dinner is served!
            </Txt>
            <Txt weight="semibold" className="mt-3 text-center text-[17px]" style={{ color: C.onInk + 'b3' }}>
              FridgeGenie: That smells amazing from here. Enjoy, you two.
            </Txt>
          </AView>
        ) : (
          <Animated.View key={idx} entering={reduceMotion ? undefined : (dir === 1 ? SlideInRight : SlideInLeft).duration(260)}>
            <Txt display weight="extrabold" className="text-[64px] leading-[68px] text-honey">
              {idx + 1}
            </Txt>
            <Txt display weight="semibold" className="mt-2 text-[30px] leading-[40px]" testID="cook-step-text" style={{ color: C.onInk }}>
              {steps[idx]}
            </Txt>
            <StepTimer key={`t-${idx}`} minutes={findTimerMinutes(steps[idx] ?? '')} />
          </Animated.View>
        )}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 16 }} className="flex-row items-center px-5" >
        {done ? (
          <View className="flex-1">
            <Button
              testID="cook-finish"
              variant="honey"
              label="Finish"
              onPress={() => {
                haptic.success();
                toast(`${recipe.title} — nailed it!`);
                router.back();
              }}
            />
          </View>
        ) : (
          <View className="flex-1 flex-row" style={{ gap: 12 }}>
            <PressableScale testID="cook-prev" accessibilityLabel="Previous step" onPress={() => go(idx - 1)} disabled={idx === 0}>
              <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ opacity: idx === 0 ? 0.3 : 1, backgroundColor: C.timerTrack }}>
                <ChevronLeft size={26} color={C.onInk} />
              </View>
            </PressableScale>
            <View className="flex-1">
              <Button
                testID="cook-next"
                label={idx === total - 1 ? 'Done' : 'Next step'}
                onPress={() => go(idx + 1)}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const R = 30;
const CIRC = 2 * Math.PI * R;

function StepTimer({ minutes }: { minutes: number | null }) {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  const totalSec = useMemo(() => (minutes ?? 0) * 60, [minutes]);
  const [left, setLeft] = useState<number>(totalSec);
  const [running, setRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          setRunning(false);
          haptic.success();
          toast("Ding! Timer's done.");
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!minutes) return null;
  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const pct = totalSec ? left / totalSec : 0;

  return (
    <AView entering={reduceMotion ? undefined : FadeIn.delay(150)} className="mt-8 rounded-3xl p-4" style={{ backgroundColor: C.timerTrack }} testID="step-timer">
      <View className="flex-row items-center" style={{ gap: 16 }}>
      <View>
        <Svg width={72} height={72} viewBox="0 0 72 72">
          <Circle cx="36" cy="36" r={R} stroke={C.timerTrack} strokeWidth="6" fill="none" />
          <Circle
            cx="36"
            cy="36"
            r={R}
            stroke={left === 0 ? C.leaf : C.honey}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - pct)}
            transform="rotate(-90 36 36)"
          />
        </Svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} className="items-center justify-center">
          <Timer size={20} color={C.onInk} />
        </View>
      </View>
      <View className="flex-1">
        <Txt weight="extrabold" className="text-[34px]" style={[{ color: C.onInk }, { fontVariant: ['tabular-nums'] }]} testID="timer-value">
          {mm}:{ss.toString().padStart(2, '0')}
        </Txt>
        <Txt weight="bold" className="text-[13px]" style={{ color: C.onInk + '99' }}>
          {left === 0 ? 'Done!' : running ? 'Counting down…' : `${minutes} min timer`}
        </Txt>
      </View>
      </View>
      <View className="mt-3 flex-row items-center justify-end" style={{ gap: 12 }}>
      <PressableScale testID="timer-reset" accessibilityLabel="Reset timer" onPress={() => { setRunning(false); setLeft(totalSec); }}>
        <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: C.timerTrack }}>
          <RotateCcw size={20} color={C.onInk} />
        </View>
      </PressableScale>
      <PressableScale testID="timer-toggle" accessibilityLabel={running ? 'Pause timer' : 'Start timer'} onPress={() => left > 0 && setRunning((r) => !r)}>
        <View className="h-14 w-14 items-center justify-center rounded-full bg-honey">
          {running ? <Pause size={24} color={C.onHoney} fill={C.onHoney} /> : <Play size={24} color={C.onHoney} fill={C.onHoney} />}
        </View>
      </PressableScale>
      </View>
    </AView>
  );
}
