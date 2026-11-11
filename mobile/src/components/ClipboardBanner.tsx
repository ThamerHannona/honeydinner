import { useTheme } from '@/lib/theme-context';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { detectPlatform, extractUrl, PLATFORM_LABEL } from '@/lib/services/kitchen-ai';
import { useApp } from '@/lib/store';
import { haptic, shadowStrong } from '@/lib/theme';
import type { SourcePlatform } from '@/lib/types';
import { PlatformBadge } from './brand';
import { PressableScale, Txt } from './ui';

/** When the app opens with a recipe link copied, offer to import it. */
export function ClipboardBanner() {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const lastClipboard = useApp((s) => s.lastClipboard);
  const setLastClipboard = useApp((s) => s.setLastClipboard);
  const [found, setFound] = useState<{ url: string; platform: SourcePlatform } | null>(null);

  const check = useCallback(async () => {
    try {
      const has = await Clipboard.hasStringAsync();
      if (!has) return;
      const text = await Clipboard.getStringAsync();
      const url = extractUrl(text ?? '');
      if (!url || url === useApp.getState().lastClipboard) return;
      const platform = detectPlatform(url);
      if (!platform) return;
      setFound({ url, platform });
      haptic.tap();
    } catch {
      // Clipboard access can be refused (e.g. on web) — just skip.
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  useEffect(() => {
    if (found && lastClipboard === found.url) setFound(null);
  }, [lastClipboard, found]);

  if (!found) return null;
  const label = found.platform === 'web' ? 'a recipe link' : `a ${PLATFORM_LABEL[found.platform]} recipe`;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 14, right: 14 }}>
      <Animated.View entering={reduced ? undefined : FadeInUp.springify().damping(15)} exiting={reduced ? undefined : FadeOutUp.duration(180)}>
        <View
          testID="clipboard-banner"
          className="flex-row items-center rounded-2xl bg-white py-2.5 pl-3 pr-2"
          style={[{ gap: 10, borderWidth: 1, borderColor: C.line }, shadowStrong]}
        >
          <PlatformBadge platform={found.platform} size={36} />
          <View className="flex-1">
            <Txt weight="extrabold" className="text-[15px]">
              Found {label} — import it?
            </Txt>
            <Txt className="text-[12px] text-ink-faint" numberOfLines={1}>
              {found.url}
            </Txt>
          </View>
          <PressableScale
            testID="clipboard-import"
            onPress={() => {
              setLastClipboard(found.url);
              router.push({ pathname: '/import-loading', params: { kind: 'link', url: found.url } });
            }}
          >
            <View className="h-11 items-center justify-center rounded-full bg-ink px-4">
              <Txt weight="extrabold" className="text-[14px] text-cream">
                Import
              </Txt>
            </View>
          </PressableScale>
          <PressableScale testID="clipboard-dismiss" accessibilityLabel="Dismiss" onPress={() => setLastClipboard(found.url)} hitSlop={8}>
            <View className="h-11 w-11 items-center justify-center">
              <X size={18} color={C.inkFaint} />
            </View>
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
}
