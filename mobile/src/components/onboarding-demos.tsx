/**
 * Little looping "how it works" animations for onboarding. Each one is a
 * stage machine (setInterval) with Reanimated entering animations keyed by
 * stage, so they loop forever without fiddly timing math.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check, Mail, MessageCircle, Play, StickyNote } from 'lucide-react-native';
import { LogoBubble } from '@/components/brand';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { Txt } from '@/components/ui';
import { useTheme } from '@/lib/theme-context';

function useStage(count: number, ms: number) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<number>(reduced ? count - 1 : 0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setStage((s) => (s + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, ms, reduced]);
  return stage;
}

function Phone({ children }: { children: React.ReactNode }) {
  const { C } = useTheme();
  return (
    <View style={{ width: 210, height: 330, borderRadius: 34, borderWidth: 6, borderColor: C.ink, backgroundColor: '#111', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 6, alignSelf: 'center', width: 64, height: 16, borderRadius: 9, backgroundColor: '#000', zIndex: 5 }} />
      {children}
    </View>
  );
}

/** TikTok/Instagram → Share → More → Honey, Dinner? → saved. Driven by shared values (no layout animations), so it always plays. */
export function ShareDemo({ platform = 'tiktok' }: { platform?: 'tiktok' | 'instagram' }) {
  const { C } = useTheme();
  // 0 video · 1 app share row · 2 iOS share sheet · 3 tap Honey, Dinner? · 4 reading · 5 saved
  const stage = useStage(6, 1250);
  const appRow = useSharedValue(0);
  const sheet = useSharedValue(0);
  const card = useSharedValue(0);
  const pulse = useSharedValue(1);
  const tap = useSharedValue(0);
  useEffect(() => {
    const ease = { duration: 320, easing: Easing.out(Easing.cubic) };
    appRow.value = withTiming(stage === 1 ? 1 : 0, ease);
    sheet.value = withTiming(stage === 2 || stage === 3 ? 1 : 0, ease);
    card.value = withTiming(stage >= 4 ? 1 : 0, ease);
    if (stage === 0) pulse.value = withSequence(withTiming(1.3, { duration: 250 }), withTiming(1, { duration: 250 }), withTiming(1.3, { duration: 250 }), withTiming(1, { duration: 250 }));
    tap.value = stage === 3 ? withSequence(withTiming(1.25, { duration: 200 }), withTiming(0.9, { duration: 150 }), withTiming(1, { duration: 200 })) : withTiming(1, { duration: 1 });
  }, [stage, appRow, sheet, card, pulse, tap]);
  const shareBtn = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - appRow.value) * 140 }] }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - sheet.value) * 200 }] }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: card.value, transform: [{ translateY: (1 - card.value) * 40 }, { scale: 0.9 + card.value * 0.1 }] }));
  const hdStyle = useAnimatedStyle(() => ({ transform: [{ scale: tap.value }] }));
  const tt = platform === 'tiktok';

  return (
    <Phone>
      <LinearGradient colors={tt ? ['#F29A38', '#B23A26', '#3A1F14'] : ['#833AB4', '#E1306C', '#F77737']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={24} color="#fff" fill="#fff" />
        </View>
        <View style={{ position: 'absolute', left: 12, bottom: 18, right: 44 }}>
          <Txt weight="extrabold" style={{ color: '#fff', fontSize: 12 }}>@grandma.cooks</Txt>
          <Txt weight="semibold" style={{ color: '#fff', fontSize: 11, marginTop: 2 }}>Crispy honey garlic chicken 🔥</Txt>
        </View>
        <Animated.View style={[{ position: 'absolute', right: 10, bottom: 70, alignItems: 'center', gap: 4 }, shareBtn]}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ fontSize: 15 }}>{tt ? '↪' : '✈'}</Txt>
          </View>
          <Txt weight="extrabold" style={{ color: '#fff', fontSize: 9 }}>Share</Txt>
        </Animated.View>
      </LinearGradient>

      {/* the app's own share row: scroll to "More" */}
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: tt ? '#1C1C1E' : '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 12 }, rowStyle]}>
        <Txt weight="extrabold" style={{ fontSize: 10, color: tt ? '#fff' : '#111', marginBottom: 8 }}>{tt ? 'Share to' : 'Share'}</Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {['#25D366', '#0A84FF', '#FF2D55'].map((bg) => <View key={bg} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bg }} />)}
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}><Txt weight="extrabold" style={{ fontSize: 14 }}>•••</Txt></View>
            <Txt weight="extrabold" style={{ fontSize: 8, color: tt ? '#fff' : '#111', marginTop: 3 }}>More</Txt>
          </View>
        </View>
      </Animated.View>

      {/* iOS share sheet */}
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#F2F2F7', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 12, paddingBottom: 18 }, sheetStyle]}>
        <View style={{ alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: '#C7C7CC', marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[
            { k: 'msg', label: 'Messages', icon: <MessageCircle size={20} color="#fff" />, bg: '#34C759' },
            { k: 'hd', label: 'Honey, Dinner?', icon: null, bg: 'transparent' },
            { k: 'mail', label: 'Mail', icon: <Mail size={20} color="#fff" />, bg: '#0A84FF' },
            { k: 'notes', label: 'Notes', icon: <StickyNote size={20} color="#333" />, bg: '#FFD60A' },
          ].map((a) => (
            <View key={a.k} style={{ alignItems: 'center', width: 44 }}>
              {a.k === 'hd' ? (
                <Animated.View style={[{ borderRadius: 12, borderWidth: 2, borderColor: C.honey }, hdStyle]}>
                  <LogoBubble size="sm" testID="demo-hd-icon" />
                </Animated.View>
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: a.bg, alignItems: 'center', justifyContent: 'center' }}>{a.icon}</View>
              )}
              <Txt numberOfLines={2} style={{ fontSize: 8, textAlign: 'center', marginTop: 4, color: '#333' }}>{a.label}</Txt>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* reading → saved */}
      <Animated.View style={[{ position: 'absolute', left: 8, right: 8, bottom: 8, backgroundColor: C.cream, borderRadius: 22, padding: 14, alignItems: 'center', gap: 6 }, cardStyle]}>
        {stage === 4 ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AnimatedFridgeGenie size={44} mood="working" testID="demo-share-genie" />
            <Txt weight="extrabold" style={{ fontSize: 12 }}>Reading the recipe…</Txt>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.leaf, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={20} color="#fff" strokeWidth={3} />
            </View>
            <Txt weight="extrabold" style={{ fontSize: 12 }}>Saved · 8 steps · 9 ingredients</Txt>
          </View>
        )}
      </Animated.View>
    </Phone>
  );
}

/** Exact taps for each app, shown next to the demo. */
export const SHARE_STEPS: Record<'tiktok' | 'instagram', string[]> = {
  tiktok: [
    'On the video, tap the Share arrow ↪ (right side)',
    'Scroll the “Share to” row all the way right → tap More •••',
    'Tap Honey, Dinner? in the iPhone share sheet',
    'First time? Scroll the app row → More → Edit → turn on Honey, Dinner? (and ⭐ it)',
  ],
  instagram: [
    'On the Reel or post, tap the paper plane ✈',
    'In the bottom row, tap Share to… (or More •••)',
    'Tap Honey, Dinner? in the iPhone share sheet',
    'First time? Scroll the app row → More → Edit → turn on Honey, Dinner? (and ⭐ it)',
  ],
};

/** A receipt gets scanned and turns into pantry items. */
export function ScanDemo() {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const stage = useStage(5, 1100); // 0 receipt · 1 scanning · 2-4 items pop
  const beam = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    beam.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(beam);
  }, [beam, reduced]);
  const beamStyle = useAnimatedStyle(() => ({ top: `${8 + beam.value * 80}%` as `${number}%` }));
  const lines = [
    ['GV WHL MLK GAL', '3.98'],
    ['BNLS SKNLS CHKN BRST', '9.12'],
    ['HASS AVOC 4CT', '4.99'],
    ['ORG BBY SPIN 5OZ', '3.49'],
    ['TAX', '0.84'],
  ];
  const items = [
    { e: '🥛', n: 'Whole milk', w: 'Fridge · 7 days' },
    { e: '🍗', n: 'Chicken breast', w: 'Fridge · 2 days' },
    { e: '🥑', n: 'Avocados ×4', w: 'Counter · 4 days' },
  ];
  return (
    <View style={{ width: 300, height: 320, alignItems: 'center' }}>
      <View style={{ width: 170, backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 6, transform: [{ rotate: '-3deg' }], shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }}>
        <Txt weight="extrabold" style={{ fontSize: 10, textAlign: 'center', marginBottom: 8, fontFamily: 'Courier' }}>SUPER MART #0421</Txt>
        {lines.map(([a, b]) => (
          <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
            <Txt style={{ fontSize: 9, fontFamily: 'Courier', color: '#333' }}>{a}</Txt>
            <Txt style={{ fontSize: 9, fontFamily: 'Courier', color: '#333' }}>{b}</Txt>
          </View>
        ))}
        {stage >= 1 && !reduced ? (
          <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#62D57F', shadowColor: '#62D57F', shadowOpacity: 1, shadowRadius: 8 }, beamStyle]} />
        ) : null}
      </View>
      <View style={{ marginTop: 16, gap: 7, width: 240 }}>
        {items.map((it, i) =>
          stage >= i + 2 ? (
            <Animated.View key={it.n} entering={FadeInDown.springify().damping(15)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.paper, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.hairline }}>
              <Txt style={{ fontSize: 18 }}>{it.e}</Txt>
              <View style={{ flex: 1 }}>
                <Txt weight="extrabold" style={{ fontSize: 13 }}>{it.n}</Txt>
                <Txt style={{ fontSize: 11, color: C.inkSoft }}>{it.w}</Txt>
              </View>
              <Check size={16} color={C.leaf} strokeWidth={3} />
            </Animated.View>
          ) : (
            <View key={it.n} style={{ height: 46 }} />
          ),
        )}
      </View>
    </View>
  );
}

/** FridgeGenie thinks, then dinner ideas appear. */
export function GenieDemo({ partnerName }: { partnerName?: string | null }) {
  const { C } = useTheme();
  const stage = useStage(4, 1300);
  const ideas = [
    { t: 'Spinach & Feta Omelette', s: 'Uses your spinach before it goes 💀', bg: C.honey },
    { t: 'Garlic Butter Chicken', s: '15 min · you have everything', bg: C.paper },
  ];
  return (
    <View style={{ width: 300, height: 320, alignItems: 'center' }}>
      <AnimatedFridgeGenie size={120} mood={stage === 0 ? 'working' : 'idle'} testID="demo-genie" />
      <View style={{ marginTop: 10, gap: 8, width: 260 }}>
        {ideas.map((idea, i) =>
          stage >= i + 1 ? (
            <Animated.View key={idea.t} entering={FadeInDown.springify().damping(15)} style={{ backgroundColor: idea.bg, borderRadius: 18, padding: 12, borderWidth: 1.5, borderColor: C.ink }}>
              <Txt display weight="bold" style={{ fontSize: 17 }}>{idea.t}</Txt>
              <Txt weight="semibold" style={{ fontSize: 12, marginTop: 2, color: C.ink }}>{idea.s}</Txt>
            </Animated.View>
          ) : (
            <View key={idea.t} style={{ height: 62 }} />
          ),
        )}
        {stage >= 3 ? (
          <Animated.View entering={ZoomIn.springify()} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.forest, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Txt style={{ fontSize: 13 }}>❤️</Txt>
            <Txt weight="extrabold" style={{ fontSize: 12, color: C.onGreen }}>{partnerName || 'Your partner'} voted for the omelette</Txt>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
