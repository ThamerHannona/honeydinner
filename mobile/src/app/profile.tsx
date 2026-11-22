import { DIETS } from '@/lib/services/genie-recipes';
import type { RecipeLanguage } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
import React, { useState } from 'react';
import { Alert, Keyboard, Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Crown, Share2, ChevronRight, LogOut, RotateCcw, Sparkles, UserPlus } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { Logo } from '@/components/brand';
import { Avatar, PressableScale, Txt, HardShadow } from '@/components/ui';
import { toast, useApp } from '@/lib/store';
import { leaveKitchen } from '@/lib/household';
import { openPaywall } from '@/lib/plus';
import { restorePurchases } from '@/lib/purchases';
import { readShareExtensionLog } from '@/lib/share-inbox';
import { haptic } from '@/lib/theme';

export default function Profile() {
  const { C, inputStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const members = useApp((s) => s.members);
  const household = useApp((s) => s.household);
  const diets = useApp((s) => s.diets);
  const pantryCount = useApp((s) => s.pantry.length);
  const recipeCount = useApp((s) => s.recipes.length);
  const renameMember = useApp((s) => s.renameMember);
  const clearKitchen = useApp((s) => s.clearKitchen);
  const signOut = useApp((s) => s.signOut);
  const isPlus = useApp((s) => s.isPlus);
  const expiryAlerts = useApp((s) => s.expiryNudges);
  const setExpiryAlerts = useApp((s) => s.setExpiryNudges);
  const [voteAlerts, setVoteAlerts] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [logOpen, setLogOpen] = useState<boolean>(false);
  const [logText, setLogText] = useState<string>('');

  const startEdit = (id: string, name: string) => {
    haptic.select();
    setEditingId(id);
    setDraft(name);
  };

  const commitEdit = () => {
    if (editingId) {
      const next = draft.trim();
      if (next) renameMember(editingId, next);
    }
    setEditingId(null);
    Keyboard.dismiss();
  };

  return (
    <View className="flex-1 bg-cream" testID="profile-screen">
      <SheetHeader title="Household" />
      <ScrollView testID="profile-data" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 24) }} keyboardShouldPersistTaps="handled">
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
            <PressableScale
              key={m.id}
              testID={`profile-member-${m.id}`}
              haptics={false}
              onPress={() => (editingId === m.id ? commitEdit() : startEdit(m.id, m.name))}
            >
              <View className="min-h-[60px] flex-row items-center px-4" style={{ gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <Avatar member={m} size={36} />
                {editingId === m.id ? (
                  <TextInput
                    testID={`profile-rename-${m.id}`}
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={commitEdit}
                    onBlur={commitEdit}
                    style={[inputStyle, { flex: 1, height: 40, paddingHorizontal: 10, borderRadius: 10, fontSize: 16 }]}
                    accessibilityLabel={`Edit ${m.isMe ? 'your' : m.name + "'s"} name`}
                  />
                ) : (
                  <Txt weight="extrabold" className="flex-1 text-[16px]">
                    {m.name}
                    {m.isMe ? <Txt className="text-[14px] text-ink-faint"> (you)</Txt> : null}
                  </Txt>
                )}
                <Txt weight="bold" className="text-[13px] text-ink-faint">
                  {m.isMe ? 'Owner' : 'Partner'}
                </Txt>
              </View>
            </PressableScale>
          ))}
          <Row testID="profile-invite" icon={<UserPlus size={19} color={C.leafDark} />} label={household ? `Our kitchen · ${household.code}` : 'Our kitchen — share with your partner'} tint={C.leafDark} onPress={() => router.push('/invite')} />
          <Row testID="profile-diet" icon={<Sparkles size={19} color={C.leafDark} />} label={diets.length ? `Eating style · ${diets.map((d) => DIETS.find((x) => x.id === d)?.label ?? d).join(', ')}` : 'Eating style — keto, paleo, plant-based…'} tint={C.leafDark} onPress={() => router.push('/genie-chef')} />
          <Row testID="profile-how-to-share" icon={<Share2 size={19} color={C.leafDark} />} label="How to save from TikTok & Instagram" tint={C.leafDark} onPress={() => router.push('/how-to-share')} />
          <Row testID="profile-tour" icon={<Sparkles size={19} color={C.leafDark} />} label="Replay the tour (FridgeGenie insists)" tint={C.leafDark} onPress={() => router.push('/onboarding')} />

        </View>

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          Nudges from FridgeGenie
        </Txt>
        <View className="overflow-hidden rounded-2xl bg-white">
          <ToggleRow label="Food about to expire" value={expiryAlerts} onChange={setExpiryAlerts} testID="toggle-expiry" />
          <ToggleRow label="When my partner votes" value={voteAlerts} onChange={setVoteAlerts} testID="toggle-votes" first={false} />
        </View>

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          Recipe language
        </Txt>
        <LanguagePicker />

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          Appearance
        </Txt>
        <AppearancePicker />

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          Honey, Dinner? Plus
        </Txt>
        <View className="overflow-hidden rounded-2xl bg-white">
          <Row
            testID="profile-plus"
            icon={<Crown size={19} color={C.honeyDark} />}
            label={isPlus ? 'Honey, Dinner? Plus · on' : 'Honey, Dinner? Plus'}
            tint={C.honeyDark}
            onPress={() => openPaywall('profile')}
            first
          />
          <Row
            testID="profile-restore"
            icon={<RotateCcw size={19} color={C.ink} />}
            label="Restore purchases"
            onPress={() => {
              void restorePurchases().then((res) => {
                if (res.ok) { haptic.success(); toast('Plus is back on this phone.'); }
                else toast(res.message);
              });
            }}
          />
        </View>

        <Txt label weight="extrabold" className="mb-2 mt-7 text-[15px] uppercase tracking-widest text-ink-faint">
          App
        </Txt>
        <View className="overflow-hidden rounded-2xl bg-white">
          <Row
            testID="profile-reset"
            icon={<RotateCcw size={19} color={C.ink} />}
            label="Clear kitchen data"
            onPress={() => {
              clearKitchen();
              haptic.success();
              toast('Kitchen cleared.');
            }}
            first
          />
          <Row
            testID="profile-sign-out"
            icon={<LogOut size={19} color={C.berry} />}
            label="Reset app"
            tint={C.berry}
            onPress={() => {
              Alert.alert(
                'Reset this kitchen?',
                'Leaves any shared kitchen, clears recipes and lists on this phone, and starts the tour again. Your partner keeps the shared kitchen. Plus stays tied to this Apple ID.',
                [
                  { text: 'Keep cooking', style: 'cancel' },
                  {
                    text: 'Reset app',
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        await leaveKitchen();
                        clearKitchen();
                        signOut();
                        router.dismissAll();
                        router.replace('/onboarding');
                      })();
                    },
                  },
                ],
              );
            }}
          />
        </View>

        <View className="mt-10 items-center">
          <Logo size="sm" />
          <Pressable
            testID="profile-version"
            delayLongPress={450}
            onLongPress={async () => {
              haptic.select();
              const text = await readShareExtensionLog();
              setLogText(text.trim() || 'No share-extension log yet.');
              setLogOpen(true);
            }}
            accessibilityLabel="Version 1.0. Long press to open the share extension log."
          >
            <Txt weight="semibold" className="mt-2 text-[12px] text-ink-faint">
              Version 1.0 · Made for hungry households
            </Txt>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={logOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLogOpen(false)}>
        <View className="flex-1 bg-cream" testID="share-extension-log" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Txt display weight="bold" className="text-[22px]">Share extension log</Txt>
            <PressableScale testID="share-extension-log-close" onPress={() => setLogOpen(false)}>
              <Txt weight="extrabold" className="text-[16px]">Close</Txt>
            </PressableScale>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <Txt className="text-[12px] leading-[18px]" style={{ color: C.inkSoft, fontFamily: 'Menlo' }} selectable>
              {logText}
            </Txt>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const LANGS: { id: RecipeLanguage; label: string; hint: string }[] = [
  { id: 'en', label: 'English', hint: 'Recipes in any language are translated to English.' },
  { id: 'ar', label: 'العربية', hint: 'Recipes in any language are written in Arabic.' },
  { id: 'es', label: 'Español', hint: 'Recipes in any language are written in Spanish.' },
  { id: 'original', label: 'Original', hint: 'Keep each recipe in the language of the post.' },
];

function LanguagePicker() {
  const { C } = useTheme();
  const lang = useApp((s) => s.recipeLanguage);
  const setLang = useApp((s) => s.setRecipeLanguage);
  return (
    <View testID="language-picker" accessibilityLabel="Recipe language" style={{ backgroundColor: C.paper, borderRadius: 16, padding: 6 }}>
      <View accessibilityRole="radiogroup" className="flex-row" style={{ gap: 6 }}>
        {LANGS.map((o) => (
          <PressableScale haptics={false} key={o.id} testID={`language-${o.id}`} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: lang === o.id }} onPress={() => { haptic.select(); setLang(o.id); }} style={{ flex: 1 }}>
            <View style={{ minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: lang === o.id ? C.ink : C.transparent }}>
              <Txt weight="bold" style={{ color: lang === o.id ? C.cream : C.ink, fontSize: 14 }}>{o.label}</Txt>
            </View>
          </PressableScale>
        ))}
      </View>
      <Txt className="px-2 pb-2 pt-3 text-[12px]" style={{ color: C.inkFaint }} accessibilityLiveRegion="polite">
        {LANGS.find((o) => o.id === lang)?.hint} Works with TikTok, Instagram and websites in Arabic, Spanish and more.
      </Txt>
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
