import { useTheme } from '@/lib/theme-context';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * FridgeGenie — the Honey, Dinner? mascot: a cheerful little fridge.
 *
 * Drawn on a 200×260 canvas. The body, door and face are static SVG; the waving
 * arm, door glow, eyelids, aura and orbiting ingredients are separate animated
 * layers so the character feels alive without re-rendering the drawing.
 */

const INK = '#1B1A17';

/** Body, door split, handles, feet, leaf sprout and face. Used static (avatar) and animated. */
export function GenieDrawing({ shadow = false, armless = false, doorOpen = false }: { shadow?: boolean; armless?: boolean; doorOpen?: boolean }) {
  const { C } = useTheme();
  return (
    <G>
      <Defs>
        <LinearGradient id="gBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#62D57F" />
          <Stop offset="0.55" stopColor={C.leaf} />
          <Stop offset="1" stopColor={C.leafDark} />
        </LinearGradient>
        <LinearGradient id="gShine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="gHandle" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE7A3" />
          <Stop offset="1" stopColor={C.honey} />
        </LinearGradient>
        <RadialGradient id="gInside" cx="0.5" cy="0.5" r="0.6">
          <Stop offset="0" stopColor="#FFF8D6" />
          <Stop offset="1" stopColor="#FFD86B" />
        </RadialGradient>
        <LinearGradient id="gLeaf" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#3E8A52" />
          <Stop offset="1" stopColor="#9BD7A8" />
        </LinearGradient>
      </Defs>

      {shadow ? <Ellipse cx="100" cy="236" rx="58" ry="7" fill={C.creamDeep} /> : null}

      <G stroke={INK} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        {/* legs + feet */}
        <Path d="M79 190L77 207M122 190L121 207" fill="none" />
        <Ellipse cx="70" cy="212" rx="12.5" ry="5.8" fill={INK} />
        <Ellipse cx="130" cy="212" rx="12.5" ry="5.8" fill={INK} />

        {/* left arm on hip (the right, waving arm is its own animated layer) */}
        <Path d="M57 136C40 134 35 121 39 106" fill="none" />
        <Circle cx="39" cy="104" r="4.5" fill="#FFFFFF" />
        {armless ? null : <Path d="M143 134Q162 134 169 152" fill="none" />}

        {/* sprout */}
        <Path d="M103 47V33" fill="none" />
        <Path d="M103 35Q101 14 131 16Q128 37 103 35Z" fill="url(#gLeaf)" />
        <Path d="M103 39Q93 24 77 28Q83 42 103 39Z" fill="url(#gLeaf)" />

        {/* body */}
        <Rect x="55" y="45" width="90" height="151" rx="22" fill="url(#gBody)" />
        {doorOpen ? <Rect x="60" y="52" width="80" height="42" rx="12" fill="url(#gInside)" stroke="none" /> : null}
        <Path d="M56 99H144" fill="none" />
        {/* glossy highlight */}
        <Rect x="63" y="54" width="12" height="134" rx="6" fill="url(#gShine)" stroke="none" />

        {/* handles */}
        <Rect x="133" y="63" width="6" height="27" rx="3" fill="url(#gHandle)" strokeWidth="2" />
        <Rect x="133" y="110" width="6" height="36" rx="3" fill="url(#gHandle)" strokeWidth="2" />
      </G>

      {/* face */}
      <Ellipse cx="84" cy="128" rx="7.5" ry="8.5" fill={INK} />
      <Ellipse cx="114" cy="128" rx="7.5" ry="8.5" fill={INK} />
      <Circle cx="86.5" cy="124.5" r="2.4" fill="#FFFFFF" />
      <Circle cx="116.5" cy="124.5" r="2.4" fill="#FFFFFF" />
      <Circle cx="82" cy="131" r="1.1" fill="#FFFFFF" opacity="0.8" />
      <Circle cx="112" cy="131" r="1.1" fill="#FFFFFF" opacity="0.8" />
      <Ellipse cx="75" cy="144" rx="6" ry="4" fill="#F49A7A" opacity="0.75" />
      <Ellipse cx="124" cy="144" rx="6" ry="4" fill="#F49A7A" opacity="0.75" />
      <Path d="M86 147Q100 163 114 147Z" fill={INK} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <Path d="M93 154Q100 158 107 154" fill="none" stroke="#F49A7A" strokeWidth="3" strokeLinecap="round" />
    </G>
  );
}

/** The waving arm, drawn on the same canvas so it lines up with the body. */
function Arm() {
  return (
    <G stroke={INK} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M143 134Q162 132 170 114" fill="none" />
      <Circle cx="171" cy="111" r="5" fill="#FFFFFF" />
    </G>
  );
}

/* Tiny ingredients that orbit FridgeGenie while it works. */
function Tomato() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 24 24">
      <Circle cx="12" cy="13.5" r="9" fill="#E8553E" stroke={INK} strokeWidth="1.4" />
      <Path d="M8 6.5L12 9l4-2.5M12 9V4.5" stroke="#2F6B3F" strokeWidth="2" strokeLinecap="round" fill="none" />
      <Circle cx="9" cy="11" r="2" fill="#FFFFFF" opacity="0.5" />
    </Svg>
  );
}
function Carrot() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 24 24">
      <Path d="M5 21L17 9l-3-3L5 21Z" fill="#F29A38" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      <Path d="M16 7l3-4M17 8l4-1M15 6l1-4" stroke="#3E8A52" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
function Egg() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 24 24">
      <Ellipse cx="12" cy="13" rx="7.5" ry="9.5" fill="#FFF8E8" stroke={INK} strokeWidth="1.4" />
      <Circle cx="12" cy="14.5" r="4" fill="#FFC93C" />
    </Svg>
  );
}
function Leaf() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 24 24">
      <Path d="M4 20C4 9 11 4 21 4c0 10-6 16-17 16Z" fill="#6DBB7F" stroke={INK} strokeWidth="1.3" />
      <Path d="M4 20L15 9" stroke={INK} strokeWidth="1.2" />
    </Svg>
  );
}

function Orbit({ size, height }: { size: number; height: number }) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [reduced, spin]);
  const items = [Tomato, Carrot, Egg, Leaf];
  const r = size * 0.62;
  const icon = Math.max(14, size * 0.2);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: size / 2, top: height * 0.47, width: 0, height: 0 }}>
      {items.map((Item, i) => (
        <OrbitItem key={i} spin={spin} phase={i / items.length} r={r} icon={icon}>
          <Item />
        </OrbitItem>
      ))}
    </View>
  );
}

function OrbitItem({ spin, phase, r, icon, children }: { spin: { value: number }; phase: number; r: number; icon: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const a = (spin.value + phase) * Math.PI * 2;
    // tilted ellipse: items pass "behind" (smaller, faded) and "in front"
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.32;
    const depth = (Math.sin(a) + 1) / 2;
    return {
      opacity: 0.45 + 0.55 * depth,
      transform: [{ translateX: x - icon / 2 }, { translateY: y - icon / 2 }, { scale: 0.7 + 0.4 * depth }, { rotate: `${a * 40}deg` }],
      zIndex: depth > 0.5 ? 2 : 0,
    };
  });
  return <Animated.View style={[{ position: 'absolute', width: icon, height: icon }, style]}>{children}</Animated.View>;
}

function Sparkle({ color, left, top, size, delay }: { color: string; left: number; top: number; size: number; delay: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      t.value = 0.6;
      return;
    }
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, false));
    return () => cancelAnimation(t);
  }, [reduced, delay, t]);
  const style = useAnimatedStyle(() => {
    const p = Math.sin(t.value * Math.PI);
    return { opacity: p, transform: [{ scale: 0.4 + 0.8 * p }, { rotate: `${45 + t.value * 90}deg` }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left, top, width: size, height: size }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 20 20">
        <Path d="M10 0C11 7 13 9 20 10C13 11 11 13 10 20C9 13 7 11 0 10C7 9 9 7 10 0Z" fill={color} />
      </Svg>
    </Animated.View>
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
  const working = mood === 'working';
  const height = size * 1.3;

  const float = useSharedValue(0); // 0..1 up/down
  const wave = useSharedValue(0); // arm angle
  const blink = useSharedValue(0);
  const glow = useSharedValue(0);
  const pop = useSharedValue(0.85);

  // entrance pop
  useEffect(() => {
    pop.value = reduced ? 1 : withSpring(1, { damping: 9, stiffness: 160 });
  }, [reduced, pop]);

  useEffect(() => {
    cancelAnimation(float);
    cancelAnimation(wave);
    cancelAnimation(glow);
    if (reduced) {
      float.value = 0.5;
      wave.value = 0;
      glow.value = working ? 0.7 : 0;
      return;
    }
    float.value = withRepeat(withTiming(1, { duration: working ? 520 : 1500, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (working) {
      wave.value = withRepeat(withSequence(withTiming(-28, { duration: 260 }), withTiming(8, { duration: 260 })), -1, true);
      glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      glow.value = withTiming(0, { duration: 300 });
      // a friendly wave every few seconds
      wave.value = withRepeat(
        withSequence(
          withDelay(2200, withTiming(-32, { duration: 180 })),
          withTiming(6, { duration: 180 }),
          withTiming(-32, { duration: 180 }),
          withTiming(6, { duration: 180 }),
          withTiming(0, { duration: 220 }),
        ),
        -1,
        false,
      );
    }
    return () => {
      cancelAnimation(float);
      cancelAnimation(wave);
      cancelAnimation(glow);
    };
  }, [working, reduced, float, wave, glow]);

  useEffect(() => {
    cancelAnimation(blink);
    if (reduced) return;
    blink.value = withRepeat(
      withSequence(withDelay(2800, withTiming(1, { duration: 70 })), withTiming(0, { duration: 90 }), withDelay(180, withTiming(1, { duration: 60 })), withTiming(0, { duration: 90 })),
      -1,
      false,
    );
    return () => cancelAnimation(blink);
  }, [reduced, blink]);

  const bodyStyle = useAnimatedStyle(() => {
    const y = interpolate(float.value, [0, 1], [0, working ? -6 : -5]);
    // squash at the bottom of the float, stretch at the top
    const sy = interpolate(float.value, [0, 0.5, 1], [0.97, 1, 1.025]);
    const sx = interpolate(float.value, [0, 0.5, 1], [1.025, 1, 0.985]);
    return { transform: [{ translateY: y }, { scale: pop.value }, { scaleX: sx }, { scaleY: sy }] };
  });
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(float.value, [0, 1], [0.9, 0.55]),
    transform: [{ scaleX: interpolate(float.value, [0, 1], [1, 0.82]) }],
  }));
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wave.value}deg` }] }));
  const lidStyle = useAnimatedStyle(() => ({ opacity: blink.value > 0.05 ? 1 : 0, transform: [{ scaleY: blink.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [working ? 0.35 : 0, working ? 0.85 : 0]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.9, 1.08]) }],
  }));

  const sx = size / 200;
  const sy = height / 260;
  const lid = (cx: number) => ({
    position: 'absolute' as const,
    left: (cx - 9) * sx,
    top: (128 - 10) * sy,
    width: 18 * sx,
    height: 20 * sy,
    borderRadius: 9 * sx,
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
      {/* aura */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -size * 0.2, top: height * 0.02, width: size * 1.4, height: size * 1.4 }, glowStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="gAura" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#FFD86B" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#FFD86B" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#gAura)" />
        </Svg>
      </Animated.View>

      {/* ground shadow */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: size * 0.21, top: height * 0.885, width: size * 0.58, height: height * 0.05, borderRadius: 999, backgroundColor: C.creamDeep }, shadowStyle]} />

      <Animated.View style={[{ width: size, height, transformOrigin: 'bottom' }, bodyStyle]}>
        <Svg width={size} height={height} viewBox="0 0 200 260">
          <GenieDrawing armless doorOpen={working} />
        </Svg>
        {/* waving arm, pivoting at the shoulder (143,134) */}
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: 0, top: 0, width: size, height, transformOrigin: [143 * sx, 134 * sy, 0] }, armStyle]}
        >
          <Svg width={size} height={height} viewBox="0 0 200 260">
            <Arm />
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[lid(84), lidStyle]} />
        <Animated.View pointerEvents="none" style={[lid(114), lidStyle]} />
      </Animated.View>

      {working ? (
        <>
          <Orbit size={size} height={height} />
          <Sparkle color={C.honey} left={size * 0.02} top={height * 0.08} size={Math.max(8, size * 0.11)} delay={0} />
          <Sparkle color="#FFFFFF" left={size * 0.86} top={height * 0.14} size={Math.max(7, size * 0.09)} delay={260} />
          <Sparkle color={C.honey} left={size * 0.9} top={height * 0.5} size={Math.max(8, size * 0.1)} delay={520} />
        </>
      ) : null}
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
