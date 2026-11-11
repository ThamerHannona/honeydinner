import { useTheme } from '@/lib/theme-context';
import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

function DinnerTabBar({ state, navigation }: BottomTabBarProps) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 8);
  return (
    <View testID="dinner-tab-bar" className="flex-row items-center border-t border-ink bg-cream px-3" style={{ borderTopWidth: 0.5, borderTopColor: C.hairline, paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right), paddingBottom: bottom, paddingTop: 8, height: 58 + bottom }}>
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
            <Pressable testID={item.testID} accessibilityRole="tab" accessibilityLabel={item.title} accessibilityState={{ selected: active }} className="flex-1 items-center justify-center" style={{ minHeight: 44, gap: 3 }} onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !event.defaultPrevented) { haptic.select(); navigation.navigate(route.name, route.params); }
            }}>
              <item.Icon size={22} strokeWidth={1.8} color={active ? C.ink : C.muted} fill={active ? C.honey : C.transparent} />
              <Txt weight={active ? 'extrabold' : 'semibold'} style={{ fontSize: 11, color: active ? C.ink : C.muted }}>{item.title}</Txt>
            </Pressable>
          </React.Fragment>
        );
      })}
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
