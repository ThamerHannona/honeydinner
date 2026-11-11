import { useTheme } from '@/lib/theme-context';
import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, X } from 'lucide-react-native';
import { Button, PressableScale, Txt, Skeleton } from '@/components/ui';
import { ScanSweep } from '@/components/signature-motion';
import { scanFridge, scanReceipt } from '@/lib/services/kitchen-ai';
import { useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';

type Mode = 'receipt' | 'fridge';

export default function ScanScreen() {
  const { C } = useTheme();
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'fridge' ? 'fridge' : 'receipt');
  const isReceipt = mode === 'receipt';
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const setScanDraft = useApp((s) => s.setScanDraft);
  const granted = permission?.granted && Platform.OS !== 'web';
  const scan = useMutation({
    mutationFn: async () => {
      const photo = granted ? await camRef.current?.takePictureAsync({ quality: 0.5, skipProcessing: true }) : null;
      return isReceipt ? scanReceipt(photo?.uri ?? null) : scanFridge(photo?.uri ?? null);
    },
    onSuccess: (items) => { haptic.success(); setScanDraft(items); router.replace({ pathname: '/scan-review', params: { mode } }); },
  });
  return (
    <View className="flex-1 bg-cream px-5" style={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }} testID="scan-screen">
      <View className="mb-5 flex-row items-center" style={{ gap: 18 }}>
        <PressableScale testID="scan-close" accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()}><View className="h-11 w-11 items-center justify-center rounded-full bg-cream-deep"><X size={20} color={C.ink} /></View></PressableScale>
        <View className="flex-1 flex-row rounded-full bg-cream-deep p-1" accessibilityRole="tablist">
          {(['fridge', 'receipt'] as const).map((option) => <PressableScale key={option} testID={`scan-mode-${option}`} accessibilityRole="tab" accessibilityLabel={option === 'fridge' ? 'Fridge' : 'Receipt'} accessibilityState={{ selected: mode === option }} onPress={() => { setMode(option); scan.reset(); }} disabled={scan.isPending} style={{ flex: 1 }}><View className="h-10 items-center justify-center rounded-full" style={{ backgroundColor: mode === option ? C.ink : 'transparent' }}><Txt weight="extrabold" style={{ color: mode === option ? C.cream : C.inkSoft, fontSize: 14 }}>{option === 'fridge' ? 'Fridge' : 'Receipt'}</Txt></View></PressableScale>)}
        </View>
      </View>
      <Txt display weight="bold" className="mb-4 text-[30px] leading-[35px]" style={{ letterSpacing: -0.7 }}>{isReceipt ? 'Scan your shopping.' : 'Point at your fridge.'}</Txt>
      <View className="overflow-hidden rounded-[28px] bg-cream-deep" style={{ height: 425, flexShrink: 1 }} testID="scan-camera-frame">
        {granted ? <CameraView ref={camRef} style={{ flex: 1 }} facing="back" /> : <View className="flex-1 items-center justify-center px-9" style={{ gap: 14 }}><Camera size={36} color={C.inkSoft} /><Txt weight="semibold" className="text-center text-[15px] leading-[23px] text-ink-soft">{Platform.OS === 'web' ? 'Camera capture is available in the phone app.' : 'Allow the camera to frame your fridge or receipt.'}</Txt>{Platform.OS !== 'web' ? <Button testID="scan-allow-camera" variant="outline" label="Allow camera" onPress={() => requestPermission()} /> : null}</View>}
        {scan.isPending ? <View pointerEvents="none" accessibilityState={{ busy: true }} accessibilityLabel="Preparing scanned items" testID="scan-loading" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}><ScanSweep /><View style={{ position: 'absolute', bottom: 24, left: 24, right: 24, gap: 10 }}>
          {[0, 1, 2].map((index) => <View key={index} testID={`scan-item-placeholder-${index}`} style={{ padding: 10, borderRadius: 16, backgroundColor: C.paperOverlay, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={36} height={36} borderRadius={10} />
            <View style={{ flex: 1, gap: 6 }}><Skeleton width={index === 1 ? '65%' : '82%'} height={14} borderRadius={4} /><Skeleton width="40%" height={10} borderRadius={4} /></View>
          </View>)}
        </View></View> : null}
        <View className="absolute left-4 top-4 rounded-lg bg-cream px-2 py-1"><Txt label weight="extrabold" className="text-[13px] uppercase tracking-wider">{granted ? 'Camera view' : 'Camera preview'}</Txt></View>
        {[
          { top: 58, left: 24, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
          { top: 58, right: 24, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
          { bottom: 24, left: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
          { bottom: 24, right: 24, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
        ].map((corner, index) => <View key={index} pointerEvents="none" style={[{ position: 'absolute', width: 36, height: 36, borderColor: granted ? C.onInk : C.ink }, corner]} />)}
      </View>
      <View className="py-4" testID="scan-hint"><Txt weight="bold" className="text-[14px]">{scan.isPending ? 'Preparing sample items…' : isReceipt ? 'Lay the receipt flat, top to bottom.' : 'Open the fridge and frame a shelf.'}</Txt><Txt className="mt-1 text-[12px] leading-[18px] text-ink-soft">Demo mode · recognition uses sample items for now.</Txt></View>
      {scan.isError ? <Txt testID="scan-error" className="mb-3 text-[13px] text-berry">Couldn’t capture that photo. Please try again.</Txt> : null}
      <View className="flex-1" />
      <Button testID="scan-shutter" label={scan.isPending ? 'Preparing items…' : 'Try sample scan'} loading={scan.isPending} onPress={() => { haptic.medium(); scan.mutate(); }} />
      <Txt className="mt-4 text-center text-[12px] text-ink-soft">Review every item before adding it to your kitchen.</Txt>
    </View>
  );
}
