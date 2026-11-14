import { useTheme } from '@/lib/theme-context';
import { motion } from '@/lib/theme';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/** Shared FridgeGenie drawing so the in-app mascot matches the native share panel. */
export function GenieDrawing({ shadow = false }: { shadow?: boolean }) {
  const { C } = useTheme();
  return (
    <G stroke={C.onHoney} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      {shadow ? <Ellipse cx="100" cy="235" rx="59" ry="7" fill={C.creamDeep} stroke="none" /> : null}
      <Path d="M59 134C38 131 33 117 37 101M32 102Q35 95 42 101" fill="none" />
      <Path d="M143 134Q162 134 169 152" fill="none" />
      <Path d="M79 190L77 207M122 190L121 207" fill="none" />
      <Ellipse cx="69" cy="212" rx="12" ry="5.5" fill={C.onInk} />
      <Ellipse cx="130" cy="212" rx="12" ry="5.5" fill={C.onInk} />
      <Path d="M103 47V35" fill="none" />
      <Path d="M103 36Q103 17 130 20Q126 37 103 36Z" fill={C.leaf} />
      <Rect x="55" y="45" width="90" height="151" rx="21" fill={C.leaf} />
      <Path d="M56 99H144" fill="none" />
      <Rect x="129" y="65" width="5" height="25" rx="2" fill={C.onHoney} stroke="none" />
      <Rect x="129" y="111" width="5" height="34" rx="2" fill={C.onHoney} stroke="none" />
      <Ellipse cx="84" cy="128" rx="7" ry="8" fill={C.onHoney} stroke="none" />
      <Ellipse cx="114" cy="128" rx="7" ry="8" fill={C.onHoney} stroke="none" />
      <Circle cx="86" cy="125" r="2" fill={C.onInk} stroke="none" />
      <Circle cx="116" cy="125" r="2" fill={C.onInk} stroke="none" />
      <Circle cx="75" cy="143" r="4.5" fill={C.honey} stroke="none" opacity="0.8" />
      <Circle cx="124" cy="143" r="4.5" fill={C.honey} stroke="none" opacity="0.8" />
      <Path d="M85 148Q100 162 115 148Z" fill={C.onInk} strokeWidth="2.4" />
    </G>
  );
}

function Sparkle({ color, left, top, size, delay }: { color: string; left: number; top: number; size: number; delay: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      t.value = 0.6;
      return;
    }
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 780, easing: Easing.inOut(Easing.sin) }), -1, false));
    return () => cancelAnimation(t);
  }, [reduced, delay, t]);
  const style = useAnimatedStyle(() => {
    const pulse = reduced ? 0.7 : Math.sin(t.value * Math.PI);
    return {
      opacity: 0.15 + 0.85 * pulse,
      transform: [{ scale: 0.55 + 0.55 * pulse }, { rotate: '45deg' }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left, top, width: size, height: size, borderRadius: 1, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function AnimatedFridgeGenie({
  size = 88,
  mood = 'idle',
  testID = 'fridge-genie',
}: {
  size?: number;
  mood?: 'idle' | 'working';
  testID?: string;
}) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const blink = useSharedValue(0);
  const working = mood === 'working';
  const height = size * 1.3;

  useEffect(() => {
    cancelAnimation(bob);
    cancelAnimation(tilt);
    if (reduced) {
      bob.value = 0;
      tilt.value = 0;
      return;
    }
    if (working) {
      bob.value = withRepeat(withTiming(-5, { duration: 420, easing: Easing.inOut(Easing.sin) }), -1, true);
      tilt.value = -7;
      tilt.value = withRepeat(withTiming(7, { duration: 380, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      bob.value = withRepeat(withTiming(-4, { duration: motion.mascotDuration / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
      tilt.value = 0;
    }
    return () => {
      cancelAnimation(bob);
      cancelAnimation(tilt);
    };
  }, [working, reduced, bob, tilt]);

  useEffect(() => {
    cancelAnimation(blink);
    if (reduced) {
      blink.value = 0;
      return;
    }
    blink.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(1, { duration: 70 })),
        withTiming(0, { duration: 90 }),
        withDelay(400, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(blink);
  }, [reduced, blink]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { rotate: `${tilt.value}deg` }],
  }));
  const lidStyle = useAnimatedStyle(() => ({
    opacity: blink.value > 0.04 ? 1 : 0,
    transform: [{ scaleY: blink.value }],
  }));

  const lid = (cx: number) => ({
    position: 'absolute' as const,
    left: (cx / 200) * size - 8 * (size / 200),
    top: (120 / 260) * height - 8 * (height / 260),
    width: 16 * (size / 200),
    height: 16 * (height / 260),
    borderRadius: 8,
    backgroundColor: C.leaf,
  });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={working ? 'FridgeGenie is working' : 'FridgeGenie, a smiling green fridge waving hello'}
      testID={testID}
      style={{ width: size, height, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={[{ width: size, height }, motionStyle]}>
        <Svg width={size} height={height} viewBox="0 0 200 260">
          <GenieDrawing shadow />
        </Svg>
        <Animated.View pointerEvents="none" style={[lid(84), lidStyle]} />
        <Animated.View pointerEvents="none" style={[lid(114), lidStyle]} />
        {working ? (
          <>
            <Sparkle color={C.honey} left={size * 0.08} top={height * 0.12} size={Math.max(5, size * 0.07)} delay={0} />
            <Sparkle color={C.honey} left={size * 0.84} top={height * 0.2} size={Math.max(4, size * 0.055)} delay={180} />
            <Sparkle color={C.honey} left={size * 0.9} top={height * 0.42} size={Math.max(5, size * 0.06)} delay={360} />
            <Sparkle color={C.honey} left={size * 0.02} top={height * 0.36} size={Math.max(4, size * 0.05)} delay={520} />
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function FridgeMascot({ size = 200 }: { size?: number }) {
  return <AnimatedFridgeGenie size={size} mood="idle" testID="fridge-mascot" />;
}

export function GenieAvatar({ size = 40 }: { size?: number }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="FridgeGenie" testID="genie-avatar">
      <Svg width={size} height={size} viewBox="25 9 152 215">
        <GenieDrawing />
      </Svg>
    </View>
  );
}
