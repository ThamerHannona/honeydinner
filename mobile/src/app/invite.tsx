import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { goBack } from '@/lib/nav';
import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, Share, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Heart, Home, KeyRound, LogOut, Share2 } from 'lucide-react-native';
import { Avatar, Button, PressableScale, Txt } from '@/components/ui';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import { createKitchen, joinKitchen, leaveKitchen } from '@/lib/household';

/** "Our kitchen": start a shared kitchen and give your partner the code, or join theirs. */
export default function Invite() {
  const { C, inputStyle } = useTheme();
  const members = useApp((s) => s.members);
  const household = useApp((s) => s.household);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const fromProfile = useApp((s) => s.onboarded);
  const me = members.find((m) => m.isMe);
  const partner = members.find((m) => !m.isMe);
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState<string>('');

  const partnerJoined = !!household && household.members.some((m) => m.memberId !== household.memberId);
  const partnerName = partner?.name ?? 'your partner';

  const finish = () => {
    Keyboard.dismiss();
    if (!fromProfile) {
      completeOnboarding();
      router.dismissTo('/');
    } else goBack();
  };

  const create = useMutation({
    mutationFn: createKitchen,
    onSuccess: () => haptic.success(),
    onError: (e: Error) => toast(e.message),
  });
  const join = useMutation({
    mutationFn: () => joinKitchen(code),
    onSuccess: () => {
      haptic.success();
      Keyboard.dismiss();
      toast('You\'re in! Your kitchens are now shared.');
    },
    onError: (e: Error) => toast(e.message),
  });

  const shareCode = async () => {
    if (!household) return;
    try {
      await Share.share({
        message:
          `Join our kitchen on Honey, Dinner? 🍽️\n\n` +
          `Open the app → Profile → Our kitchen → "I have a code" and enter:\n\n${household.code}`,
      });
    } catch {
      /* dismissed */
    }
  };

  const busy = create.isPending || join.isPending;

  return (
    <View className="flex-1" testID="invite-screen" style={{ backgroundColor: C.cream }}>
      <KeyboardAwareScrollView
        bottomOffset={16}
        testID="invite-form"
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 36, paddingBottom: insets.bottom + 20, paddingHorizontal: 28 }}
      >
        <View className="items-center py-6">
          <View className="flex-row items-center">
            <Avatar member={me} size={92} ring />
            <View className="-mx-3 z-10 h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: C.honey, borderWidth: 3, borderColor: C.cream }}>
              <Heart size={22} color={C.ink} fill={C.ink} />
            </View>
            {partnerJoined ? (
              <Avatar member={partner} size={92} ring />
            ) : (
              <View className="h-[92px] w-[92px] items-center justify-center rounded-full" style={{ borderWidth: 3, borderStyle: 'dashed', borderColor: C.honey, backgroundColor: C.honeySoft }}>
                <Txt display weight="extrabold" className="text-[36px]" style={{ color: C.honeyDark }}>?</Txt>
              </View>
            )}
          </View>
        </View>

        {household ? (
          <View testID="kitchen-connected">
            <Txt display weight="extrabold" className="text-[32px] leading-[38px]" style={{ color: C.ink }}>
              {partnerJoined ? `You & ${partnerName} share a kitchen` : 'Your kitchen is ready'}
            </Txt>
            <Txt weight="semibold" className="mt-2 text-[16px] leading-6" style={{ color: C.inkSoft }}>
              {partnerJoined
                ? 'Recipes, pantry, groceries and dinner votes stay in sync on both phones.'
                : `Give ${partner?.name ?? 'your partner'} this code. On their phone: Profile → Our kitchen → I have a code.`}
            </Txt>

            <View className="mt-6 items-center rounded-3xl py-6" style={{ backgroundColor: C.paper, borderWidth: 1, borderColor: C.hairline }}>
              <Txt label weight="extrabold" className="text-[12px] tracking-widest" style={{ color: C.inkSoft }}>KITCHEN CODE</Txt>
              <Txt testID="kitchen-code" selectable display weight="extrabold" className="mt-1 text-[44px]" style={{ color: C.ink, letterSpacing: 4 }}>
                {household.code}
              </Txt>
            </View>

            <View className="mt-4">
              <Button testID="kitchen-share-code" label={`Send code to ${partner?.name ?? 'partner'}`} icon={<Share2 size={19} color={C.paper} />} onPress={shareCode} />
            </View>

            {household.members.length ? (
              <View className="mt-6" style={{ gap: 6 }} testID="kitchen-members">
                <Txt label weight="extrabold" className="text-[12px] tracking-widest" style={{ color: C.inkSoft }}>IN THIS KITCHEN</Txt>
                {household.members.map((m) => (
                  <Txt key={m.memberId} weight="bold" className="text-[16px]">
                    {m.memberId === household.memberId ? `${m.name || 'You'} (you)` : m.name || 'Partner'}
                  </Txt>
                ))}
              </View>
            ) : null}

            <PressableScale
              testID="kitchen-leave"
              accessibilityRole="button"
              onPress={() => {
                void leaveKitchen();
                toast('Left the shared kitchen. Your recipes stay on this phone.');
              }}
              className="mt-8 flex-row items-center self-center"
              style={{ gap: 6, minHeight: 44 }}
            >
              <LogOut size={16} color={C.inkSoft} />
              <Txt weight="bold" className="text-[14px]" style={{ color: C.inkSoft }}>Leave shared kitchen</Txt>
            </PressableScale>
          </View>
        ) : (
          <View testID="kitchen-setup">
            <Txt display weight="extrabold" className="text-[32px] leading-[38px]" style={{ color: C.ink }}>
              Share a kitchen
            </Txt>
            <Txt weight="semibold" className="mb-6 mt-2 text-[16px] leading-6" style={{ color: C.inkSoft }}>
              One pantry, one grocery list, one recipe box — and send each other dinner ideas right in the app.
            </Txt>

            <Button
              testID="kitchen-create"
              label={create.isPending ? 'Setting up…' : 'Start our kitchen'}
              icon={create.isPending ? <ActivityIndicator color={C.paper} /> : <Home size={19} color={C.paper} />}
              onPress={() => create.mutate()}
              disabled={busy}
            />

            <View className="mt-8">
              <Txt weight="extrabold" className="mb-2 text-[15px]">I have a code</Txt>
              <TextInput
                testID="kitchen-code-input"
                accessibilityLabel="Kitchen code"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="ABC-123"
                placeholderTextColor={C.inkFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                style={[inputStyle, { letterSpacing: 3, fontSize: 20 }]}
                returnKeyType="join"
                onSubmitEditing={() => code.replace(/[^A-Za-z0-9]/g, '').length === 6 && join.mutate()}
              />
              <View className="mt-3">
                <Button
                  testID="kitchen-join"
                  variant="outline"
                  label={join.isPending ? 'Joining…' : 'Join kitchen'}
                  icon={<KeyRound size={19} color={C.ink} />}
                  onPress={() => join.mutate()}
                  disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length !== 6}
                />
              </View>
            </View>
          </View>
        )}

        <PressableScale testID="invite-skip" accessibilityRole="button" onPress={finish} style={{ minHeight: 44, justifyContent: 'center' }} className="mt-4 self-center">
          <Txt weight="extrabold" className="px-4 py-3 text-[15px]" style={{ color: C.inkSoft }}>
            {household ? 'Done' : fromProfile ? 'Not now' : 'Skip for now'}
          </Txt>
        </PressableScale>
      </KeyboardAwareScrollView>
    </View>
  );
}
