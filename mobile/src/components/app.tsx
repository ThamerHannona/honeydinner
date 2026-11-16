import { useTheme } from '@/lib/theme-context';
import { goBack } from '@/lib/nav';
import React, { useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { RecipeImage as Image } from '@/components/recipe-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { Clock, Plus, X } from 'lucide-react-native';
import { expiryLabel, freshness, type RecipeMatch } from '@/lib/kitchen';
import { useApp, useToast } from '@/lib/store';
import { haptic, shape, offsets, typography, shadow } from '@/lib/theme';
import type { Recipe } from '@/lib/types';
import { PlatformBadge } from './brand';
import { Avatar, GenieBubble, HardShadow, MatchBadge, PressableScale, StatusDot, Txt } from './ui';

/* ---------- Screen header: title + profile avatar ---------- */

export function ScreenHeader({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: React.ReactNode }) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const members = useApp((s) => s.members);
  const me = members.find((m) => m.isMe);
  return (
    <View style={{ paddingTop: insets.top + 8, paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) }} className="flex-row items-end justify-between px-5 pb-3">
      <View className="flex-1">
        {eyebrow ? (
          <Txt label className="mb-1 text-ink" style={typography.label}>
            {eyebrow}
          </Txt>
        ) : null}
        <Txt display className="text-[42px]" style={typography.screen} accessibilityRole="header">
          {title}
        </Txt>
      </View>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        {right ?? <PressableScale
          testID="profile-button"
          accessibilityLabel="Profile and household"
          accessibilityRole="button"
          onPress={() => router.push('/profile')}
          hitSlop={6}
        >
          <View style={[{ borderRadius: 22, padding: 2, backgroundColor: C.white }, shadow]}>
            <Avatar member={me} size={40} />
          </View>
        </PressableScale>}
      </View>
    </View>
  );
}

/* ---------- Floating + button ---------- */

export function Fab({ bottom }: { bottom: number }) {
  const { C } = useTheme();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 20, bottom }}>
      <PressableScale
        testID="fab-add"
        accessibilityLabel="Add: import recipe, scan receipt or scan fridge"
        onPress={() => {
          haptic.medium();
          router.push('/add-sheet');
        }}
        haptics={false}
        scaleTo={0.9}
      >
        <HardShadow radius={shape.pill} x={offsets.fab.x} y={offsets.fab.y}>
          <View style={{ width: shape.fab, height: shape.fab, borderRadius: shape.pill, borderWidth: shape.border, borderColor: C.ink, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={30} color={C.onHoney} strokeWidth={2.8} />
          </View>
        </HardShadow>
      </PressableScale>
    </View>
  );
}

/* ---------- Toast ---------- */

export function ToastHost() {
  const reduced = useReducedMotion();
  const message = useToast((s) => s.message);
  const key = useToast((s) => s.key);
  const hide = useToast((s) => s.hide);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2800);
    return () => clearTimeout(t);
  }, [message, key, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16, zIndex: 999 }}>
      <Animated.View key={key} entering={reduced ? undefined : FadeInUp.springify().damping(16)} exiting={reduced ? undefined : FadeOutUp.duration(200)}>
        <PressableScale onPress={hide} testID="toast" accessibilityRole="alert">
          <GenieBubble text={message} />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

/* ---------- Expiry tag ---------- */

export function ExpiryTag({ expiresAt, testID }: { expiresAt: string | null; testID?: string }) {
  const { C } = useTheme();
  const f = freshness(expiresAt);
  const colors = {
    fresh: { bg: C.leafSoft, fg: C.leafDark },
    soon: { bg: C.honeySoft, fg: C.honeyDark },
    expired: { bg: C.berrySoft, fg: C.berry },
    none: { bg: C.creamDeep, fg: C.inkSoft },
  }[f];
  return (
    <View testID={testID} accessibilityLabel={`${f === 'soon' ? 'Expiring soon' : f === 'fresh' ? 'Fresh' : f === 'expired' ? 'Expired' : 'No expiry'}: ${expiryLabel(expiresAt)}`} className="flex-row items-center rounded-full px-2.5 py-1" style={{ backgroundColor: colors.bg, gap: 5 }}>
      {f === 'none' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.muted }} /> : <StatusDot status={f === 'soon' ? 'soon' : f === 'expired' ? 'today' : 'fresh'} />}
      <Txt label style={{ color: f === 'expired' ? C.ink : colors.fg, fontSize: 13 }}>
        {expiryLabel(expiresAt)}
      </Txt>
    </View>
  );
}

/* ---------- Recipe cards ---------- */

export function RecipeGridCard({
  recipe,
  match,
  width,
  testID,
}: {
  recipe: Recipe;
  match: RecipeMatch;
  width: number;
  testID?: string;
}) {
  const { C } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={`${recipe.title}, ${recipe.cookTime} minutes, you have ${match.have} of ${match.total} ingredients`}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
    >
      <View style={{ width, borderRadius: shape.card, backgroundColor: C.paper, borderWidth: shape.border, borderColor: C.ink, overflow: 'hidden' }}>
        <View>
          <Image
            source={{ uri: recipe.image }}
            style={{ width, height: width * 1.05, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: C.creamDeep }}
            contentFit="cover"
            transition={200}
          />
          <View style={{ position: 'absolute', top: 8, left: 8 }}>
            <PlatformBadge platform={recipe.source.platform} size={26} />
          </View>
          <View style={{ position: 'absolute', bottom: 8, left: 8 }}>
            <MatchBadge have={match.have} total={match.total} compact />
          </View>
        </View>
        <View className="px-3 pb-3 pt-2.5">
          <Txt weight="extrabold" className="text-[15px] leading-[19px]" style={{ minHeight: 38 }} numberOfLines={2}>
            {recipe.title}
          </Txt>
          <View className="mt-1.5 flex-row items-center" style={{ gap: 4 }}>
            <Clock size={13} color={C.inkFaint} strokeWidth={2.4} />
            <Txt weight="bold" className="text-[13px] text-ink-faint">
              {recipe.cookTime} min
            </Txt>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function useMembersById() {
  const members = useApp((s) => s.members);
  return useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
}

/* ---------- Header for modal screens ---------- */

export function SheetHeader({
  title,
  subtitle,
  onClose,
  fullScreen = false,
  left,
}: {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  fullScreen?: boolean;
  left?: React.ReactNode;
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const top = !fullScreen && Platform.OS === 'ios' ? 14 : insets.top + 8;
  return (
    <View style={{ paddingTop: top }} className="flex-row items-start justify-between px-5 pb-3">
      <View className="flex-1 pr-3">
        {left}
        {title ? (
          <Txt display weight="extrabold" className="text-[26px] leading-[32px]" accessibilityRole="header">
            {title}
          </Txt>
        ) : null}
        {subtitle ? (
          <Txt weight="semibold" className="mt-1 text-[15px] leading-5 text-ink-soft">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <PressableScale
        testID="sheet-close"
        accessibilityLabel="Close"
        onPress={onClose ?? (() => (router.canGoBack() ? goBack() : router.replace('/')))}
        hitSlop={8}
      >
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: C.quietFill }}>
          <X size={20} color={C.ink} strokeWidth={2.6} />
        </View>
      </PressableScale>
    </View>
  );
}
