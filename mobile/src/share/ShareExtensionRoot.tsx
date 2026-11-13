// The "Save to Honey, Dinner?" panel that opens over TikTok / Instagram / Safari
// from the iOS share sheet. It reads the recipe right there, saves it, and lets
// you go straight back to scrolling — like Osta. The app picks it up on next open.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { close, openHostApp, Text, type InitialProps } from 'expo-share-extension';
import * as Haptics from 'expo-haptics';
import { detectPlatform, extractUrl, importRecipe, IMPORT_STEPS, PLATFORM_LABEL, type ImportStep } from '@/lib/services/kitchen-ai';
import { queueLink, queueRecipe } from '@/lib/share-inbox';
import type { RecipeDraft } from '@/lib/types';

const K = {
  cream: '#F4EDE0',
  paper: '#FFFFFF',
  ink: '#14110D',
  inkSoft: '#4E483F',
  muted: '#5E574D',
  hairline: '#D8CDB9',
  honey: '#F4AA22',
  green: '#1DAF3A',
  forest: '#14702A',
  onGreen: '#FBF6EA',
  honeyOnForest: '#FFD36B',
};

type Phase = 'reading' | 'saved' | 'failed' | 'nolink';

export default function ShareExtensionRoot(props: InitialProps) {
  const url = props.url ?? extractUrl(props.text ?? '') ?? null;
  const platform = url ? detectPlatform(url) ?? 'web' : 'web';
  const [phase, setPhase] = useState<Phase>(url ? 'reading' : 'nolink');
  const [step, setStep] = useState<ImportStep>('caption');
  const [recipe, setRecipe] = useState<RecipeDraft | null>(null);
  const finished = useRef<boolean>(false);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    importRecipe({ kind: 'link', url }, (s) => alive && setStep(s))
      .then((draft) => {
        if (!alive || finished.current) return;
        finished.current = true;
        queueRecipe(draft);
        setRecipe(draft);
        setPhase('saved');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      })
      .catch(() => {
        if (!alive || finished.current) return;
        finished.current = true;
        queueLink(url);
        setPhase('failed');
      });
    return () => { alive = false; };
  }, [url]);

  // Leaving before it finished: keep the link so the app can finish the job.
  const dismiss = () => {
    if (url && !finished.current) {
      finished.current = true;
      queueLink(url);
    }
    close();
  };

  const stepIndex = IMPORT_STEPS.findIndex((s) => s.key === step);

  return (
    <View style={s.root} testID="share-ext-root">
      <View style={s.card}>
        <View style={s.grabber} />
        <View style={s.header}>
          <View style={s.logo}>
            <Text allowFontScaling={false} style={s.logoText}>HONEY, DINNER?</Text>
          </View>
          <Pressable onPress={dismiss} hitSlop={12} style={s.closeBtn} accessibilityLabel="Close" testID="share-ext-close">
            <Text allowFontScaling={false} style={s.closeText}>✕</Text>
          </Pressable>
        </View>

        {phase === 'nolink' ? (
          <View style={s.body}>
            <Text allowFontScaling={false} style={s.title}>Share a recipe link</Text>
            <Text allowFontScaling={false} style={s.sub}>
              Share a TikTok, Instagram, Facebook or recipe-site link and FridgeGenie will turn it into a step-by-step recipe.
            </Text>
            <Pressable style={s.primary} onPress={close}><Text allowFontScaling={false} style={s.primaryText}>Got it</Text></Pressable>
          </View>
        ) : null}

        {phase === 'reading' ? (
          <View style={s.body}>
            <Text allowFontScaling={false} style={s.kicker}>{`${PLATFORM_LABEL[platform].toUpperCase()} · SAVING`}</Text>
            <Text allowFontScaling={false} style={s.title}>Reading the recipe…</Text>
            <View style={s.genie}>
              <Text allowFontScaling={false} style={s.genieText}>
                ✦ FridgeGenie is watching the video and writing it up step by step. Keep scrolling if you like — it’ll be in your recipes.
              </Text>
            </View>
            <View style={{ gap: 10, marginTop: 4 }}>
              {IMPORT_STEPS.map((st, i) => (
                <View key={st.key} style={s.stepRow}>
                  {i < stepIndex ? (
                    <View style={[s.dot, { backgroundColor: K.green, borderColor: K.green }]}><Text allowFontScaling={false} style={s.check}>✓</Text></View>
                  ) : i === stepIndex ? (
                    <ActivityIndicator size="small" color={K.honey} style={{ width: 22, height: 22 }} />
                  ) : (
                    <View style={s.dot} />
                  )}
                  <Text allowFontScaling={false} style={[s.stepText, i > stepIndex && { color: K.muted }]}>{st.label}</Text>
                </View>
              ))}
            </View>
            <Pressable style={s.secondary} onPress={dismiss} testID="share-ext-background">
              <Text allowFontScaling={false} style={s.secondaryText}>Finish in the app</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'saved' && recipe ? (
          <View style={s.body}>
            <View style={s.savedRow}>
              {recipe.image ? <Image source={{ uri: recipe.image }} style={s.thumb} /> : <View style={[s.thumb, { backgroundColor: K.hairline }]} />}
              <View style={{ flex: 1 }}>
                <Text allowFontScaling={false} style={s.kicker}>✓ SAVED TO HONEY, DINNER?</Text>
                <Text allowFontScaling={false} style={s.recipeTitle} numberOfLines={2}>{recipe.title}</Text>
                <Text allowFontScaling={false} style={s.meta}>
                  {`${recipe.ingredients.length} ingredients · ${recipe.steps.length} steps · ${recipe.cookTime} min`}
                </Text>
              </View>
            </View>
            {recipe.note ? (
              <View style={s.genie}><Text allowFontScaling={false} style={s.genieText}>✦ {recipe.note}</Text></View>
            ) : null}
            <View style={s.actions}>
              <Pressable style={[s.secondary, { flex: 1, marginTop: 0 }]} onPress={close} testID="share-ext-done">
                <Text allowFontScaling={false} style={s.secondaryText}>Done</Text>
              </Pressable>
              <Pressable style={[s.primary, { flex: 1.3, marginTop: 0 }]} onPress={() => openHostApp('shared')} testID="share-ext-cook">
                <Text allowFontScaling={false} style={s.primaryText}>Cook it now</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'failed' ? (
          <View style={s.body}>
            <Text allowFontScaling={false} style={s.title}>Saved the link</Text>
            <Text allowFontScaling={false} style={s.sub}>
              FridgeGenie couldn’t finish reading this one here. Open Honey, Dinner? and it’ll try again — or you can type it in.
            </Text>
            <View style={s.actions}>
              <Pressable style={[s.secondary, { flex: 1, marginTop: 0 }]} onPress={close}><Text allowFontScaling={false} style={s.secondaryText}>Done</Text></Pressable>
              <Pressable style={[s.primary, { flex: 1.3, marginTop: 0 }]} onPress={() => openHostApp('shared')}><Text allowFontScaling={false} style={s.primaryText}>Open app</Text></Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  card: {
    backgroundColor: K.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderColor: K.ink,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: K.hairline, marginTop: 8, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { backgroundColor: K.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: K.ink },
  logoText: { color: K.onGreen, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE8DC' },
  closeText: { color: K.ink, fontSize: 15, fontWeight: '700' },
  body: { marginTop: 16, gap: 12 },
  kicker: { color: K.forest, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: K.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, fontFamily: 'Georgia' },
  sub: { color: K.inkSoft, fontSize: 15, lineHeight: 21 },
  genie: { backgroundColor: K.forest, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12 },
  genieText: { color: K.onGreen, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: K.hairline, alignItems: 'center', justifyContent: 'center' },
  check: { color: K.onGreen, fontSize: 12, fontWeight: '900' },
  stepText: { color: K.ink, fontSize: 15, fontWeight: '600' },
  savedRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  thumb: { width: 84, height: 108, borderRadius: 14, borderWidth: 1.5, borderColor: K.ink },
  recipeTitle: { color: K.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginTop: 4, fontFamily: 'Georgia' },
  meta: { color: K.muted, fontSize: 13, marginTop: 4, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primary: {
    marginTop: 6, height: 52, borderRadius: 26, backgroundColor: K.ink, alignItems: 'center', justifyContent: 'center',
    shadowColor: K.honey, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  primaryText: { color: K.onGreen, fontSize: 16, fontWeight: '800' },
  secondary: { marginTop: 6, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: K.ink, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: K.ink, fontSize: 16, fontWeight: '700' },
});
