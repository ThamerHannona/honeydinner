import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { Txt } from '@/components/ui';
import { useTheme } from '@/lib/theme-context';

const RECEIPT_STEPS = ['Reading every line…', 'Decoding store shorthand…', 'Matching quantities and weights…', 'Sorting into fridge, freezer & pantry…', 'Guessing expiry dates…'];
const FRIDGE_STEPS = ['Looking at every shelf…', 'Spotting ingredients…', 'Checking what looks fresh…', 'Sorting into fridge, freezer & pantry…'];

/** A beam sweeping over the photo, with soft green glow trailing it. */
function Beam({ height }: { height: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.cubic) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, t]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(t.value, [0, 1], [-40, height - 40]) }] }));
  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, height: 80 }, style]}>
      <LinearGradient colors={['rgba(98,213,127,0)', 'rgba(98,213,127,0.35)', 'rgba(98,213,127,0)']} style={{ flex: 1 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 39, height: 2, backgroundColor: '#9DF0B2', shadowColor: '#62D57F', shadowOpacity: 0.9, shadowRadius: 8 }} />
    </Animated.View>
  );
}

/** Little "found something" pings popping up across the photo. */
function Ping({ x, y, delay }: { x: number; y: number; delay: number }) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 900 }), withTiming(0, { duration: 1400 })), -1, false));
    return () => cancelAnimation(t);
  }, [reduced, delay, t]);
  const ring = useAnimatedStyle(() => ({ opacity: t.value * 0.9, transform: [{ scale: 0.4 + t.value * 1.1 }] }));
  const dot = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.6 + t.value * 0.4 }] }));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 28, height: 28, marginLeft: -14, marginTop: -14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.honey }, ring]} />
      <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.honey }, dot]} />
    </View>
  );
}

/** Progress that eases toward ~92% while we wait, so it always feels like it's moving. */
function Progress() {
  const { C } = useTheme();
  const p = useSharedValue(0.04);
  useEffect(() => {
    p.value = withTiming(0.92, { duration: 22000, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(p);
  }, [p]);
  const style = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: C.creamDeep, overflow: 'hidden' }} testID="scan-progress-bar">
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: C.leaf }, style]} />
    </View>
  );
}

/** Shown over the captured photo while FridgeGenie reads it. */
export function ScanProgress({ uri, mode, height }: { uri: string | null; mode: 'receipt' | 'fridge'; height: number }) {
  const { C } = useTheme();
  const steps = mode === 'receipt' ? RECEIPT_STEPS : FRIDGE_STEPS;
  const [step, setStep] = useState<number>(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 3200);
    return () => clearInterval(t);
  }, [steps.length]);
  const pings = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ x: 18 + ((i * 37) % 64), y: 14 + ((i * 23) % 58), delay: i * 520 })),
    [],
  );

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} testID="scan-loading" accessibilityState={{ busy: true }} accessibilityLabel={steps[step]}>
      {uri ? <Image source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.creamDeep }} />}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,18,14,0.35)' }} />
      <Beam height={height} />
      {pings.map((p, i) => <Ping key={i} {...p} />)}

      <Animated.View entering={FadeInDown.springify().damping(16)} style={{ position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 22, overflow: 'hidden' }}>
        <BlurView intensity={40} tint="light" style={{ padding: 14, backgroundColor: 'rgba(244,237,224,0.86)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AnimatedFridgeGenie size={50} mood="working" testID="scan-genie" />
            <View style={{ flex: 1, gap: 8 }}>
              <Animated.View key={step} entering={FadeInDown.duration(260)}>
                <Txt weight="extrabold" className="text-[15px]" style={{ color: C.ink }}>{steps[step]}</Txt>
              </Animated.View>
              <Progress />
            </View>
          </View>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}
