import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
import { BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { ToastHost } from '@/components/app';
import { LaunchIntro } from '@/components/launch-intro';
import { useApp } from '@/lib/store';
import { useShareInbox } from '@/lib/use-share-inbox';
import { ThemeProvider, themeVariables, useTheme } from '@/lib/theme-context';
import { useHouseholdSync } from '@/lib/household';
import { useExpiryNudges } from '@/lib/expiry-nudges';
import { useGeniePhotos } from '@/lib/use-genie-photos';

export const unstable_settings = { initialRouteName: '(tabs)' };
SplashScreen.preventAutoHideAsync().catch(() => {});
const queryClient = new QueryClient();

function ShareInboxListener() {
  useShareInbox();
  useHouseholdSync();
  useExpiryNudges();
  useGeniePhotos();
  return null;
}

function RootLayoutNav() {
  const { C, isDark } = useTheme();
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => subscription.remove();
  }, []);
  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...base, colors: { ...base.colors, background: C.cream, card: C.cream, primary: C.leaf, text: C.ink, border: C.hairline, notification: C.alert } };
  const animation = reducedMotion ? 'none' : Platform.OS === 'android' ? 'fade_from_bottom' : 'slide_from_right';
  const sheet = { presentation: 'formSheet' as const, sheetGrabberVisible: true, headerShown: false, contentStyle: { backgroundColor: C.cream } };
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream }, animation, gestureEnabled: true, fullScreenGestureEnabled: Platform.OS === 'ios', animationMatchesGesture: true }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: reducedMotion ? 'none' : 'fade' }} />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="add-sheet" options={{ ...sheet, sheetAllowedDetents: [0.42] }} />
        <Stack.Screen name="pantry-add" options={{ ...sheet, sheetAllowedDetents: [0.85] }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import-loading" options={{ presentation: 'fullScreenModal', animation: reducedMotion ? 'none' : 'fade' }} />
        <Stack.Screen name="import-review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import-failed" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="scan-review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="share-card" options={{ presentation: 'modal' }} />
        <Stack.Screen name="genie-chef" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="cook/[id]" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: C.night } }} />
        <Stack.Screen name="ask-honey" options={{ presentation: 'modal' }} />
        <Stack.Screen name="partner-vote" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

function ThemedRoot() {
  const { C, isDark } = useTheme();
  const [introDone, setIntroDone] = useState<boolean>(false);
  const onIntroReady = useCallback(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  const onIntroComplete = useCallback(() => { setIntroDone(true); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.cream }}>
      <View testID="app-theme-root" style={[{ flex: 1, backgroundColor: C.cream }, themeVariables(C)]}>
        <KeyboardProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={C.cream} />
          <RootLayoutNav />
          <ShareInboxListener />
          <ToastHost />
          {introDone ? null : <LaunchIntro onReady={onIntroReady} onComplete={onIntroComplete} />}
        </KeyboardProvider>
      </View>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Fraunces_600SemiBold, Fraunces_600SemiBold_Italic, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  const hydrated = useApp((s) => s.hydrated);
  if (!(fontsLoaded || !!fontError) || !hydrated) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider><ThemedRoot /></ThemeProvider>
    </QueryClientProvider>
  );
}
