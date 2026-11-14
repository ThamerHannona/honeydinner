import { useTheme } from '@/lib/theme-context';
import React, { useEffect } from 'react';
import { LayoutChangeEvent, Platform, Pressable, View } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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

const spring = { damping: 16, stiffness: 220, mass: 0.7 };

function TabItem({
  item,
  active,
  onPress,
  onLayout,
}: {
  item: (typeof ITEMS)[number];
  active: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const { C } = useTheme();
  const scale = useSharedValue(active ? 1.12 : 1);
  useEffect(() => {
    scale.value = withSpring(active ? 1.12 : 1, spring);
  }, [active, scale]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      testID={item.testID}
      accessibilityRole="tab"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: active }}
      className="flex-1 items-center justify-center"
      style={{ minHeight: 44, gap: 3 }}
      onPress={onPress}
      onLayout={onLayout}
    >
      <Animated.View style={iconStyle}>
        <item.Icon size={22} strokeWidth={1.8} color={active ? C.ink : C.muted} fill={active ? C.honey : C.transparent} />
      </Animated.View>
      <Txt weight={active ? 'extrabold' : 'semibold'} style={{ fontSize: 11, color: active ? C.ink : C.muted }}>{item.title}</Txt>
    </Pressable>
  );
}

function DinnerTabBar({ state, navigation }: BottomTabBarProps) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 8);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const layouts = React.useRef<Record<string, { x: number; width: number }>>({});

  const moveIndicator = (name: string) => {
    const layout = layouts.current[name];
    if (!layout) return;
    indicatorX.value = withSpring(layout.x + (layout.width - 18) / 2, spring);
    indicatorW.value = withSpring(18, spring);
  };

  useEffect(() => {
    const route = state.routes[state.index];
    if (route) moveIndicator(route.name);
  }, [state.index, state.routes]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  return (
    <View testID="dinner-tab-bar" className="border-t border-ink bg-cream" style={{ borderTopWidth: 0.5, borderTopColor: C.hairline, paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right), paddingBottom: bottom, paddingTop: 8, height: 58 + bottom }}>
      <View className="flex-1 flex-row items-center">
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -4, left: 0, height: 3, borderRadius: 2, backgroundColor: C.honey }, indicatorStyle]} />
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
              onLayout={(e) => {
                layouts.current[item.name] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                if (active) moveIndicator(item.name);
              }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) { haptic.select(); navigation.navigate(route.name, route.params); }
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
    <Tabs tabBar={(props) => <DinnerTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: C.cream } }}>
      <Tabs.Screen name="index" options={{ title: 'Tonight' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes' }} />
      <Tabs.Screen name="pantry" options={{ title: 'Kitchen' }} />
      <Tabs.Screen name="groceries" options={{ title: 'List' }} />
    </Tabs>
  );
}
