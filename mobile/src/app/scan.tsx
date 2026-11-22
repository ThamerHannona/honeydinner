import { useTheme } from '@/lib/theme-context';
import { goBack } from '@/lib/nav';
import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Images, X } from 'lucide-react-native';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { ScanProgress } from '@/components/scan-progress';
import { Button, PressableScale, Txt } from '@/components/ui';
import { scanFridge, scanReceipt, type ScanPhoto } from '@/lib/services/kitchen-ai';
import { PlusRequiredError } from '@/lib/plus';
import { useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';

type Mode = 'receipt' | 'fridge';

const FRAME_H = 430;

export default function ScanScreen() {
  const { C } = useTheme();
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'fridge' ? 'fridge' : 'receipt');
  const isReceipt = mode === 'receipt';
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const setScanDraft = useApp((s) => s.setScanDraft);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const granted = !!permission?.granted && Platform.OS !== 'web';
  const scan = useMutation({
    mutationFn: async (photo: ScanPhoto) => (isReceipt ? scanReceipt(photo) : scanFridge(photo)),
    onSuccess: (items) => {
      haptic.success();
      setScanDraft(items);
      router.replace({ pathname: '/scan-review', params: { mode } });
    },
    onError: (err) => {
      if (err instanceof PlusRequiredError) {
        router.push({ pathname: '/plus', params: { reason: 'scan' } });
      }
    },
  });
  const busy = scan.isPending;

  const run = (photo: ScanPhoto) => {
    setShotUri(photo.uri || null);
    scan.mutate(photo);
  };

  const uploadPhoto = async () => {
    if (busy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    haptic.medium();
    run({ uri: result.assets[0].uri });
  };

  const capturePhoto = async () => {
    if (!granted || busy) return;
    haptic.medium();
    const photo = await camRef.current?.takePictureAsync({ quality: 0.9, skipProcessing: false });
    if (!photo?.uri) return;
    run({ uri: photo.uri });
  };

  const bracket = busy ? '#FFFFFFCC' : granted ? '#FFFFFF' : C.ink;

  return (
    <View className="flex-1 bg-cream px-5" style={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }} testID="scan-screen">
      <View className="mb-5 flex-row items-center" style={{ gap: 18 }}>
        <PressableScale testID="scan-close" accessibilityRole="button" accessibilityLabel="Close" onPress={() => goBack()}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-cream-deep"><X size={20} color={C.ink} /></View>
        </PressableScale>
        <View className="flex-1 flex-row rounded-full bg-cream-deep p-1" accessibilityRole="tablist">
          {(['fridge', 'receipt'] as const).map((option) => (
            <PressableScale key={option} testID={`scan-mode-${option}`} accessibilityRole="tab" accessibilityLabel={option === 'fridge' ? 'Fridge' : 'Receipt'} accessibilityState={{ selected: mode === option }} onPress={() => { setMode(option); scan.reset(); setShotUri(null); }} disabled={busy} style={{ flex: 1 }}>
              <View className="h-10 items-center justify-center rounded-full" style={{ backgroundColor: mode === option ? C.ink : 'transparent' }}>
                <Txt weight="extrabold" style={{ color: mode === option ? C.cream : C.inkSoft, fontSize: 14 }}>{option === 'fridge' ? 'Fridge' : 'Receipt'}</Txt>
              </View>
            </PressableScale>
          ))}
        </View>
      </View>

      <Txt display weight="bold" className="mb-4 text-[30px] leading-[35px]" style={{ letterSpacing: -0.7 }}>
        {busy ? (isReceipt ? 'Reading your receipt.' : 'Checking your fridge.') : isReceipt ? 'Scan your shopping.' : 'Point at your fridge.'}
      </Txt>

      <View className="overflow-hidden rounded-[28px]" style={{ height: FRAME_H, flexShrink: 1, backgroundColor: granted ? '#000' : C.creamDeep }} testID="scan-camera-frame">
        {granted ? <CameraView ref={camRef} style={{ flex: 1 }} facing="back" /> : null}

        {!granted && !busy ? (
          <Animated.View entering={FadeIn} className="flex-1 items-center justify-center px-8" style={{ gap: 14 }} testID="scan-no-camera">
            <AnimatedFridgeGenie size={96} mood="idle" testID="scan-idle-genie" />
            <Txt weight="semibold" className="text-center text-[15px] leading-[22px]" style={{ color: C.inkSoft }}>
              {Platform.OS === 'web' ? 'Camera capture is available in the phone app.' : isReceipt ? 'Let FridgeGenie see your receipt — or upload a photo of it.' : 'Let FridgeGenie peek in your fridge — or upload a photo.'}
            </Txt>
            {Platform.OS !== 'web' ? <Button testID="scan-allow-camera" variant="outline" label="Turn on camera" onPress={() => requestPermission()} /> : null}
          </Animated.View>
        ) : null}

        {!busy ? (
          <>
            {[
              { top: 22, left: 22, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
              { top: 22, right: 22, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
              { bottom: 22, left: 22, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
              { bottom: 22, right: 22, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
            ].map((corner, index) => <View key={index} pointerEvents="none" style={[{ position: 'absolute', width: 36, height: 36, borderColor: bracket }, corner]} />)}
            {granted ? (
              <View pointerEvents="none" className="absolute left-0 right-0 items-center" style={{ top: 30 }}>
                <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(20,18,14,0.55)' }}>
                  <Txt weight="extrabold" className="text-[13px]" style={{ color: '#FFFFFF' }}>{isReceipt ? 'Lay it flat · fill the frame' : 'Frame one shelf at a time'}</Txt>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {busy ? <ScanProgress uri={shotUri} mode={mode} height={FRAME_H} /> : null}
      </View>

      <View className="py-4" testID="scan-hint">
        {scan.isError ? (
          <Txt testID="scan-error" weight="bold" className="text-[14px]" style={{ color: '#B23A26' }}>
            {scan.error instanceof PlusRequiredError
              ? "You've used this week's free scans. Plus unlocks as many as you need."
              : 'Couldn’t read that one. Try again with better light, the whole receipt in frame, and no glare.'}
          </Txt>
        ) : (
          <Txt className="text-[13px] leading-[19px]" style={{ color: C.inkSoft }}>
            {busy
              ? 'Hang tight — long receipts take up to half a minute.'
              : isReceipt
                ? 'Tip: long receipt? Take it in one photo from a little higher up — we read it in sections.'
                : 'Tip: open the door wide and avoid bright glare.'}
          </Txt>
        )}
      </View>

      <View className="flex-1" />

      {!busy ? (
        granted ? (
          <View className="flex-row items-center justify-center" style={{ gap: 28 }}>
            <PressableScale testID="scan-upload" accessibilityRole="button" accessibilityLabel="Upload a photo" onPress={() => void uploadPhoto()}>
              <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink }}>
                <Images size={22} color={C.ink} />
              </View>
            </PressableScale>
            <PressableScale testID="scan-shutter" accessibilityRole="button" accessibilityLabel="Take photo" onPress={() => void capturePhoto()}>
              <View className="items-center justify-center rounded-full" style={{ width: 84, height: 84, borderWidth: 4, borderColor: C.ink }}>
                <View className="rounded-full" style={{ width: 66, height: 66, backgroundColor: C.honey }} />
              </View>
            </PressableScale>
            <View style={{ width: 56 }} />
          </View>
        ) : (
          <Button testID="scan-shutter" label="Upload a photo" icon={<Images size={19} color={C.cream} />} onPress={() => { void uploadPhoto(); }} />
        )
      ) : null}
      <Txt className="mt-4 text-center text-[12px]" style={{ color: C.inkSoft }}>You’ll review every item before it goes in your kitchen.</Txt>
    </View>
  );
}
