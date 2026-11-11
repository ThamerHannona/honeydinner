import { useTheme } from '@/lib/theme-context';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { FridgeMascot, Illustration, Logo, PlatformBadge } from '@/components/brand';
import { PressableScale, Txt, AView, Avatar, HardShadow, Highlight } from '@/components/ui';
import { seedMembers } from '@/lib/mock-data';
import { useApp } from '@/lib/store';


const SLIDES = [
  {
    key: 'dinner',
    title: 'Dinner, decided together.',
    body: 'Save recipes from TikTok, Instagram, Facebook and Snap. I’ll match them to what’s in your fridge.',
  },
  {
    key: 'save',
    title: 'Your recipes, all in one place.',
    body: 'Paste a link from TikTok, Instagram, Facebook or Snap. Get a clean recipe with ingredients and steps — no more lost screenshots.',
  },
  {
    key: 'together',
    title: 'Good food. Same team.',
    body: 'Send your partner three options. They tap a heart. Dinner, decided — and the grocery list is shared.',
  },
];

export default function Onboarding() {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollView>(null);
  const pageRef = useRef<number>(0);
  const [page, setPage] = useState<number>(0);
  const last = page === SLIDES.length - 1;
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const artScale = Math.min(1, Math.max(0.64, (height - insets.top - insets.bottom - 330) / 440));

  useEffect(() => {
    ref.current?.scrollTo({ x: width * pageRef.current, animated: false });
  }, [width]);

  const setCurrentPage = (value: number) => {
    const nextPage = Math.max(0, Math.min(SLIDES.length - 1, value));
    pageRef.current = nextPage;
    setPage(nextPage);
  };

  const finish = () => {
    completeOnboarding();
    router.replace('/');
  };

  const next = () => {
    if (last) {
      finish();
      return;
    }
    ref.current?.scrollTo({ x: width * (page + 1), animated: !reduceMotion });
    setCurrentPage(page + 1);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: C.cream, paddingTop: insets.top }} testID="onboarding-screen">
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setCurrentPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
        testID="onboarding-pager"
      >
        {SLIDES.map((slide, index) => (
          <ScrollView
            key={slide.key}
            style={{ width }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26, paddingTop: 18, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            testID={`onboarding-slide-${index}`}
          >
            {index === 0 ? (
              <>
                <VisualDinner scale={artScale} />
                <Txt label weight="extrabold" className="text-center text-[15px]" style={{ color: C.leafDark, letterSpacing: 0.7, transform: [{ scaleX: 0.88 }] }} testID="onboarding-genie-label">
                  MEET FRIDGEGENIE
                </Txt>
                <View className="mt-3 items-center" testID="onboarding-title-0" accessible accessibilityLabel={slide.title}>
                  <Txt display weight="bold" className="text-center" style={{ fontSize: Math.min(34, width * 0.084), lineHeight: 39, letterSpacing: -1.3 }}>
                    Dinner, decided
                  </Txt>
                  <View className="mt-1">
                    <Highlight style={{ fontSize: 34, lineHeight: 37, letterSpacing: -0.8 }}>together.</Highlight>
                  </View>
                </View>
                <Txt className="mt-4 text-center text-[16px] leading-[23px]" style={{ color: C.inkSoft, maxWidth: 340 }} testID="onboarding-body-0">
                  {slide.body}
                </Txt>
              </>
            ) : (
              <>
                <View className="mb-8" style={{ transform: [{ scale: artScale }] }}>
                  {index === 1 ? <VisualSave /> : <VisualTogether />}
                </View>
                <Txt label weight="extrabold" className="mb-3 text-center text-[15px]" style={{ color: C.leafDark, letterSpacing: 1.3 }}>
                  {index === 1 ? 'SAVE THE GOOD ONES' : 'BETTER, TOGETHER'}
                </Txt>
                <Txt display weight="bold" className="text-center text-[34px] leading-[39px]" style={{ maxWidth: 330, letterSpacing: -1 }} testID={`onboarding-title-${index}`}>
                  {slide.title}
                </Txt>
                <Txt className="mt-4 text-center text-[16px] leading-[24px]" style={{ color: C.inkSoft, maxWidth: 330 }} testID={`onboarding-body-${index}`}>
                  {slide.body}
                </Txt>
              </>
            )}
          </ScrollView>
        ))}
      </ScrollView>

      {page > 0 && !last ? (
        <View style={{ position: 'absolute', top: insets.top + 4, right: 18 }}>
          <PressableScale testID="onboarding-skip" onPress={finish} accessibilityRole="button" accessibilityLabel="Skip onboarding">
            <Txt weight="bold" className="px-3 py-3 text-[14px]" style={{ color: C.inkSoft }}>Skip</Txt>
          </PressableScale>
        </View>
      ) : null}

      <View style={{ paddingBottom: Math.max(insets.bottom, 20) + 10, paddingHorizontal: 22, paddingTop: 12 }}>
        <View className="mb-5 flex-row items-center justify-center" style={{ gap: 6 }} testID="onboarding-progress" accessible accessibilityLabel={`Page ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, index) => (
            <Dot key={slide.key} active={index === page} index={index} />
          ))}
        </View>
        <PressableScale testID="onboarding-next" onPress={next} accessibilityRole="button" accessibilityLabel={last ? 'Get started' : page === 0 ? 'Let’s eat' : 'Next'}>
          <HardShadow color={C.honey} radius={32}><View className="items-center justify-center" style={{ height: 58, borderRadius: 32, backgroundColor: C.ink }}>
            <Txt weight="extrabold" className="text-[17px]" style={{ color: C.cream }}>
              {last ? 'Get started' : page === 0 ? 'Let’s eat' : 'Next'}
            </Txt>
          </View></HardShadow>
        </PressableScale>
      </View>
    </View>
  );
}

function Dot({ active, index }: { active: boolean; index: number }) {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => ({ width: reduceMotion ? (active ? 23 : 8) : withSpring(active ? 23 : 8), backgroundColor: active ? C.ink : C.line }));
  return <Animated.View testID={`onboarding-dot-${index}`} style={[{ height: 8, borderRadius: 4 }, style]} />;
}

function VisualDinner({ scale }: { scale: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <AView entering={reduceMotion ? undefined : FadeIn.duration(500)} style={{ width: 244 * scale, height: 412 * scale, alignItems: 'center', marginBottom: 7 }}>
      <View style={{ alignItems: 'center', width: 244, transform: [{ scale }], transformOrigin: 'top center' }}>
        <Logo size="lg" />
        <View style={{ marginTop: -3 }}>
          <FridgeMascot size={183} />
        </View>
      </View>
    </AView>
  );
}

function VisualSave() {
  const reduceMotion = useReducedMotion();
  const badges = [
    { p: 'tiktok' as const, x: -110, y: -70 },
    { p: 'instagram' as const, x: 100, y: -90 },
    { p: 'facebook' as const, x: -100, y: 70 },
    { p: 'snapchat' as const, x: 110, y: 60 },
  ];
  return (
    <View className="items-center justify-center" style={{ width: 300, height: 260 }} testID="onboarding-save-illustration">
      <Illustration kind="book" size={200} />
      {badges.map((badge, index) => (
        <View key={badge.p} style={{ position: 'absolute', transform: [{ translateX: badge.x }, { translateY: badge.y }] }}>
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(150 + index * 110).springify()}>
            <PlatformBadge platform={badge.p} size={54} />
          </Animated.View>
        </View>
      ))}
    </View>
  );
}

function VisualTogether() {
  const { C } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <View className="items-center" testID="onboarding-together-illustration">
      <View className="flex-row items-center" style={{ gap: 18 }}>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).springify()}>
          <Avatar member={seedMembers[0]} size={86} />
        </Animated.View>
        <AView entering={reduceMotion ? undefined : FadeIn.delay(400)} className="h-14 w-14 items-center justify-center rounded-full bg-berry">
          <Heart size={28} color={C.onGreen} fill={C.onGreen} />
        </AView>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(200).springify()}>
          <Avatar member={seedMembers[1]} size={86} />
        </Animated.View>
      </View>
      <AView entering={reduceMotion ? undefined : FadeInDown.delay(500)} className="mt-6 rounded-2xl bg-leaf px-4 py-3">
        <Txt weight="extrabold" className="text-[15px]" style={{ color: C.onGreen }}>
          Lena picked Garlic Butter Chicken!
        </Txt>
      </AView>
    </View>
  );
}
