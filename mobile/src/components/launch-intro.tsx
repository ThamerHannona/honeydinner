import { CaveatBrush_400Regular } from '@expo-google-fonts/caveat-brush';
import { useTheme } from '@/lib/theme-context';
import { offsets, shape, signature } from '@/lib/theme';
import { useFonts } from 'expo-font';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/** Splash-only handwritten face — not used elsewhere; brand.tsx stays Barlow. */
const SPLASH_SCRIPT = 'CaveatBrush_400Regular';

/** lg LogoBubble geometry — keep in sync with brand.tsx LogoBubble size="lg". */
const BUBBLE_W = 232;
const BUBBLE_H = 146;
const BUBBLE_TAIL = 16;
const OUTER_W = 244;
const OUTER_H = 183;
/** Brush script reads smaller than condensed; bump size inside the same bubble. */
const TEXT_SIZE = 58;
const TEXT_LINE = 60;

const BOX_AT = 0;
const HONEY_AT = 420;
const DINNER_AT = 720;
const Q_AT = 1020;
const HOLD_MS = 700;
const FADE_MS = 380;
const SEQUENCE_MS = Q_AT + 430;

type LaunchIntroProps = {
  onReady: () => void;
  onComplete: () => void;
};

const scriptText = {
  fontFamily: SPLASH_SCRIPT,
  fontSize: TEXT_SIZE,
  lineHeight: TEXT_LINE,
  letterSpacing: 0.4,
  includeFontPadding: false as const,
  textAlign: 'center' as const,
};

/** Same silhouette as brand.tsx LogoShape (not exported — duplicated for splash-only staging). */
function BubbleShape({
  width,
  height,
  tail,
  color,
  outlined = false,
}: {
  width: number;
  height: number;
  tail: number;
  color: string;
  outlined?: boolean;
}) {
  const { C } = useTheme();
  const r = signature.logo.radius;
  const bubble = `M${r} 0H${width - r}Q${width} 0 ${width} ${r}V${height - r}Q${width} ${height} ${width - r} ${height}H${tail + r}L0 ${height + tail}V${r}Q0 0 ${r} 0Z`;
  return (
    <Svg
      width={width + shape.border * 2}
      height={height + tail + shape.border * 2}
      viewBox={`${-shape.border} ${-shape.border} ${width + shape.border * 2} ${height + tail + shape.border * 2}`}
    >
      <Path
        d={bubble}
        fill={color}
        stroke={outlined ? C.ink : color}
        strokeWidth={outlined ? shape.border : 0}
      />
    </Svg>
  );
}

function PopText({
  children,
  progress,
  color,
}: {
  children: string;
  progress: SharedValue<number>;
  color: string;
}) {
  const anim = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: Math.min(1, t * 1.4),
      transform: [{ scale: 0.35 + t * 0.65 }],
    };
  });
  return (
    <Animated.View style={anim}>
      <Text style={[scriptText, { color }]}>{children}</Text>
    </Animated.View>
  );
}

/**
 * Full-screen launch intro. LogoBubble lg silhouette with splash-only Caveat Brush
 * lettering: empty bubble → Honey, → Dinner → ? → hold → fade.
 */
export function LaunchIntro({ onReady, onComplete }: LaunchIntroProps) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const [fontLoaded, fontError] = useFonts({ CaveatBrush_400Regular });
  const scriptReady = fontLoaded || !!fontError;

  const overlay = useSharedValue(1);
  const box = useSharedValue(0);
  const honey = useSharedValue(0);
  const dinner = useSharedValue(0);
  const q = useSharedValue(0);
  const qWiggle = useSharedValue(0);

  // Keep the native cream splash up until the script face is ready — no fallback flash.
  useEffect(() => {
    if (scriptReady) onReady();
  }, [onReady, scriptReady]);

  useEffect(() => {
    if (!scriptReady) return;

    if (reduced) {
      box.value = 1;
      honey.value = 1;
      dinner.value = 1;
      q.value = 1;
    } else {
      box.value = withDelay(BOX_AT, withSpring(1, { damping: 10, stiffness: 170, mass: 0.7 }));
      honey.value = withDelay(HONEY_AT, withSpring(1, { damping: 9, stiffness: 220, mass: 0.55 }));
      dinner.value = withDelay(DINNER_AT, withSpring(1, { damping: 9, stiffness: 220, mass: 0.55 }));
      q.value = withDelay(
        Q_AT,
        withSequence(
          withSpring(1.38, { damping: 6, stiffness: 200, mass: 0.55 }),
          withSpring(1, { damping: 11, stiffness: 170, mass: 0.6 }),
        ),
      );
      qWiggle.value = withDelay(
        Q_AT + 180,
        withSequence(
          withTiming(8, { duration: 70, easing: Easing.out(Easing.quad) }),
          withTiming(-7, { duration: 80, easing: Easing.inOut(Easing.quad) }),
          withTiming(4, { duration: 70, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 90, easing: Easing.out(Easing.quad) }),
        ),
      );
    }

    const totalMs = reduced ? 400 : SEQUENCE_MS + HOLD_MS;
    const finish = () => {
      overlay.value = withTiming(
        0,
        { duration: reduced ? 160 : FADE_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onComplete)();
        },
      );
    };
    const timer = setTimeout(finish, totalMs);
    return () => clearTimeout(timer);
  }, [box, dinner, honey, onComplete, overlay, q, qWiggle, reduced, scriptReady]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));

  const boxStyle = useAnimatedStyle(() => {
    const t = box.value;
    return {
      opacity: Math.min(1, t * 1.25),
      transform: [
        { scale: 0.42 + t * 0.58 },
        { rotate: `${(1 - t) * 8}deg` },
      ],
    };
  });

  const qStyle = useAnimatedStyle(() => {
    const t = q.value;
    return {
      opacity: Math.min(1, t * 1.5),
      transform: [
        { scale: 0.15 + t * 0.85 },
        { rotate: `${qWiggle.value}deg` },
      ],
    };
  });

  // Hold native splash; avoid mounting lettering on a fallback face.
  if (!scriptReady) return null;

  const fg = C.onGreen;
  const bg = C.brandGreen;

  return (
    <Animated.View
      pointerEvents="none"
      testID="launch-intro"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { backgroundColor: C.cream }, overlayStyle]}
    >
      <Animated.View style={[styles.mark, boxStyle]}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Honey, Dinner?"
          testID="launch-intro-logo"
          style={{ width: OUTER_W, height: OUTER_H }}
        >
          <View
            style={{
              width: BUBBLE_W + shape.border * 2,
              height: BUBBLE_H + BUBBLE_TAIL + shape.border * 2,
              marginTop: 8,
              transform: [{ rotate: signature.logo.rotate }],
            }}
          >
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: offsets.hero.x, top: offsets.hero.y }}
            >
              <BubbleShape width={BUBBLE_W} height={BUBBLE_H} tail={BUBBLE_TAIL} color={C.ink} outlined />
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
              <BubbleShape width={BUBBLE_W} height={BUBBLE_H} tail={BUBBLE_TAIL} color={bg} outlined />
            </View>

            <View
              style={{
                height: BUBBLE_H + shape.border * 2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Title case reads more naturally in brush script than all-caps. */}
              <PopText progress={honey} color={fg}>
                Honey,
              </PopText>
              <View style={styles.dinnerRow}>
                <PopText progress={dinner} color={fg}>
                  Dinner
                </PopText>
                <Animated.View style={qStyle}>
                  <Text style={[scriptText, { color: fg }]}>?</Text>
                </Animated.View>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
