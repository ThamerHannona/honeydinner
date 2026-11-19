import { useTheme } from '@/lib/theme-context';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Book, Home, List, Plus, Refrigerator } from 'lucide-react-native';
import { HardShadow, PressableScale, Txt } from '@/components/ui';
import { useApp } from '@/lib/store';
import { haptic, offsets, shape } from '@/lib/theme';

const ITEMS = [
  { name: 'index', title: 'Tonight', testID: 'tab-tonight', Icon: Home },
  { name: 'recipes', title: 'Recipes', testID: 'tab-recipes', Icon: Book },
  { name: 'pantry', title: 'Kitchen', testID: 'tab-pantry', Icon: Refrigerator },
  { name: 'groceries', title: 'List', testID: 'tab-groceries', Icon: List },
];

// Cartoony springs: squash on touch, boing on release, settle with a wobble.
const squash = { damping: 14, stiffness: 700, mass: 0.4 };
const boing = { damping: 7, stiffness: 380, mass: 0.6 };
const settle = { damping: 11, stiffness: 260, mass: 0.7 };

type Personality = 'hop' | 'flip' | 'shake' | 'tick';
const PERSONALITY: Record<string, Personality> = { index: 'hop', recipes: 'flip', pantry: 'shake', groceries: 'tick' };

function Sparks({ fire, color }: { fire: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!fire) return;
    t.value = 0;
    t.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [fire, t]);
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (-160 + i * 35) * (Math.PI / 180);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const style = useAnimatedStyle(() => ({
          opacity: t.value > 0 && t.value < 1 ? 1 - t.value : 0,
          transform: [
            { translateX: Math.cos(angle) * 22 * t.value },
            { translateY: Math.sin(angle) * 22 * t.value - 4 },
            { scale: 1 - t.value * 0.6 },
          ],
        }));
        return <Animated.View key={i} pointerEvents="none" style={[{ position: 'absolute', top: 10, width: i % 2 ? 4 : 5, height: i % 2 ? 4 : 5, borderRadius: 3, backgroundColor: color }, style]} />;
      })}
    </>
  );
}

function TabItem({
  item,
  active,
  onPress,
}: {
  item: (typeof ITEMS)[number];
  active: boolean;
  onPress: () => void;
}) {
  const { C } = useTheme();
  const personality = PERSONALITY[item.name] ?? 'hop';
  const sx = useSharedValue(active ? 1.08 : 1);
  const sy = useSharedValue(active ? 1.08 : 1);
  const ty = useSharedValue(active ? -2 : 0);
  const rot = useSharedValue(0);
  const flip = useSharedValue(0);
  const blob = useSharedValue(active ? 1 : 0);
  const [fire, setFire] = useState(0);
  const wasActive = useRef(active);

  const celebrate = () => {
    sx.value = withSequence(withSpring(1.34, boing), withSpring(1.08, settle));
    sy.value = withSequence(withSpring(1.3, boing), withSpring(1.08, settle));
    switch (personality) {
      case 'hop':
        ty.value = withSequence(withTiming(-11, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(-2, boing));
        break;
      case 'flip':
        flip.value = 0;
        flip.value = withTiming(360, { duration: 520, easing: Easing.out(Easing.back(1.4)) });
        ty.value = withSpring(-2, settle);
        break;
      case 'shake':
        rot.value = withSequence(withTiming(-14, { duration: 70 }), withTiming(12, { duration: 80 }), withTiming(-8, { duration: 80 }), withTiming(5, { duration: 80 }), withSpring(0, settle));
        ty.value = withSpring(-2, settle);
        break;
      case 'tick':
        rot.value = withSequence(withTiming(-18, { duration: 110 }), withSpring(0, boing));
        ty.value = withSequence(withTiming(-6, { duration: 110 }), withSpring(-2, settle));
        break;
    }
    blob.value = 0;
    blob.value = withSpring(1, boing);
    setFire((n) => n + 1);
  };

  useEffect(() => {
    if (active && !wasActive.current) celebrate();
    if (!active && wasActive.current) {
      sx.value = withSpring(1, settle);
      sy.value = withSpring(1, settle);
      ty.value = withSpring(0, settle);
      blob.value = withTiming(0, { duration: 160 });
    }
    wasActive.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { perspective: 400 }, { rotateY: `${flip.value}deg` }, { rotate: `${rot.value}deg` }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));
  const blobStyle = useAnimatedStyle(() => ({
    opacity: blob.value > 0.02 ? 1 : 0,
    transform: [{ scaleX: 0.4 + blob.value * 0.6 }, { scaleY: 0.2 + blob.value * 0.8 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + blob.value * 0.06 }] }));

  return (
    <Pressable
      testID={item.testID}
      accessibilityRole="tab"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: active }}
      className="flex-1 items-center justify-center"
      style={{ minHeight: 44 }}
      onPressIn={() => {
        haptic.select();
        // squish like a marshmallow
        sx.value = withSpring(1.18, squash);
        sy.value = withSpring(0.8, squash);
        ty.value = withSpring(3, squash);
      }}
      onPressOut={() => {
        if (active) {
          // already here: a little wobble so it still feels alive
          sx.value = withSequence(withSpring(1.2, boing), withSpring(1.08, settle));
          sy.value = withSequence(withSpring(1.2, boing), withSpring(1.08, settle));
          ty.value = withSpring(-2, settle);
          rot.value = withSequence(withTiming(-6, { duration: 70 }), withSpring(0, boing));
        }
      }}
      onPress={() => {
        if (!active) haptic.tap();
        onPress();
      }}
    >
      <View style={{ alignItems: 'center', gap: 3 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 52, height: 30 }}>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 50, height: 30, borderRadius: 15, backgroundColor: C.honey, opacity: 0.32 }, blobStyle]} />
          <Sparks fire={fire} color={C.honey} />
          <Animated.View style={iconStyle}>
            <item.Icon size={23} strokeWidth={active ? 2.1 : 1.8} color={active ? C.ink : C.muted} fill={active ? C.honey : C.transparent} />
          </Animated.View>
        </View>
        <Animated.View style={labelStyle}>
          <Txt weight={active ? 'extrabold' : 'semibold'} style={{ fontSize: 11, color: active ? C.ink : C.muted }}>{item.title}</Txt>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function DinnerTabBar({ state, navigation }: BottomTabBarProps) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 8);
  return (
    <View testID="dinner-tab-bar" className="border-t border-ink bg-cream" style={{ borderTopWidth: 0.5, borderTopColor: C.hairline, paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right), paddingBottom: bottom, paddingTop: 8, height: 58 + bottom }}>
      <View className="flex-1 flex-row items-center">
      {ITEMS.map((item, index) => {
        const route = state.routes.find((r) => r.name === item.name);
        if (!route) return null;
        const active = state.routes[state.index]?.key === route.key;
        return (
          <React.Fragment key={item.name}>
            {index === 2 ? (
              <View className="items-center" style={{ width: 72 }}>
                <PressableScale testID="fab-add" accessibilityRole="button" accessibilityLabel="Add recipe or scan your kitchen" onPress={() => router.push('/add-sheet')} style={{ marginTop: -27 }}>
                  <HardShadow radius={shape.pill} x={offsets.fab.x} y={offsets.fab.y}>
                    <View className="items-center justify-center rounded-full bg-honey" style={{ width: shape.fab, height: shape.fab, borderWidth: shape.border, borderColor: C.ink }}>
                      <Plus size={29} strokeWidth={2} color={C.onHoney} />
                    </View>
                  </HardShadow>
                </PressableScale>
              </View>
            ) : null}
            <TabItem
              item={item}
              active={active}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
            />
          </React.Fragment>
        );
      })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { C } = useTheme();
  const onboarded = useApp((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs tabBar={(props) => <DinnerTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'none', lazy: false, sceneStyle: { backgroundColor: C.cream } }}>
      <Tabs.Screen name="index" options={{ title: 'Tonight' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes' }} />
      <Tabs.Screen name="pantry" options={{ title: 'Kitchen' }} />
      <Tabs.Screen name="groceries" options={{ title: 'List' }} />
    </Tabs>
  );
}
