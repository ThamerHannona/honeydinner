import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useMemo, useRef, useState } from 'react';
import { TextInput, View, Keyboard } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { ClipboardPaste, Film, ImagePlus, Info, Link2 } from 'lucide-react-native';
import { SheetHeader } from '@/components/app';
import { PLATFORM_COLOR, PlatformBadge, PlatformGlyph } from '@/components/brand';
import { Button, PressableScale, Txt, AView, HardShadow, GenieBubble } from '@/components/ui';
import { detectPlatform, extractUrl, PLATFORM_LABEL } from '@/lib/services/kitchen-ai';
import { haptic, fonts } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import type { SourcePlatform } from '@/lib/types';

type Social = Extract<SourcePlatform, 'tiktok' | 'instagram' | 'facebook' | 'snapchat'>;
const SOCIALS: Social[] = ['tiktok', 'instagram', 'facebook', 'snapchat'];

const PLACEHOLDER: Record<Social | 'any', string> = {
  tiktok: 'Paste a TikTok link',
  instagram: 'Paste an Instagram post or Reel link',
  facebook: 'Paste a Facebook video or post link',
  snapchat: 'Paste a Snapchat Spotlight link',
  any: 'Paste any recipe link',
};

export default function ImportSheet() {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState<string>('');
  const [chosen, setChosen] = useState<Social | 'any' | null>(null);
  const inputRef = useRef<TextInput>(null);

  const url = useMemo(() => extractUrl(text), [text]);
  const detected = useMemo(() => (url ? detectPlatform(url) : null), [url]);

  const tryPaste = async (want: Social | 'any') => {
    try {
      const clip = await Clipboard.getStringAsync();
      const u = extractUrl(clip ?? '');
      if (u && (want === 'any' || detectPlatform(u) === want)) {
        setText(u);
        haptic.success();
        return;
      }
    } catch {
      // ignore
    }
    inputRef.current?.focus();
  };

  const pick = async (kind: 'image' | 'video') => {
    Keyboard.dismiss();
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'image' ? ['images'] : ['videos'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    const uri = res.assets?.[0]?.uri;
    if (res.canceled || !uri) return;
    router.replace({ pathname: '/import-loading', params: { kind, uri } });
  };

  const start = () => {
    if (!url) return;
    Keyboard.dismiss();
    haptic.medium();
    router.replace({ pathname: '/import-loading', params: { kind: 'link', url } });
  };

  return (
    <View className="flex-1" testID="import-screen" style={{ backgroundColor: C.cream }}>
      <SheetHeader title="Save something good." subtitle="Try a link from your favorite food creator." />
      <KeyboardAwareScrollView bottomOffset={16} testID="import-form" style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
      >
        {/* Link field */}
        <HardShadow radius={16} style={{ marginTop: 8 }}><View
          className="flex-row items-center rounded-2xl pl-3 pr-2"
          style={[{ backgroundColor: C.paper }, { minHeight: 60, gap: 10, borderWidth: 2, borderColor: detected ? PLATFORM_COLOR[detected] === C.snapchat ? C.honey : PLATFORM_COLOR[detected] : C.line }]}
        >
          {detected ? (
            <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify()} key={detected}>
              <PlatformBadge platform={detected} size={34} />
            </Animated.View>
          ) : (
            <View className="h-[34px] w-[34px] items-center justify-center rounded-full" style={{ backgroundColor: C.creamDeep }}>
              <Link2 size={18} color={C.inkFaint} />
            </View>
          )}
          <TextInput
            ref={inputRef}
            testID="import-link-input"
            accessibilityLabel="Recipe link"
            value={text}
            onChangeText={setText}
            placeholder={PLACEHOLDER[chosen ?? 'any']}
            placeholderTextColor={C.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={start}
            style={{ flex: 1, minHeight: 56, fontFamily: fonts.semibold, fontSize: 16, color: C.ink }}
          />
          {!text ? (
            <PressableScale testID="import-paste" accessibilityRole="button" onPress={() => tryPaste(chosen ?? 'any')} accessibilityLabel="Paste link">
              <View className="h-11 flex-row items-center rounded-xl px-3" style={{ backgroundColor: C.leafSoft, gap: 5 }}>
                <ClipboardPaste size={16} color={C.leafDark} />
                <Txt weight="extrabold" className="text-[14px]" style={{ color: C.leafDark }}>
                  Paste
                </Txt>
              </View>
            </PressableScale>
          ) : null}
        </View></HardShadow>
        {detected ? (
          <AView entering={reduceMotion ? undefined : FadeIn} className="mt-2 px-1">
            <Txt weight="bold" className="text-[13px]" testID="detected-platform" style={{ color: C.inkSoft }}>
              {detected === 'web' ? 'Recipe website detected' : `${PLATFORM_LABEL[detected]} post detected`}
            </Txt>
          </AView>
        ) : null}

        {/* Sources */}
        <Txt label weight="extrabold" className="mb-3 mt-7 text-[15px] uppercase tracking-widest" style={{ color: C.inkFaint }}>
          Where's it from?
        </Txt>
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {SOCIALS.map((p, i) => {
            const active = chosen === p;
            return (
              <Animated.View key={p} entering={reduceMotion ? undefined : FadeInDown.delay(i * 40)} style={{ width: '47.8%' }}>
                <PressableScale
                  testID={`source-${p}`}
                  accessibilityRole="button"
                  accessibilityLabel={PLATFORM_LABEL[p]}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setChosen(p);
                    tryPaste(p);
                  }}
                >
                  <HardShadow color={C.ink} x={5} y={5} radius={16} enabled={active} style={{ transform: [{ translateX: active ? -2 : 0 }, { translateY: active ? -2 : 0 }] }}><View
                    className="h-16 flex-row items-center rounded-2xl px-3"
                    style={[{ backgroundColor: C.paper }, { gap: 10, borderWidth: 2, borderColor: active ? C.ink : C.transparent, backgroundColor: active ? C.selectedCard : C.paper }]}
                  >
                    <View
                      className="h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: PLATFORM_COLOR[p], borderWidth: p === 'snapchat' ? 1 : 0, borderColor: C.honey }}
                    >
                      <PlatformGlyph platform={p} size={22} />
                    </View>
                    <Txt weight="extrabold" className="text-[15px]" style={{ color: C.ink }}>
                      {PLATFORM_LABEL[p]}
                    </Txt>
                  </View></HardShadow>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        {chosen === 'snapchat' ? (
          <AView entering={reduceMotion ? undefined : FadeInDown} className="mt-3 flex-row rounded-2xl p-3.5" style={{ backgroundColor: C.honeySoft, gap: 10 }} testID="snapchat-note">
            <Info size={18} color={C.honeyDark} />
            <Txt weight="bold" className="flex-1 text-[14px] leading-5" style={{ color: C.ink }}>
              Public Spotlight link, or save a screen recording of the snap.
            </Txt>
          </AView>
        ) : null}

        <View className="mt-3 overflow-hidden rounded-2xl" style={{ backgroundColor: C.paper }}>
          {[
            { key: 'link', label: 'Paste any link', sub: 'Blogs, YouTube, recipe sites', icon: Link2, onPress: () => { setChosen('any'); tryPaste('any'); } },
            { key: 'photo', label: 'Screenshot / Photo', sub: 'A cookbook page or a saved screenshot', icon: ImagePlus, onPress: () => pick('image') },
            { key: 'recording', label: 'Screen recording', sub: 'Perfect for Snaps and Stories', icon: Film, onPress: () => pick('video') },
          ].map((o, i) => {
            const Icon = o.icon;
            return (
              <PressableScale key={o.key} testID={`source-${o.key}`} accessibilityRole="button" accessibilityLabel={o.label} onPress={o.onPress} scaleTo={0.98}>
                <View className="min-h-[64px] flex-row items-center px-3.5" style={{ gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                  <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.creamDeep }}>
                    <Icon size={20} color={C.ink} />
                  </View>
                  <View className="flex-1 py-2">
                    <Txt weight="extrabold" className="text-[15px]" style={{ color: C.ink }}>
                      {o.label}
                    </Txt>
                    <Txt weight="semibold" className="text-[13px]" style={{ color: C.inkFaint }}>
                      {o.sub}
                    </Txt>
                  </View>
                </View>
              </PressableScale>
            );
          })}
        </View>

        <View className="mt-6">
          <GenieBubble text="Preview imports use sample recipes for now. Review and edit before saving." />
        </View>

        <View className="mt-6">
          <Button testID="import-start" label={url ? 'Import recipe' : 'Paste a link to import'} onPress={start} disabled={!url} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
