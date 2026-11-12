import { useTheme } from '@/lib/theme-context';
import { fonts, colors } from '@/lib/theme';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

const LINE_ONE = 'HONEY';
const LINE_TWO = 'DINNER';
const LETTER_STAGGER_MS = 55;
const HOLD_MS = 700;
const FADE_MS = 380;
const DROP_DISTANCE = 28;

type LaunchIntroProps = {
  onReady: () => void;
  onComplete: () => void;
};

function AnimatedLetter({
  char,
  index,
  color,
  reduced,
}: {
  char: string;
  index: number;
  color: string;
  reduced: boolean | null;
}) {
  const progress = useSharedValue(reduced ? 1 : 0);
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    const delay = 120 + index * LETTER_STAGGER_MS;
    progress.value = withDelay(
      delay,
      withSpring(1, { damping: 11, stiffness: 160, mass: 0.7 }),
    );
    // Warm diner-sign flicker after the letter lands.
    flicker.value = withDelay(
      delay + 280,
      withSequence(
        withTiming(0.55, { duration: 70, easing: Easing.linear }),
        withTiming(1, { duration: 90, easing: Easing.linear }),
        withTiming(0.7, { duration: 55, easing: Easing.linear }),
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [flicker, index, progress, reduced]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: Math.min(1, t * 1.15) * flicker.value,
      transform: [
        { translateY: (1 - t) * -DROP_DISTANCE },
        { scale: 0.72 + t * 0.28 },
        { rotate: `${(1 - t) * -6}deg` },
      ],
    };
  });

  if (char === ' ') {
    return <View style={{ width: 14 }} />;
  }

  return (
    <Animated.View style={style}>
      <Text
        style={{
          fontFamily: fonts.logo,
          fontSize: 64,
          lineHeight: 68,
          letterSpacing: 4,
          color,
          includeFontPadding: false,
          textAlign: 'center',
        }}
      >
        {char}
      </Text>
    </Animated.View>
  );
}

function WordRow({
  word,
  startIndex,
  color,
  reduced,
}: {
  word: string;
  startIndex: number;
  color: string;
  reduced: boolean | null;
}) {
  return (
    <View style={styles.row} accessibilityElementsHidden>
      {word.split('').map((char, i) => (
        <AnimatedLetter
          key={`${word}-${i}`}
          char={char}
          index={startIndex + i}
          color={color}
          reduced={reduced}
        />
      ))}
    </View>
  );
}

/** Subtle warm sunburst — decorative only, stays behind the wordmark. */
function Sunburst({ accent }: { accent: string }) {
  return (
    <View pointerEvents="none" style={styles.sunburst}>
      <Svg width={320} height={320} viewBox="0 0 320 320">
        <Circle cx="160" cy="160" r="54" fill={accent} opacity={0.14} />
        <Circle cx="160" cy="160" r="92" fill={accent} opacity={0.07} />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x2 = 160 + Math.cos(angle) * 148;
          const y2 = 160 + Math.sin(angle) * 148;
          return (
            <Path
              key={i}
              d={`M160 160 L${x2.toFixed(1)} ${y2.toFixed(1)}`}
              stroke={accent}
              strokeWidth={2}
              opacity={0.1}
            />
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * Full-screen launch intro shown once after the native splash hides.
 * Cream background matches `colors.cream` / expo-splash-screen to avoid a flash.
 */
export function LaunchIntro({ onReady, onComplete }: LaunchIntroProps) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const overlay = useSharedValue(1);
  const stamp = useSharedValue(reduced ? 1 : 0.92);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    const letterCount = LINE_ONE.length + LINE_TWO.length;
    const enterMs = reduced ? 0 : 120 + letterCount * LETTER_STAGGER_MS + 420;
    const totalMs = enterMs + (reduced ? 400 : HOLD_MS);

    if (!reduced) {
      stamp.value = withDelay(
        80,
        withSpring(1, { damping: 14, stiffness: 120 }),
      );
    }

    const finish = () => {
      overlay.value = withTiming(0, { duration: reduced ? 160 : FADE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onComplete)();
      });
    };

    const timer = setTimeout(finish, totalMs);
    return () => clearTimeout(timer);
  }, [onComplete, overlay, reduced, stamp]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));

  const stampStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: stamp.value },
      { rotate: `${(1 - stamp.value) * -3}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      testID="launch-intro"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { backgroundColor: C.cream }, overlayStyle]}
    >
      <Sunburst accent={C.honey} />
      <Animated.View style={[styles.mark, stampStyle]}>
        <WordRow word={LINE_ONE} startIndex={0} color={C.forest} reduced={reduced} />
        <WordRow word={LINE_TWO} startIndex={LINE_ONE.length} color={C.forest} reduced={reduced} />
      </Animated.View>
      {/* Soft grain dots — keeps cream lively without cluttering the mark. */}
      <View pointerEvents="none" style={styles.grain}>
        {GRAIN_DOTS.map((dot, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${dot.x}%` as `${number}%`,
              top: `${dot.y}%` as `${number}%`,
              width: dot.s,
              height: dot.s,
              borderRadius: dot.s,
              backgroundColor: colors.ink,
              opacity: 0.04,
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const GRAIN_DOTS = [
  { x: 12, y: 18, s: 2 }, { x: 78, y: 14, s: 1.5 }, { x: 24, y: 72, s: 2 },
  { x: 86, y: 68, s: 1.5 }, { x: 8, y: 48, s: 1.5 }, { x: 92, y: 42, s: 2 },
  { x: 40, y: 22, s: 1.5 }, { x: 58, y: 78, s: 2 }, { x: 18, y: 88, s: 1.5 },
  { x: 70, y: 30, s: 1.5 }, { x: 34, y: 58, s: 2 }, { x: 64, y: 12, s: 1.5 },
];

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    alignItems: 'center',
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunburst: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
  },
});
