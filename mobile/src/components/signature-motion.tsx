import { useTheme } from '@/lib/theme-context';
import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { motion } from '@/lib/theme';

/** Decorative motion only; never signals recognition or changes app state. */
export function MascotBob({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!reduced) y.value = withRepeat(withTiming(-4, { duration: motion.mascotDuration / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(y);
  }, [reduced, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function ImportPulse({ size = 190 }: { size?: number }) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!reduced) progress.value = withRepeat(withTiming(1, { duration: motion.mascotDuration, easing: Easing.linear }), -1);
    return () => cancelAnimation(progress);
  }, [reduced, progress]);
  const first = useAnimatedStyle(() => ({ opacity: reduced ? 0.25 : 0.55 * (1 - progress.value), transform: [{ scale: 1 + progress.value * 0.35 }] }));
  const second = useAnimatedStyle(() => {
    const p = (progress.value + 0.5) % 1;
    return { opacity: reduced ? 0 : 0.55 * (1 - p), transform: [{ scale: 1 + p * 0.35 }] };
  });
  const ring: ViewStyle = { position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: C.brandGreen };
  return <View pointerEvents="none" testID="import-pulse" style={{ position: 'absolute', width: size, height: size }}><Animated.View style={[ring, first]} /><Animated.View style={[ring, second]} /></View>;
}

export function ScanSweep({ style }: { style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!reduced) progress.value = withRepeat(withTiming(1, { duration: motion.mascotDuration, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(progress);
  }, [reduced, progress]);
  const sweep = useAnimatedStyle(() => ({ top: `${15 + progress.value * 70}%` as `${number}%`, opacity: reduced ? 0 : 0.8 }));
  return <View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 24, right: 24 }, style]}><Animated.View testID="scan-sweep" style={[{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.brandGreen }, sweep]} /></View>;
}
