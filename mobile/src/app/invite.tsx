import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useState } from 'react';
import { Share, TextInput, View, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Link2 } from 'lucide-react-native';
import { Avatar, Button, PressableScale, Txt } from '@/components/ui';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

export default function Invite() {
  const { C, inputStyle } = useTheme();
  const members = useApp((s) => s.members);
  const invitePartner = useApp((s) => s.invitePartner);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const me = members.find((m) => m.isMe);
  const partner = members.find((m) => !m.isMe);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState<string>(partner?.name ?? '');
  const fromProfile = useApp((s) => s.onboarded);

  const finish = () => {
    Keyboard.dismiss();
    if (!fromProfile) completeOnboarding();
    if (fromProfile) router.back();
    else router.dismissTo('/');
  };

  const send = async () => {
    if (!name.trim()) return;
    Keyboard.dismiss();
    haptic.success();
    invitePartner(name);
    try {
      await Share.share({
        message: `Honey, dinner? Join our kitchen so we can decide dinner together: https://honeydinner.app/join/ALX-4821`,
      });
    } catch {
      // share sheet dismissed
    }
    toast(`Invite sent! Say hi to ${name.trim() || 'your partner'}.`);
    finish();
  };

  return (
    <View className="flex-1" testID="invite-screen" style={{ backgroundColor: C.cream }}>
      <KeyboardAwareScrollView bottomOffset={16} testID="invite-form" style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 36, paddingBottom: insets.bottom + 20, paddingHorizontal: 28 }}
      >
        <View className="flex-1 items-center justify-center">
          <View className="flex-row items-center">
            <Avatar member={me} size={92} ring />
            <View className="-mx-3 z-10 h-12 w-12 items-center justify-center rounded-full" style={[{ backgroundColor: C.honey }, { borderWidth: 3, borderColor: C.cream }]}>
              <Heart size={22} color={C.ink} fill={C.ink} />
            </View>
            <View className="h-[92px] w-[92px] items-center justify-center rounded-full" style={{ borderWidth: 3, borderStyle: 'dashed', borderColor: C.honey, backgroundColor: C.honeySoft }}>
              <Txt display weight="extrabold" className="text-[36px]" style={{ color: C.honeyDark }}>
                {(name.trim()[0] ?? '?').toUpperCase()}
              </Txt>
            </View>
          </View>
        </View>

        <Txt display weight="extrabold" className="mt-6 text-[32px] leading-[38px]" style={{ color: C.ink }}>
          Invite your partner
        </Txt>
        <Txt weight="semibold" className="mb-6 mt-2 text-[16px] leading-6" style={{ color: C.inkSoft }}>
          Share one pantry, one grocery list, and vote on dinner together.
        </Txt>

        <TextInput
          testID="invite-name"
          accessibilityLabel="Partner name"
          value={name}
          onChangeText={setName}
          placeholder="Their name"
          placeholderTextColor={C.inkFaint}
          style={inputStyle}
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <View className="mt-3">
          <Button testID="invite-send" label="Send invite" icon={<Link2 size={19} color={C.paper} />} onPress={send} disabled={!name.trim()} />
        </View>
        <PressableScale testID="invite-skip" accessibilityRole="button" onPress={finish} style={{ minHeight: 44, justifyContent: 'center' }} className="mt-2 self-center">
          <Txt weight="extrabold" className="px-4 py-3 text-[15px]" style={{ color: C.inkSoft }}>
            {fromProfile ? 'Cancel' : 'Skip for now'}
          </Txt>
        </PressableScale>
      </KeyboardAwareScrollView>
    </View>
  );
}
