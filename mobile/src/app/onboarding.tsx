import { useTheme } from '@/lib/theme-context';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Share, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOutLeft, useAnimatedStyle, useReducedMotion, withSpring } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { ArrowLeft, Check, KeyRound, Share2, User, Users } from 'lucide-react-native';
import { Logo } from '@/components/brand';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { GenieDemo, ScanDemo, ShareDemo } from '@/components/onboarding-demos';
import { GenieBubble, HardShadow, Highlight, PressableScale, Txt } from '@/components/ui';
import { createKitchen, joinKitchen } from '@/lib/household';
import { DIETS } from '@/lib/services/genie-recipes';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';
import type { Diet, RecipeLanguage } from '@/lib/types';

type Step = 'welcome' | 'name' | 'household' | 'taste' | 'share' | 'scan' | 'genie' | 'nudges' | 'ready';
const STEPS: Step[] = ['welcome', 'name', 'household', 'taste', 'share', 'scan', 'genie', 'nudges', 'ready'];

type HouseMode = 'partner' | 'join' | 'solo' | null;

const LANGS: { id: RecipeLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'es', label: 'Español' },
  { id: 'original', label: 'Original' },
];

export default function Onboarding() {
  const { C, inputStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const members = useApp((s) => s.members);
  const renameMember = useApp((s) => s.renameMember);
  const invitePartner = useApp((s) => s.invitePartner);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const household = useApp((s) => s.household);
  const diets = useApp((s) => s.diets);
  const setDiets = useApp((s) => s.setDiets);
  const lang = useApp((s) => s.recipeLanguage);
  const setLang = useApp((s) => s.setRecipeLanguage);
  const setExpiryNudges = useApp((s) => s.setExpiryNudges);

  const me = members.find((m) => m.isMe);
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState<string>(me?.name && me.name !== 'You' ? me.name : '');
  const [houseMode, setHouseMode] = useState<HouseMode>(household ? 'partner' : null);
  const [partner, setPartner] = useState<string>(members.find((m) => !m.isMe)?.name ?? '');
  const [code, setCode] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const idx = STEPS.indexOf(step);
  const first = name.trim().split(' ')[0] || 'friend';
  const partnerFirst = partner.trim().split(' ')[0] || null;

  const go = (s: Step) => {
    Keyboard.dismiss();
    haptic.tap();
    setStep(s);
  };
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const back = () => go(STEPS[Math.max(idx - 1, 0)]);

  const finish = () => {
    haptic.success();
    completeOnboarding(name.trim() || undefined);
    router.replace('/');
  };

  const saveName = () => {
    if (me && name.trim()) renameMember(me.id, name.trim());
    next();
  };

  const startKitchen = async () => {
    if (busy) return;
    if (partner.trim()) invitePartner(partner.trim());
    setBusy(true);
    try {
      await createKitchen();
      haptic.success();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const joinWithCode = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await joinKitchen(code);
      haptic.success();
      toast('You’re in! Your kitchens are now one. 🎉');
      next();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (!household) return;
    try {
      await Share.share({
        message:
          `${partnerFirst ? `${partnerFirst}! ` : ''}Join our kitchen on Honey, Dinner? 🍽️\n\n` +
          `No more “I dunno, what do YOU want?” 😅\n\n` +
          `1. Install Honey, Dinner?\n2. Open it → “Who’s eating?” → “I have a code”\n3. Enter: ${household.code}`,
      });
    } catch {
      /* dismissed */
    }
  };

  const askNudges = async () => {
    try {
      const res = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } });
      setExpiryNudges(res.granted);
      if (res.granted) haptic.success();
    } catch {
      /* ignore */
    }
    next();
  };

  // ── Copy: FridgeGenie's running commentary ───────────────────────────
  const genieSays: Record<Step, string> = useMemo(
    () => ({
      welcome: 'Hi! I’m FridgeGenie. I live in your fridge. I judge nothing… except that yogurt from March.',
      name: 'I’ll remember it. Unlike that half onion in the back of the drawer.',
      household: 'Ending the “I dunno, what do YOU want?” debate since 2026.',
      taste: 'No judgment. Okay — a little judgment for pineapple on pizza.',
      share: 'Stop screenshotting recipes. Your camera roll is 40% pasta and that’s a cry for help.',
      scan: 'Yes, I can read “BNLS SKNLS CHKN BRST.” I speak fluent receipt.',
      genie: 'I’ll use the spinach before it becomes a science project.',
      nudges: 'Only for emergencies. Like wilting cilantro.',
      ready: `${first}, your kitchen is ready. Let’s go make something worth bragging about.`,
    }),
    [first],
  );

  const primary = (label: string, onPress: () => void, opts?: { disabled?: boolean; loading?: boolean; testID?: string }) => (
    <PressableScale testID={opts?.testID ?? 'onboarding-next'} accessibilityRole="button" accessibilityLabel={label} disabled={opts?.disabled || opts?.loading} onPress={onPress}>
      <HardShadow color={C.honey} radius={32}>
        <View className="flex-row items-center justify-center" style={{ height: 58, borderRadius: 32, backgroundColor: C.ink, opacity: opts?.disabled ? 0.45 : 1, gap: 8 }}>
          {opts?.loading ? <ActivityIndicator color={C.cream} /> : null}
          <Txt weight="extrabold" className="text-[17px]" style={{ color: C.cream }}>{label}</Txt>
        </View>
      </HardShadow>
    </PressableScale>
  );
  const secondary = (label: string, onPress: () => void, testID: string) => (
    <PressableScale testID={testID} accessibilityRole="button" onPress={onPress} style={{ alignSelf: 'center' }}>
      <Txt weight="extrabold" className="px-4 py-3 text-[15px]" style={{ color: C.inkSoft }}>{label}</Txt>
    </PressableScale>
  );

  const Heading = ({ eyebrow, title, hl }: { eyebrow: string; title: string; hl?: string }) => (
    <View className="mb-4">
      <Txt label weight="extrabold" className="mb-2 text-[13px]" style={{ color: C.leafDark, letterSpacing: 1.2 }}>{eyebrow}</Txt>
      <Txt display weight="bold" className="text-[32px] leading-[36px]" style={{ letterSpacing: -1 }}>{title}</Txt>
      {hl ? <View className="mt-1 self-start"><Highlight style={{ fontSize: 30, lineHeight: 34 }}>{hl}</Highlight></View> : null}
    </View>
  );

  const Choice = ({ icon, title, sub, on, onPress, testID }: { icon: React.ReactNode; title: string; sub: string; on: boolean; onPress: () => void; testID: string }) => (
    <PressableScale testID={testID} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress}>
      <View className="flex-row items-center rounded-[22px] px-4 py-4" style={{ gap: 14, backgroundColor: on ? C.honey : C.paper, borderWidth: 1.5, borderColor: on ? C.ink : C.hairline }}>
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: on ? C.cream : C.cream }}>{icon}</View>
        <View className="flex-1">
          <Txt weight="extrabold" className="text-[16px]" style={{ color: on ? C.onHoney : C.ink }}>{title}</Txt>
          <Txt weight="semibold" className="mt-0.5 text-[13px]" style={{ color: on ? C.onHoney : C.inkSoft }}>{sub}</Txt>
        </View>
        {on ? <Check size={20} color={C.onHoney} strokeWidth={3} /> : null}
      </View>
    </PressableScale>
  );

  // ── Steps ─────────────────────────────────────────────────────────────
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (step === 'welcome') {
    body = (
      <View className="flex-1 items-center justify-center">
        <Logo size="lg" />
        <View className="mt-2"><AnimatedFridgeGenie size={170} mood="idle" testID="onboarding-genie" /></View>
        <Txt display weight="bold" className="mt-4 text-center text-[34px] leading-[38px]" style={{ letterSpacing: -1.2 }}>Dinner, decided</Txt>
        <View className="mt-1"><Highlight style={{ fontSize: 34, lineHeight: 37 }}>together.</Highlight></View>
        <Txt className="mt-4 text-center text-[16px] leading-[23px]" style={{ color: C.inkSoft, maxWidth: 330 }}>
          Save recipes from TikTok & Instagram, know what’s in your fridge, and stop asking “what’s for dinner?” 400 times a week.
        </Txt>
      </View>
    );
    footer = primary('Let’s eat 🍽️', next);
  }

  if (step === 'name') {
    body = (
      <View>
        <Heading eyebrow="NICE TO MEET YOU" title="First things first —" hl="what do I call you?" />
        <TextInput
          testID="onboarding-name"
          value={name}
          onChangeText={setName}
          placeholder="Your first name"
          placeholderTextColor={C.inkFaint}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={saveName}
          style={[inputStyle, { height: 58, borderRadius: 18, paddingHorizontal: 18, fontSize: 20 }]}
        />
      </View>
    );
    footer = primary(name.trim() ? `That’s me, ${first}` : 'Next', saveName, { disabled: !name.trim() });
  }

  if (step === 'household') {
    const joined = !!household && household.members.length > 1;
    body = (
      <View style={{ gap: 12 }}>
        <Heading eyebrow="YOUR HOUSEHOLD" title="Who’s eating" hl="with you?" />
        <Choice testID="house-partner" icon={<Users size={20} color={C.ink} />} title="Me + my partner" sub="Share recipes, pantry, groceries & votes" on={houseMode === 'partner'} onPress={() => { haptic.select(); setHouseMode('partner'); }} />
        <Choice testID="house-join" icon={<KeyRound size={20} color={C.ink} />} title="I have a kitchen code" sub="Someone already started our kitchen" on={houseMode === 'join'} onPress={() => { haptic.select(); setHouseMode('join'); }} />
        <Choice testID="house-solo" icon={<User size={20} color={C.ink} />} title="Just me (for now)" sub="Party of one. Respect." on={houseMode === 'solo'} onPress={() => { haptic.select(); setHouseMode('solo'); }} />

        {houseMode === 'partner' && !household ? (
          <Animated.View entering={FadeInDown.springify().damping(16)} style={{ gap: 10, marginTop: 6 }}>
            <TextInput testID="onboarding-partner-name" value={partner} onChangeText={setPartner} placeholder="Their name (e.g. Lena)" placeholderTextColor={C.inkFaint} autoCapitalize="words" autoCorrect={false} style={[inputStyle, { height: 54, borderRadius: 16, paddingHorizontal: 16, fontSize: 17 }]} />
          </Animated.View>
        ) : null}

        {houseMode === 'partner' && household ? (
          <Animated.View entering={FadeInDown.springify().damping(16)} className="mt-2 items-center rounded-3xl py-5" style={{ backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink }} testID="onboarding-kitchen-code">
            <Txt label weight="extrabold" className="text-[12px]" style={{ color: C.inkSoft, letterSpacing: 1.4 }}>YOUR KITCHEN CODE</Txt>
            <Txt selectable display weight="extrabold" className="mt-1 text-[42px]" style={{ letterSpacing: 4 }}>{household.code}</Txt>
            <Txt weight="semibold" className="mt-1 px-6 text-center text-[13px]" style={{ color: C.inkSoft }}>
              {joined ? `${partnerFirst ?? 'Your partner'} is in! 🎉` : `${partnerFirst ?? 'They'} enter this in the app → “I have a code.”`}
            </Txt>
            <PressableScale testID="onboarding-send-code" onPress={() => void sendCode()} className="mt-3">
              <View className="flex-row items-center rounded-full px-5 py-3" style={{ backgroundColor: C.honey, gap: 8, borderWidth: 1.5, borderColor: C.ink }}>
                <Share2 size={17} color={C.onHoney} />
                <Txt weight="extrabold" className="text-[15px]" style={{ color: C.onHoney }}>Text the code to {partnerFirst ?? 'them'}</Txt>
              </View>
            </PressableScale>
          </Animated.View>
        ) : null}

        {houseMode === 'join' ? (
          <Animated.View entering={FadeInDown.springify().damping(16)} style={{ marginTop: 6 }}>
            <TextInput testID="onboarding-code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="ABC-123" placeholderTextColor={C.inkFaint} autoCapitalize="characters" autoCorrect={false} maxLength={7} style={[inputStyle, { height: 58, borderRadius: 16, paddingHorizontal: 16, fontSize: 24, letterSpacing: 4, textAlign: 'center' }]} />
          </Animated.View>
        ) : null}
      </View>
    );
    const codeOk = code.replace(/[^A-Za-z0-9]/g, '').length === 6;
    footer =
      houseMode === 'partner' && !household
        ? primary(busy ? 'Setting the table…' : 'Start our kitchen', () => void startKitchen(), { loading: busy, testID: 'onboarding-start-kitchen' })
        : houseMode === 'join'
          ? primary(busy ? 'Joining…' : 'Join kitchen', () => void joinWithCode(), { disabled: !codeOk, loading: busy, testID: 'onboarding-join' })
          : primary(houseMode ? 'Next' : 'Pick one', next, { disabled: !houseMode });
  }

  if (step === 'taste') {
    body = (
      <View>
        <Heading eyebrow="HOW YOU EAT" title="Any eating style" hl="I should know?" />
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {DIETS.map((d) => {
            const on = diets.includes(d.id);
            return (
              <PressableScale key={d.id} testID={`onboarding-diet-${d.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => { haptic.select(); setDiets(on ? diets.filter((x) => x !== d.id) : [...diets, d.id as Diet]); }}>
                <View className="flex-row items-center rounded-full px-3 py-2" style={{ gap: 5, backgroundColor: on ? C.ink : C.paper, borderWidth: 1.5, borderColor: on ? C.ink : C.hairline }}>
                  <Txt className="text-[14px]">{d.emoji}</Txt>
                  <Txt weight="extrabold" className="text-[13px]" style={{ color: on ? C.cream : C.ink }}>{d.label}</Txt>
                </View>
              </PressableScale>
            );
          })}
        </View>
        <Txt label weight="extrabold" className="mb-2 mt-6 text-[13px]" style={{ color: C.leafDark, letterSpacing: 1.2 }}>WRITE MY RECIPES IN</Txt>
        <View className="flex-row" style={{ gap: 8 }}>
          {LANGS.map((l) => (
            <PressableScale key={l.id} testID={`onboarding-lang-${l.id}`} accessibilityRole="radio" accessibilityState={{ checked: lang === l.id }} onPress={() => { haptic.select(); setLang(l.id); }} style={{ flex: 1 }}>
              <View className="h-11 items-center justify-center rounded-full" style={{ backgroundColor: lang === l.id ? C.honey : C.paper, borderWidth: 1.5, borderColor: lang === l.id ? C.ink : C.hairline }}>
                <Txt weight="extrabold" className="text-[13px]" style={{ color: lang === l.id ? C.onHoney : C.ink }}>{l.label}</Txt>
              </View>
            </PressableScale>
          ))}
        </View>
        <Txt className="mt-3 text-[12px]" style={{ color: C.inkSoft }}>Arabic or Spanish TikToks? I’ll read them either way.</Txt>
      </View>
    );
    footer = primary(diets.length ? `Got it — ${diets.length} style${diets.length === 1 ? '' : 's'}` : 'I eat everything 😋', next);
  }

  if (step === 'share') {
    body = (
      <View className="items-center">
        <Heading eyebrow="HOW IT WORKS · 1 OF 3" title="See it on TikTok?" hl="Share it to me." />
        <ShareDemo />
        <View className="mt-4 w-full" style={{ gap: 6 }}>
          {[
            'In TikTok, Instagram or Facebook, tap Share',
            'Tap Honey, Dinner? (not there? swipe → “More” → ⭐ add it)',
            'I write it out step by step and save it',
          ].map((t, i) => (
            <View key={t} className="flex-row items-center" style={{ gap: 10 }}>
              <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: C.ink }}><Txt weight="extrabold" style={{ color: C.cream, fontSize: 12 }}>{i + 1}</Txt></View>
              <Txt weight="semibold" className="flex-1 text-[14px]">{t}</Txt>
            </View>
          ))}
        </View>
      </View>
    );
    footer = primary('Next', next);
  }

  if (step === 'scan') {
    body = (
      <View className="items-center">
        <Heading eyebrow="HOW IT WORKS · 2 OF 3" title="Snap your receipt." hl="I’ll stock the kitchen." />
        <ScanDemo />
        <Txt weight="semibold" className="mt-2 text-center text-[14px]" style={{ color: C.inkSoft }}>Tap + → Scan. Fridge photos work too. I’ll guess when things expire and nag you nicely.</Txt>
      </View>
    );
    footer = primary('Next', next);
  }

  if (step === 'genie') {
    body = (
      <View className="items-center">
        <Heading eyebrow="HOW IT WORKS · 3 OF 3" title="“What can I make?”" hl="Ask me. Anytime." />
        <GenieDemo partnerName={partnerFirst} />
        <Txt weight="semibold" className="mt-2 text-center text-[14px]" style={{ color: C.inkSoft }}>
          I cook from what you have, follow your eating style, and {partnerFirst ? `${partnerFirst} can vote` : 'your partner can vote'} on tonight’s pick.
        </Txt>
      </View>
    );
    footer = primary('Next', next);
  }

  if (step === 'nudges') {
    body = (
      <View className="items-center">
        <Heading eyebrow="ONE LAST THING" title="Can I give you" hl="a little nudge?" />
        <View className="mt-2 w-full rounded-3xl p-4" style={{ backgroundColor: C.paper, borderWidth: 1, borderColor: C.hairline }}>
          <Txt weight="extrabold" className="text-[15px]">🥬 Use your spinach today</Txt>
          <Txt weight="semibold" className="mt-1 text-[13px]" style={{ color: C.inkSoft }}>FridgeGenie: “Spinach Omelette” uses it up. Tap for ideas.</Txt>
        </View>
        <Txt weight="semibold" className="mt-4 text-center text-[14px]" style={{ color: C.inkSoft }}>One gentle note at 4:30 pm when food is about to go off. No spam. Pinky promise.</Txt>
      </View>
    );
    footer = (
      <View style={{ gap: 4 }}>
        {primary('Yes, nudge me', () => void askNudges(), { testID: 'onboarding-allow-nudges' })}
        {secondary('Maybe later', () => { setExpiryNudges(false); next(); }, 'onboarding-skip-nudges')}
      </View>
    );
  }

  if (step === 'ready') {
    body = (
      <View className="flex-1 items-center justify-center">
        <AnimatedFridgeGenie size={150} mood="working" testID="onboarding-ready-genie" />
        <Txt display weight="bold" className="mt-6 text-center text-[34px] leading-[38px]">You’re all set,</Txt>
        <View className="mt-1"><Highlight style={{ fontSize: 34, lineHeight: 37 }}>{first}.</Highlight></View>
        <View className="mt-6 w-full" style={{ gap: 8 }}>
          {[
            household ? `✅ Kitchen ${household.code}${partnerFirst ? ` with ${partnerFirst}` : ''}` : houseMode === 'solo' ? '✅ Party of one (invite anyone later in Profile)' : '✅ Household set',
            diets.length ? `✅ Cooking ${diets.map((d) => DIETS.find((x) => x.id === d)?.label).join(' + ')}` : '✅ Eating everything (bold)',
            '✅ Share from TikTok & Instagram ready',
          ].map((t) => (
            <Txt key={t} weight="bold" className="text-center text-[15px]">{t}</Txt>
          ))}
        </View>
      </View>
    );
    footer = primary('Let’s cook something 🔥', finish, { testID: 'onboarding-finish' });
  }

  return (
    <View className="flex-1" style={{ backgroundColor: C.cream, paddingTop: insets.top + 6 }} testID="onboarding-screen">
      {/* top bar: back + progress + skip */}
      <View className="flex-row items-center px-5" style={{ gap: 12, height: 44 }}>
        {idx > 0 && step !== 'ready' ? (
          <PressableScale testID="onboarding-back" accessibilityLabel="Back" onPress={back}>
            <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: C.paper }}><ArrowLeft size={19} color={C.ink} /></View>
          </PressableScale>
        ) : <View style={{ width: 40 }} />}
        <View className="flex-1 flex-row" style={{ gap: 4 }} accessible accessibilityLabel={`Step ${idx + 1} of ${STEPS.length}`} testID="onboarding-progress">
          {STEPS.map((s, i) => <Seg key={s} filled={i <= idx} />)}
        </View>
        {idx >= 4 && step !== 'ready' ? (
          <PressableScale testID="onboarding-skip" accessibilityLabel="Skip the tour" onPress={() => go('nudges')}>
            <Txt weight="bold" className="px-1 text-[14px]" style={{ color: C.inkSoft }}>Skip</Txt>
          </PressableScale>
        ) : <View style={{ width: 40 }} />}
      </View>

      <KeyboardAwareScrollView bottomOffset={130} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <Animated.View key={step} entering={reduced ? undefined : FadeInRight.springify().damping(18)} exiting={reduced ? undefined : FadeOutLeft.duration(140)} style={{ flexGrow: 1 }}>
          {body}
        </Animated.View>
      </KeyboardAwareScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom, 18) + 6, gap: 12 }}>
        <Animated.View key={`g-${step}`} entering={reduced ? undefined : FadeIn.delay(250).duration(300)}>
          <GenieBubble testID="onboarding-genie-says" text={genieSays[step]} />
        </Animated.View>
        {footer}
      </View>
    </View>
  );
}

function Seg({ filled }: { filled: boolean }) {
  const { C } = useTheme();
  const style = useAnimatedStyle(() => ({ opacity: withSpring(filled ? 1 : 0.25) }));
  return <Animated.View style={[{ flex: 1, height: 5, borderRadius: 3, backgroundColor: C.ink }, style]} />;
}

