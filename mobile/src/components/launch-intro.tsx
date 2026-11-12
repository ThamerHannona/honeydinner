import { Logo } from '@/components/brand';
import { useTheme } from '@/lib/theme-context';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
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

const HOLD_MS = 850;
const FADE_MS = 400;
const STAMP_MS = 520;
const FLICKER_START_MS = 380;

type LaunchIntroProps = {
  onReady: () => void;
  onComplete: () => void;
};

/**
 * Full-screen launch intro shown once after the native splash hides.
 * Uses the same green speech-bubble wordmark as onboarding / sign-in (`Logo` size lg).
 * Cream background matches `colors.cream` / expo-splash-screen to avoid a flash.
 */
export function LaunchIntro({ onReady, onComplete }: LaunchIntroProps) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const overlay = useSharedValue(1);
  // 0 → 1 stamps the boxed logo in (scale + slight overshoot).
  const stamp = useSharedValue(reduced ? 1 : 0);
  // Sign-flicker after the box lands (opacity pulse on the whole mark).
  const flicker = useSharedValue(1);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    if (reduced) {
      stamp.value = 1;
      flicker.value = 1;
    } else {
      stamp.value = withSpring(1, { damping: 12, stiffness: 140, mass: 0.85 });
      // Diner-sign flicker once the bubble has mostly stamped in.
      flicker.value = withDelay(
        FLICKER_START_MS,
        withSequence(
          withTiming(0.4, { duration: 70, easing: Easing.linear }),
          withTiming(1, { duration: 90, easing: Easing.linear }),
          withTiming(0.55, { duration: 55, easing: Easing.linear }),
          withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        ),
      );
    }

    const enterMs = reduced ? 0 : STAMP_MS + 380;
    const totalMs = enterMs + (reduced ? 360 : HOLD_MS);

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
  }, [flicker, onComplete, overlay, reduced, stamp]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));

  const markStyle = useAnimatedStyle(() => {
    const t = stamp.value;
    return {
      opacity: flicker.value,
      transform: [
        { scale: 0.55 + t * 0.45 },
        // Extra stamp tilt on top of Logo's built-in -3deg; settles relative to that.
        { rotate: `${(1 - t) * -10}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      testID="launch-intro"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { backgroundColor: C.cream }, overlayStyle]}
    >
      <Animated.View style={[styles.mark, markStyle]}>
        {/* Exact app wordmark: green speech-bubble box + Barlow Condensed (LogoBubble lg). */}
        <Logo size="lg" />
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
});
