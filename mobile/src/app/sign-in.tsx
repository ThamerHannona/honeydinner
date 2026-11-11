import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useState } from 'react';
import { TextInput, View, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Apple, Mail } from 'lucide-react-native';
import { Illustration, Logo } from '@/components/brand';
import { Button, Txt } from '@/components/ui';
import { useApp } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';

function GoogleG() {
  const { C } = useTheme();
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill={C.googleYellow} d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill={C.googleRed} d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill={C.googleGreen} d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill={C.googleBlue} d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

export default function SignIn() {
  const { C, inputStyle } = useTheme();
  const reduceMotion = useReducedMotion();
  const signIn = useApp((s) => s.signIn);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [showEmail, setShowEmail] = useState<boolean>(false);

  const done = () => {
    Keyboard.dismiss();
    signIn();
    router.replace('/invite');
  };

  return (
    <View className="flex-1" testID="sign-in-screen" style={{ backgroundColor: C.cream }}>
      <KeyboardAwareScrollView bottomOffset={16} testID="sign-in-form" style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20, paddingHorizontal: 28 }}
      >
        <Logo size="lg" />
        <View className="flex-1 items-center justify-center py-6">
          <Illustration kind="fridge" size={180} />
        </View>
        <Txt display weight="extrabold" className="text-[32px] leading-[38px]" style={{ color: C.ink }}>
          Let's get your kitchen set up
        </Txt>
        <Txt weight="semibold" className="mb-7 mt-2 text-[16px]" style={{ color: C.inkSoft }}>
          One account for the whole household.
        </Txt>

        <View style={{ gap: 10 }}>
          <Button testID="sign-in-apple" variant="dark" label="Continue with Apple" icon={<Apple size={20} color={C.paper} fill={C.paper} />} onPress={done} />
          <Button testID="sign-in-google" variant="outline" label="Continue with Google" icon={<GoogleG />} onPress={done} />
          {showEmail ? (
            <Animated.View entering={reduceMotion ? undefined : FadeInDown} style={{ gap: 10 }}>
              <TextInput
                testID="sign-in-email-input"
                value={email}
                onChangeText={setEmail}
                autoFocus
                placeholder="you@example.com"
                placeholderTextColor={C.inkFaint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email address"
                returnKeyType="send"
                onSubmitEditing={() => email.includes('@') && done()}
                style={inputStyle}
              />
              <Button testID="sign-in-email-submit" label="Send magic link" onPress={done} disabled={!email.includes('@')} />
            </Animated.View>
          ) : (
            <Button testID="sign-in-email" variant="ghost" label="Continue with email" icon={<Mail size={19} color={C.leafDark} />} onPress={() => setShowEmail(true)} />
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
