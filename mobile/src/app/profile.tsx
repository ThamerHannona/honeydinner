import { useTheme } from '@/lib/theme-context';
import React, { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ChevronRight, LogOut, RotateCcw, UserPlus } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { Logo } from '@/components/brand';
import { Avatar, PressableScale, Txt, HardShadow } from '@/components/ui';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';

export default function Profile() {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const members = useApp((s) => s.members);
  const pantryCount = useApp((s) => s.pantry.length);
  const recipeCount = useApp((s) => s.recipes.length);
  const resetDemo = useApp((s) => s.resetDemo);
  const signOut = useApp((s) => s.signOut);
  const [expiryAlerts, setExpiryAlerts] = useState<boolean>(true);
  const [voteAlerts, setVoteAlerts] = useState<boolean>(true);

  return (
    <View className="flex-1 bg-cream" testID="profile-screen">
      <SheetHeader title="Household" />
      <ScrollView testID="profile-data" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 24) }}>
        <HardShadow radius={24}><View className="rounded-3xl bg-white p-5" >
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <View className="flex-row">
              {members.map((m, i) => (
                <View key={m.id} style={{ marginLeft: i ? -14 : 0 }}>
                  <Avatar member={m} size={56} ring />
                </View>
              ))}
            </View>
            <View className="flex-1">
              <Txt display weight="bold" className="text-[20px]">
                {members.map((m) => m.name).join(' & ')}
              </Txt>
              <Txt weight="semibold" className="text-[14px] text-ink-faint">
                {pantryCount} items · {recipeCount} recipes
              </Txt>
            </View>
          </View>
        </View></HardShadow>

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          Members
        </Txt>
        <View className="overflow-hidden rounded-2xl bg-white">
          {members.map((m, i) => (
            <View key={m.id} className="min-h-[60px] flex-row items-center px-4" style={{ gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <Avatar member={m} size={36} />
              <Txt weight="extrabold" className="flex-1 text-[16px]">
                {m.name}
                {m.isMe ? <Txt className="text-[14px] text-ink-faint"> (you)</Txt> : null}
              </Txt>
              <Txt weight="bold" className="text-[13px] text-ink-faint">
                {m.isMe ? 'Owner' : 'Partner'}
              </Txt>
            </View>
          ))}
          <Row testID="profile-invite" icon={<UserPlus size={19} color={C.leafDark} />} label="Invite someone" tint={C.leafDark} onPress={() => router.push('/invite')} />
        </View>

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          Nudges from FridgeGenie
        </Txt>
        <View className="overflow-hidden rounded-2xl bg-white">
          <ToggleRow label="Food about to expire" value={expiryAlerts} onChange={setExpiryAlerts} testID="toggle-expiry" />
          <ToggleRow label="When my partner votes" value={voteAlerts} onChange={setVoteAlerts} testID="toggle-votes" first={false} />
        </View>

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          Appearance
        </Txt>
        <AppearancePicker />

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          App
        </Txt>
        <View className="overflow-hidden rounded-2xl bg-white">
          <Row
            testID="profile-reset"
            icon={<RotateCcw size={19} color={C.ink} />}
            label="Reset demo data"
            onPress={() => {
              resetDemo();
              haptic.success();
              toast('Fresh start! Demo kitchen restocked.');
            }}
            first
          />
          <Row
            testID="profile-sign-out"
            icon={<LogOut size={19} color={C.berry} />}
            label="Sign out"
            tint={C.berry}
            onPress={() => {
              signOut();
              router.dismissAll();
              router.replace('/onboarding');
            }}
          />
        </View>

        <View className="mt-10 items-center">
          <Logo size="sm" />
          <Txt weight="semibold" className="mt-2 text-[12px] text-ink-faint">
            Version 1.0 · Made for hungry households
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

function AppearancePicker() {
  const { C, mode, setMode, isDark } = useTheme();
  return (
    <View testID="appearance-picker" accessibilityLabel="Appearance" style={{ backgroundColor: C.paper, borderRadius: 16, padding: 6 }}>
      <View accessibilityRole="radiogroup" className="flex-row" style={{ gap: 6 }}>
        {(['system', 'light', 'dark'] as const).map((option) => (
          <PressableScale haptics={false} key={option} testID={`appearance-${option}`} accessibilityRole="radio" accessibilityLabel={option === 'system' ? 'Use device appearance' : `${option} appearance`} accessibilityState={{ checked: mode === option }} onPress={() => { haptic.select(); setMode(option); }} style={{ flex: 1 }}>
            <View style={{ minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === option ? C.ink : C.transparent }}>
              <Txt weight="bold" style={{ color: mode === option ? C.cream : C.ink, fontSize: 14 }}>{option.charAt(0).toUpperCase() + option.slice(1)}</Txt>
            </View>
          </PressableScale>
        ))}
      </View>
      <Txt testID="appearance-current" className="px-2 pb-2 pt-3 text-[12px]" style={{ color: C.inkFaint }} accessibilityLiveRegion="polite">
        {mode === 'system' ? `Following your device · ${isDark ? 'Dark' : 'Light'}` : `${isDark ? 'Dark' : 'Light'} appearance`}
      </Txt>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  tint,
  first = false,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  tint?: string;
  first?: boolean;
  testID?: string;
}) {
  const { C } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} scaleTo={0.98}>
      <View className="min-h-[56px] flex-row items-center px-4" style={{ gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
        <View className="w-9 items-center">{icon}</View>
        <Txt weight="extrabold" className="flex-1 text-[16px]" style={{ color: tint ?? C.ink }}>
          {label}
        </Txt>
        <ChevronRight size={18} color={C.inkFaint} />
      </View>
    </PressableScale>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  first = true,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  first?: boolean;
  testID?: string;
}) {
  const { C } = useTheme();
  return (
    <PressableScale testID={testID} haptics={false} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => { haptic.select(); onChange(!value); }}>
      <View className="min-h-[56px] flex-row items-center px-4" style={{ gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
        <View className="w-9 items-center"><Bell size={19} color={C.ink} /></View>
        <Txt weight="extrabold" className="flex-1 text-[16px]">{label}</Txt>
        <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch accessible={false} value={value} trackColor={{ true: C.leaf, false: C.line }} />
        </View>
      </View>
    </PressableScale>
  );
}
