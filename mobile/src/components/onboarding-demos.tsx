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

/** TikTok/Instagram → Share → Honey, Dinner? → saved. */
export function ShareDemo() {
  const { C } = useTheme();
  // 0 video · 1 share sheet · 2 tap Honey, Dinner? · 3 reading · 4 saved
  const stage = useStage(5, 1300);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (stage === 2) pulse.value = withSequence(withTiming(1.25, { duration: 220 }), withTiming(0.92, { duration: 160 }), withTiming(1, { duration: 200 }));
  }, [stage, pulse]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Phone>
      <LinearGradient colors={['#F29A38', '#B23A26', '#3A1F14']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={24} color="#fff" fill="#fff" />
        </View>
        <View style={{ position: 'absolute', left: 12, bottom: 18, right: 40 }}>
          <Txt weight="extrabold" style={{ color: '#fff', fontSize: 12 }}>@grandma.cooks</Txt>
          <Txt weight="semibold" style={{ color: '#fff', fontSize: 11, marginTop: 2 }}>Crispy honey garlic chicken 🔥 #dinner</Txt>
        </View>
        <View style={{ position: 'absolute', right: 10, bottom: 70, alignItems: 'center', gap: 4 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: stage === 0 ? C.honey : 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ fontSize: 14 }}>↗</Txt>
          </View>
          <Txt weight="extrabold" style={{ color: '#fff', fontSize: 9 }}>Share</Txt>
        </View>
      </LinearGradient>

      {stage >= 1 && stage <= 2 ? (
        <Animated.View entering={SlideInDown.springify().damping(18)} exiting={SlideOutDown.duration(200)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#F2F2F7', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 12, paddingBottom: 18 }}>
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
                  <Animated.View style={[{ borderRadius: 12, borderWidth: stage === 2 ? 2 : 0, borderColor: C.honey }, iconStyle]}>
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
      ) : null}

      {stage >= 3 ? (
        <Animated.View entering={SlideInDown.springify().damping(16)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', left: 8, right: 8, bottom: 8, backgroundColor: C.cream, borderRadius: 22, padding: 14, alignItems: 'center', gap: 6 }}>
          {stage === 3 ? (
            <Animated.View key="reading" entering={FadeIn} style={{ alignItems: 'center', gap: 6 }}>
              <AnimatedFridgeGenie size={44} mood="working" testID="demo-share-genie" />
              <Txt weight="extrabold" style={{ fontSize: 12 }}>Reading the recipe…</Txt>
            </Animated.View>
          ) : (
            <Animated.View key="saved" entering={ZoomIn.springify()} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.leaf, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={20} color="#fff" strokeWidth={3} />
              </View>
              <Txt weight="extrabold" style={{ fontSize: 12 }}>Saved · 8 steps · 9 ingredients</Txt>
            </Animated.View>
          )}
        </Animated.View>
      ) : null}
    </Phone>
  );
}

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
