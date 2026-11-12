import { useTheme } from '@/lib/theme-context';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { PlatformBadge } from '@/components/brand';
import { Button, PressableScale, Txt, Highlight, Skeleton } from '@/components/ui';
import { detectPlatform, IMPORT_STEPS, importRecipe, PLATFORM_LABEL, type ImportInput, type ImportStep } from '@/lib/services/kitchen-ai';
import { useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';

export default function ImportLoading() {
  const { C } = useTheme();
  const params = useLocalSearchParams<{ kind?: string; url?: string; uri?: string }>();
  const setImportDraft = useApp((s) => s.setImportDraft);
  const [step, setStep] = useState<ImportStep>('caption');
  const cancelled = useRef<boolean>(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const input: ImportInput = params.kind === 'image' || params.kind === 'video' ? { kind: params.kind, uri: params.uri ?? '' } : { kind: 'link', url: params.url ?? '' };
  const platform = input.kind === 'link' ? detectPlatform(input.url) ?? 'web' : 'photo';
  const stepIdx = IMPORT_STEPS.findIndex((s) => s.key === step);
  const mutation = useMutation({
    mutationFn: () => importRecipe(input, (s) => !cancelled.current && setStep(s)),
    onSuccess: (draft) => {
      if (cancelled.current) return;
      haptic.success(); setImportDraft(draft);
      timer.current = setTimeout(() => { if (!cancelled.current) router.replace('/import-review'); }, 350);
    },
    onError: () => { if (!cancelled.current) router.replace({ pathname: '/import-failed', params: { url: input.kind === 'link' ? input.url : '', platform } }); },
  });
  useEffect(() => {
    cancelled.current = false;
    mutation.mutate();
    return () => { cancelled.current = true; if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => { cancelled.current = true; router.back(); };
  return (
    <View className="flex-1 bg-cream" testID="import-loading-screen">
      <SheetHeader fullScreen onClose={close} />
      <ScrollView testID="import-loading-content" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 16, flexGrow: 1 }}>
        <View className="mb-6 flex-row items-center self-center rounded-full bg-white px-3 py-2" style={{ gap: 7 }}><PlatformBadge platform={platform} size={20} /><Txt label weight="extrabold" className="text-[13px] uppercase tracking-wider">{PLATFORM_LABEL[platform]} · importing</Txt></View>
        <View testID="import-recipe-placeholder" accessibilityLabel="Preparing recipe photo and details" accessibilityState={{ busy: true }} style={{ padding: 12, borderRadius: 24, backgroundColor: C.paper, gap: 12 }}>
          <Skeleton testID="import-photo-skeleton" width="100%" height={132} borderRadius={16} />
          <Skeleton testID="import-title-skeleton" width="82%" height={22} borderRadius={6} />
          <View className="flex-row" style={{ gap: 10 }}><Skeleton width={68} height={14} borderRadius={4} /><Skeleton width={84} height={14} borderRadius={4} /></View>
        </View>
        <View className="mt-5 items-center">
          <View testID="import-loading-title" accessible accessibilityLabel="Reading the recipe…" className="flex-row flex-wrap items-center justify-center"><Txt display weight="bold" className="text-center text-[31px] leading-[37px]">Reading the </Txt><Highlight style={{ fontSize: 31, lineHeight: 37 }}>recipe…</Highlight></View>
          <Txt className="mt-2 text-center text-[14px] text-ink-soft">A clean recipe, ready for your kitchen.</Txt>
          <Txt testID="import-demo-notice" className="mt-2 text-center text-[11px] text-ink-soft">FridgeGenie is watching the video and writing it step by step.</Txt>
        </View>
        <View className="mt-6" testID="import-steps" accessibilityState={{ busy: !mutation.isSuccess }} accessibilityLiveRegion="polite" accessibilityLabel={mutation.isSuccess ? 'Recipe ready' : `Preparing recipe: ${IMPORT_STEPS[stepIdx]?.label ?? 'Reading recipe'}`}>
          {IMPORT_STEPS.map((s, i) => {
            const done = i < stepIdx || mutation.isSuccess;
            const active = i === stepIdx && !mutation.isSuccess;
            return <View key={s.key} testID={`import-step-${s.key}`} className="flex-row items-center border-b border-cream-line py-3.5" style={{ gap: 12, opacity: i > stepIdx ? 0.45 : 1 }}>
              <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: done ? C.leaf : 'transparent', borderWidth: done ? 0 : 1.5, borderColor: active ? C.honeyDark : C.inkFaint }}>{done ? <Check size={14} color={C.ink} strokeWidth={3} /> : active ? <View className="h-2 w-2 rounded-full bg-honey" /> : null}</View>
              <Txt weight={active ? 'extrabold' : 'semibold'} className="flex-1 text-[14px]" style={{ color: active ? C.honeyDark : C.ink }}>{s.label}</Txt>
              <Txt className="text-[12px] text-ink-soft">{done ? 'Done' : active ? 'Now' : ''}</Txt>
            </View>;
          })}
        </View>
      </ScrollView>
      <View className="px-5 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button testID="import-preparing" label="Preparing your recipe" loading disabled />
        <PressableScale testID="import-back-to-recipes" accessibilityRole="button" accessibilityLabel="Back to recipes" onPress={() => { cancelled.current = true; router.replace('/recipes'); }}><Txt weight="extrabold" className="py-4 text-center text-[14px]">Back to recipes</Txt></PressableScale>
      </View>
    </View>
  );
}
