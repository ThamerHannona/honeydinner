import React, { useEffect } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, StyleSheet, Text, type TextProps, type TextStyle, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { cn } from '@/lib/cn';
import { fonts, haptic, motion, offsets, shape, signature, typography } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import type { Member } from '@/lib/types';

type Weight = 'regular' | 'semibold' | 'bold' | 'extrabold';
const BODY: Record<Weight, string> = { regular: fonts.body, semibold: fonts.semibold, bold: fonts.bold, extrabold: fonts.bold };

const RTL_CHARS = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export function Txt({ weight = 'regular', display = false, label = false, italic = false, className, style, ...rest }: TextProps & { weight?: Weight; display?: boolean; label?: boolean; italic?: boolean; className?: string }) {
  const flat = StyleSheet.flatten(style);
  const isLabel = !display && (label || className?.split(' ').includes('uppercase') || flat?.textTransform === 'uppercase');
  const isItalic = italic || flat?.fontStyle === 'italic';
  const font = display ? isItalic ? fonts.displayItalic : fonts.display : isLabel ? weight === 'extrabold' ? fonts.logo : fonts.label : BODY[weight];
  // Arabic (or Hebrew/Persian) recipe text reads right-to-left: align it to the right
  // unless the layout explicitly centers it.
  const firstText = typeof rest.children === 'string' ? rest.children : Array.isArray(rest.children) && typeof rest.children[0] === 'string' ? rest.children[0] : '';
  const rtl = !!firstText && RTL_CHARS.test(firstText);
  const rtlStyle = rtl ? { writingDirection: 'rtl' as const, textAlign: flat?.textAlign === 'center' || className?.includes('text-center') ? ('center' as const) : ('right' as const) } : null;
  return <Text {...rest} className={cn('text-ink text-base', className)} style={[
    { fontFamily: display || isLabel ? font : Platform.OS === 'ios' ? 'System' : 'sans-serif', fontWeight: display || isLabel ? undefined : weight === 'regular' ? '400' : weight === 'semibold' ? '600' : '700' }, isLabel && { ...typography.badge }, style, rtlStyle,
    // A size set in `style` keeps text-base's 24px line height unless we give it one, which clips tall
    // serif letters (the tops of l, i, h) at bigger sizes. Give every custom size a line height that fits.
    typeof flat?.fontSize === 'number' && flat.lineHeight == null && !className?.includes('leading-') && { lineHeight: Math.round(flat.fontSize * (display ? 1.2 : 1.32)) },
    // Use the real italic face rather than synthetic italic on serif headlines.
    display && isItalic && { fontFamily: fonts.displayItalic, fontStyle: 'normal' },
  ]} />;
}

const APressable = Animated.createAnimatedComponent(Pressable);
export function PressableScale({ children, style, scaleTo = motion.pressScale, haptics = true, onPress, className, revealIndex, ...rest }: Omit<PressableProps, 'style'> & { style?: ViewStyle | ViewStyle[]; scaleTo?: number; haptics?: boolean; className?: string; revealIndex?: number }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const node = <APressable {...rest} accessibilityRole={rest.accessibilityRole ?? 'button'}
    aria-checked={rest['aria-checked'] ?? rest.accessibilityState?.checked}
    aria-selected={rest['aria-selected'] ?? rest.accessibilityState?.selected}
    aria-disabled={rest['aria-disabled'] ?? rest.accessibilityState?.disabled ?? rest.disabled ?? undefined}
    aria-busy={rest['aria-busy'] ?? rest.accessibilityState?.busy}
    onPressIn={(e) => { if (!reduced) s.value = withSpring(scaleTo, motion.pressIn); rest.onPressIn?.(e); }}
    onPressOut={(e) => { if (!reduced) s.value = withSpring(1, motion.pressOut); rest.onPressOut?.(e); }}
    onPress={(e) => { if (haptics) { if (rest.accessibilityRole === 'checkbox' || rest.accessibilityRole === 'switch' || rest.accessibilityRole === 'radio' || rest.accessibilityRole === 'tab' || rest.accessibilityState?.selected !== undefined) haptic.select(); else haptic.tap(); } onPress?.(e); }} style={[{ minWidth: 44, minHeight: 44, justifyContent: 'center' }, a, style, { minWidth: 44, minHeight: 44 }]}>{children}</APressable>;
  const content = className ? <View className={className}>{node}</View> : node;
  return revealIndex === undefined ? content : <ListReveal index={revealIndex}>{content}</ListReveal>;
}

/** A duplicate shape, not a native drop shadow. No blur on any platform. */
export function HardShadow({ children, color, x = offsets.cta.x, y = offsets.cta.y, radius = shape.card, enabled = true, style }: { children: React.ReactNode; color?: string; x?: number; y?: number; radius?: number; enabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  return <View style={[{ position: 'relative' }, style]}>
    {enabled ? <View pointerEvents="none" accessible={false} style={{ position: 'absolute', top: y, bottom: -y, left: x, right: -x, borderRadius: radius, backgroundColor: color ?? C.ink }} /> : null}
    {children}
  </View>;
}

export function Highlight({ children, testID, style }: { children: React.ReactNode; testID?: string; style?: TextStyle }) {
  const { C } = useTheme();
  return <View testID={testID} style={{ position: 'relative', alignSelf: 'flex-start', paddingHorizontal: signature.highlight.padding }}>
    <View accessible={false} pointerEvents="none" style={{ position: 'absolute', top: signature.highlight.top, bottom: signature.highlight.bottom, left: 0, right: 0, borderRadius: signature.highlight.radius, backgroundColor: C.honey, transform: [{ rotate: signature.highlight.rotate }] }} />
    <Txt display italic style={{ color: C.onHoney, ...style }}>{children}</Txt>
  </View>;
}

export function GenieBubble({ text, children, testID, style }: { text?: string; children?: React.ReactNode; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  return <View testID={testID} style={[{ backgroundColor: C.forest, borderRadius: signature.genie.radius, borderBottomLeftRadius: signature.genie.tailRadius, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, style]}>
    <Svg width={16} height={20} viewBox="0 0 20 24"><Path d="M10 2L12.5 9.5L20 12L12.5 14.5L10 22L7.5 14.5L0 12L7.5 9.5Z" fill={C.honey} /></Svg>
    <Txt style={{ flex: 1, fontFamily: fonts.medium, fontSize: signature.genie.fontSize, lineHeight: signature.genie.lineHeight, color: C.onGreen }}>{children ?? text}</Txt>
  </View>;
}

export function MatchStamp({ have, total, testID }: { have: number; total: number; testID?: string }) {
  const { C } = useTheme();
  return <View testID={testID} accessibilityLabel={`${have} of ${total} ingredients in your kitchen`} style={{ width: shape.stamp, height: shape.stamp, borderRadius: shape.stamp / 2, backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: signature.stamp.rotate }] }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}><Txt display style={{ fontSize: 36, lineHeight: 40, color: C.cream }}>{have}</Txt><Txt display style={{ fontSize: 20, color: C.honey }}>/{total}</Txt></View>
    <Txt label style={{ fontSize: signature.stamp.labelSize, lineHeight: 10, letterSpacing: 0.48, color: C.cream }}>In your kitchen</Txt>
  </View>;
}

export function StatusDot({ status }: { status: 'today' | 'soon' | 'fresh' }) {
  const { C } = useTheme();
  return <View accessibilityLabel={status} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status === 'today' ? C.alert : status === 'soon' ? C.honey : C.brandGreen, borderWidth: status === 'soon' ? 1 : 0, borderColor: C.ink }} />;
}

/** The framed plate can contain a real recipe photo; no recipe assets are replaced. */
export function Plate({ children, size, testID }: { children?: React.ReactNode; size: number; testID?: string }) {
  const { C } = useTheme();
  return <View testID={testID} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: shape.border, borderColor: C.ink, backgroundColor: C.paper, padding: shape.plateInset }}>
    <View style={{ flex: 1, borderRadius: size / 2, borderWidth: shape.border, borderColor: C.ink, overflow: 'hidden' }}>{children}</View>
  </View>;
}

export function Button({ label, onPress, variant = 'primary', icon, testID, disabled, loading, className }: { label: string; onPress?: () => void; variant?: 'primary' | 'honey' | 'outline' | 'ghost' | 'dark'; icon?: React.ReactNode; testID?: string; disabled?: boolean; loading?: boolean; className?: string }) {
  const { C } = useTheme();
  const dark = variant === 'primary' || variant === 'dark';
  const fg = dark ? C.cream : variant === 'honey' ? C.onHoney : variant === 'ghost' ? C.leafDark : C.ink;
  return <PressableScale testID={testID} onPress={disabled || loading ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} disabled={disabled || loading}>
    <HardShadow color={C.honey} radius={shape.pill} enabled={dark ? !disabled : false}>
      <View className={cn('flex-row items-center justify-center rounded-full px-6', className)} style={{ minHeight: shape.button, paddingVertical: 14, gap: 8, opacity: disabled ? 0.4 : 1, backgroundColor: dark ? C.ink : variant === 'honey' ? C.honey : C.transparent, borderWidth: variant === 'outline' ? shape.border : 0, borderColor: C.ink }}>
        {loading ? <Skeleton testID={testID ? `${testID}-loading` : 'button-loading'} width={18} height={18} borderRadius={9} style={{ backgroundColor: fg }} /> : icon}
        <Txt weight="bold" style={[typography.button, { color: fg }]}>{label}</Txt>
      </View>
    </HardShadow>
  </PressableScale>;
}

export function IconButton({ children, onPress, testID, label, className, style }: { children: React.ReactNode; onPress?: () => void; testID?: string; label: string; className?: string; style?: ViewStyle }) {
  return <PressableScale testID={testID} onPress={onPress} accessibilityLabel={label} accessibilityRole="button" hitSlop={6}>
    <View className={cn('h-11 w-11 items-center justify-center rounded-full bg-cream-deep', className)} style={style}>{children}</View>
  </PressableScale>;
}

export function Chip({ label, active, onPress, icon, testID }: { label: string; active?: boolean; onPress?: () => void; icon?: React.ReactNode; testID?: string }) {
  const { C } = useTheme();
  return <PressableScale testID={testID} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} style={{ minHeight: shape.icon, justifyContent: 'center' }}>
    <View className="flex-row items-center rounded-full px-4" style={{ height: shape.chip, gap: 6, borderWidth: shape.border, borderColor: C.ink, backgroundColor: active ? C.ink : C.transparent }}>
      {icon}<Txt label style={{ color: active ? C.cream : C.ink }}>{label}</Txt>
    </View>
  </PressableScale>;
}

export function Avatar({ member, size = 32, ring = false }: { member?: Member; size?: number; ring?: boolean }) {
  const { C } = useTheme();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: member?.color ?? C.muted, alignItems: 'center', justifyContent: 'center', borderWidth: shape.border, borderColor: C.ink, ...(ring ? { margin: 2 } : {}) }}>
    <Txt weight="bold" style={{ color: C.cream, fontSize: size * 0.42 }}>{member?.initials ?? '?'}</Txt>
  </View>;
}

export function MatchBadge({ have, total, compact = false, ingredients = false, testID }: { have: number; total: number; compact?: boolean; ingredients?: boolean; testID?: string }) {
  const { C } = useTheme();
  const full = have === total && total > 0;
  const close = total - have <= 2;
  return <View testID={testID} className="flex-row items-center self-start rounded-full px-2.5 py-1" style={{ backgroundColor: full ? C.brandGreen : close ? C.honey : C.paper, borderWidth: shape.border, borderColor: C.ink }}>
    <Txt label style={{ color: full || close ? C.onHoney : C.ink }}>{compact ? `${have}/${total}` : ingredients ? `You have ${have}/${total} ingredients` : full ? `You have all ${total}` : `You have ${have}/${total}`}</Txt>
  </View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <View className="mb-3 flex-row items-end justify-between px-5"><Txt label style={typography.label}>{children}</Txt>{right}</View>;
}

type AnimProps = React.ComponentProps<typeof Animated.View>;
type AViewProps = { entering?: AnimProps['entering']; exiting?: AnimProps['exiting']; layout?: AnimProps['layout']; className?: string; style?: StyleProp<ViewStyle>; testID?: string; children?: React.ReactNode };
export function AView({ entering, exiting, layout, className, style, children, testID }: AViewProps) {
  const reduced = useReducedMotion();
  return <Animated.View entering={reduced ? undefined : entering} exiting={reduced ? undefined : exiting} layout={reduced ? undefined : layout}><View className={className} style={style} testID={testID}>{children}</View></Animated.View>;
}

/** Quiet loading placeholder; respects the device's Reduce Motion setting. */
export function Skeleton({ width = '100%', height = 18, borderRadius = 9, testID = 'skeleton', style }: { width?: number | string; height?: number; borderRadius?: number; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = reduced ? 0.65 : withRepeat(withTiming(0.95, { duration: 900 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);
  const animation = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View testID={testID} accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={[{ width: width as ViewStyle['width'], height, borderRadius, backgroundColor: C.hairline }, animation, style]} />;
}

/** A short content reveal, never a large or distracting slide. */
export function ListReveal({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  return <Animated.View entering={reduced ? undefined : FadeInDown.duration(220).delay(Math.min(index, 5) * 35)} style={style}>{children}</Animated.View>;
}
