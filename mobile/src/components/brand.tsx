import { C as staticC } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { Globe, Image as ImageIcon, Sparkles } from 'lucide-react-native';
import { fonts, offsets, shape, signature, typography } from '@/lib/theme';
import type { SourcePlatform } from '@/lib/types';
import { GenieBubble, Txt } from './ui';
import { FridgeMascot, GenieAvatar } from './fridge-genie';
export { AnimatedFridgeGenie, FridgeMascot, GenieAvatar } from './fridge-genie';

/* ---------- Condensed speech-bubble wordmark ---------- */

type LogoSize = 'sm' | 'md' | 'lg';

// Duplicate the complete silhouette for an absolute hard shadow, tail included.
function LogoShape({ width, height, tail, color, outlined = false }: {
  width: number; height: number; tail: number; color: string; outlined?: boolean;
}) {
  const { C } = useTheme();
  const r = signature.logo.radius;
  const bubble = `M${r} 0H${width - r}Q${width} 0 ${width} ${r}V${height - r}Q${width} ${height} ${width - r} ${height}H${tail + r}L0 ${height + tail}V${r}Q0 0 ${r} 0Z`;
  return (
    <Svg width={width + shape.border * 2} height={height + tail + shape.border * 2}
      viewBox={`${-shape.border} ${-shape.border} ${width + shape.border * 2} ${height + tail + shape.border * 2}`}>
      <Path d={bubble} fill={color} stroke={outlined ? C.ink : color}
        strokeWidth={outlined ? shape.border : 0} />
    </Svg>
  );
}

export function LogoBubble({ size = 'md', inverted = false, testID = 'app-logo' }: {
  size?: LogoSize; inverted?: boolean; testID?: string;
}) {
  const { C } = useTheme();
  const large = size === 'lg';
  const width = large ? 232 : 148;
  const height = large ? 146 : 33;
  const tail = large ? 16 : 5;
  const bg = inverted ? C.onGreen : C.brandGreen;
  const fg = inverted ? C.forest : C.onGreen;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Honey, Dinner?" testID={testID}
      style={{ width: large ? 244 : width + shape.border * 2, height: large ? 183 : height + tail + shape.border * 2 }}>
      <View style={{ width: width + shape.border * 2, height: height + tail + shape.border * 2,
        marginTop: large ? 8 : 0, transform: large ? [{ rotate: signature.logo.rotate }] : undefined }}>
        {large ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: offsets.hero.x, top: offsets.hero.y }}>
            <LogoShape width={width} height={height} tail={tail} color={C.ink} outlined />
          </View>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <LogoShape width={width} height={height} tail={tail} color={bg} outlined={large} />
        </View>
        <View style={{ height: height + shape.border * 2, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typography.logo, fontFamily: fonts.logo, color: fg, textAlign: 'center',
            fontSize: large ? signature.logo.largeSize : typography.logo.fontSize,
            lineHeight: large ? 54 : typography.logo.lineHeight,
            includeFontPadding: false }}>
            {large ? 'HONEY,\nDINNER?' : 'HONEY, DINNER?'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function Logo({ size = 'md', inverted = false }: { size?: 'sm' | 'md' | 'lg'; inverted?: boolean }) {
  return <LogoBubble size={size} inverted={inverted} />;
}

export function GenieLine({ text }: { text: string; tone?: 'light' | 'honey' }) {
  // Legacy tone remains accepted; all Genie messages use the shared forest bubble.
  return (
    <View className="flex-row items-center" style={{ gap: 10 }} testID="genie-line">
      <GenieAvatar size={36} />
      <GenieBubble text={text} style={{ flex: 1 }} />
    </View>
  );
}


/* ---------- Platform icons ---------- */

export const PLATFORM_COLOR: Record<SourcePlatform, string> = {
  tiktok: staticC.ink,
  instagram: staticC.instagram,
  facebook: staticC.facebook,
  snapchat: staticC.snapchat,
  web: staticC.forest,
  photo: staticC.honeyText,
  genie: staticC.forest,
};

export function PlatformGlyph({ platform, size = 14, color }: { platform: SourcePlatform; size?: number; color?: string }) {
  const { C } = useTheme();
  const fg = color ?? (platform === 'snapchat' ? C.onHoney : C.onGreen);
  switch (platform) {
    case 'tiktok':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M14.6 3h-3.1v12.2a2.7 2.7 0 1 1-2.7-2.7c.3 0 .6 0 .8.1V9.4a5.9 5.9 0 1 0 5 5.8V9.3a7.4 7.4 0 0 0 4.4 1.4V7.6a4.4 4.4 0 0 1-4.4-4.6z" fill={fg} />
        </Svg>
      );
    case 'instagram':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke={fg} strokeWidth="2" />
          <Circle cx="12" cy="12" r="3.8" stroke={fg} strokeWidth="2" />
          <Circle cx="17.2" cy="6.8" r="1.2" fill={fg} />
        </Svg>
      );
    case 'facebook':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z" fill={fg} />
        </Svg>
      );
    case 'snapchat':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 3c3 0 5 2.2 5 5.2v2.3l1.6-.5c.5-.1.9.4.6.8-.4.6-1.3 1-2 1.2.4 1.6 1.7 3 3.3 3.5.4.1.4.7 0 .8-.8.3-1.6.4-2 .6-.2.3-.2 1-.6 1.1-.6.1-1.4-.2-2.3 0-1 .2-1.8 1.5-3.6 1.5s-2.6-1.3-3.6-1.5c-.9-.2-1.7.1-2.3 0-.4-.1-.4-.8-.6-1.1-.4-.2-1.2-.3-2-.6-.4-.1-.4-.7 0-.8 1.6-.5 2.9-1.9 3.3-3.5-.7-.2-1.6-.6-2-1.2-.3-.4.1-.9.6-.8l1.6.5V8.2C7 5.2 9 3 12 3z"
            fill={C.onInk}
            stroke={C.onHoney}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'web':
      return <Globe size={size} color={fg} strokeWidth={2.4} />;
    case 'photo':
      return <ImageIcon size={size} color={fg} strokeWidth={2.4} />;
    case 'genie':
      return <Sparkles size={size} color={fg} strokeWidth={2.4} />;
  }
}

export function PlatformBadge({ platform, size = 24 }: { platform: SourcePlatform; size?: number }) {
  const { C } = useTheme();
  return (
    <View
      testID={`platform-badge-${platform}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: PLATFORM_COLOR[platform],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: C.paper,
      }}
    >
      <PlatformGlyph platform={platform} size={size * 0.55} />
    </View>
  );
}

/** A labeled source chip; the compact circular overlay badge remains unchanged. */
export function PlatformPill({ platform, label }: { platform: SourcePlatform; label?: string }) {
  const { C } = useTheme();
  const names: Record<SourcePlatform, string> = {
    tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook',
    snapchat: 'Snapchat', web: 'Web', photo: 'Photo', genie: 'FridgeGenie',
  };
  return (
    <View testID={`platform-pill-${platform}`} accessibilityLabel={label ?? names[platform]}
      className="flex-row items-center self-start px-3 py-1.5"
      style={{ gap: 6, borderRadius: shape.pill, backgroundColor: C.paper,
        borderColor: C.hairline, borderWidth: shape.border }}>
      <PlatformGlyph platform={platform} size={14} color={C.ink} />
      <Text style={{ ...typography.badge, color: C.ink }}>{label ?? names[platform]}</Text>
    </View>
  );
}

/* ---------- Illustrations for empty states ---------- */

export type IllustrationKind = 'fridge' | 'book' | 'basket' | 'bowl';

export function Illustration({ kind, size = 160 }: { kind: IllustrationKind; size?: number }) {
  const { C } = useTheme();
  if (kind === 'fridge') return <FridgeMascot size={size * 0.8} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Circle cx="80" cy="84" r="66" fill={C.honeySoft} />
      <Ellipse cx="80" cy="140" rx="46" ry="6" fill={C.creamDeep} />
      {kind === 'book' ? (
        <G>
          <Path d="M28 50 Q54 40 80 52 V128 Q54 116 28 126 Z" fill={C.paper} stroke={C.leaf} strokeWidth="4" strokeLinejoin="round" />
          <Path d="M132 50 Q106 40 80 52 V128 Q106 116 132 126 Z" fill={C.paper} stroke={C.leaf} strokeWidth="4" strokeLinejoin="round" />
          <Path d="M40 66 Q54 61 68 66 M40 80 Q54 75 68 80 M40 94 Q54 89 64 93" stroke={C.line} strokeWidth="4" strokeLinecap="round" fill="none" />
          <Rect x="92" y="62" width="30" height="30" rx="8" fill={C.honey} />
          <Path d="M101 77 l5 5 9 -10" stroke={C.paper} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M118 26 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill={C.honey} />
        </G>
      ) : null}
      {kind === 'basket' ? (
        <G>
          <Path d="M52 70 Q80 22 108 70" stroke={C.honeyDark} strokeWidth="6" fill="none" strokeLinecap="round" />
          <Circle cx="66" cy="62" r="13" fill={C.berry} />
          <Circle cx="92" cy="60" r="12" fill={C.leaf} />
          <Path d="M92 48 q4 -8 10 -6" stroke={C.leafDark} strokeWidth="3" fill="none" strokeLinecap="round" />
          <Path d="M34 70 H126 L116 128 Q115 134 109 134 H51 Q45 134 44 128 Z" fill={C.honey} />
          <Path d="M58 84 V120 M80 84 V120 M102 84 V120" stroke={C.honeyDark} strokeWidth="4" strokeLinecap="round" />
        </G>
      ) : null}
      {kind === 'bowl' ? (
        <G>
          <Path d="M62 40 q-6 -10 2 -18 M80 38 q-6 -10 2 -18 M98 40 q-6 -10 2 -18" stroke={C.inkFaint} strokeWidth="4" fill="none" strokeLinecap="round" opacity={0.5} />
          <Ellipse cx="80" cy="70" rx="52" ry="12" fill={C.leafSoft} />
          <Path d="M28 70 H132 Q130 128 80 130 Q30 128 28 70 Z" fill={C.leaf} />
          <Circle cx="64" cy="66" r="7" fill={C.honey} />
          <Circle cx="88" cy="64" r="6" fill={C.berry} />
          <Circle cx="104" cy="68" r="5" fill={C.honey} />
          <Path d="M66 92 q14 10 28 0" stroke={C.paper} strokeWidth="4" fill="none" strokeLinecap="round" />
        </G>
      ) : null}
    </Svg>
  );
}

export function EmptyState({
  kind,
  title,
  line,
  action,
  testID,
}: {
  kind: IllustrationKind;
  title: string;
  line: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View className="items-center px-10 py-10" testID={testID}>
      <Illustration kind={kind} />
      <Txt display weight="bold" className="mt-5 text-center text-[22px]">
        {title}
      </Txt>
      <GenieBubble text={line} testID="empty-state-genie-message" style={{ marginTop: 8, alignSelf: 'stretch' }} />
      {action ? <View className="mt-6 w-full">{action}</View> : null}
    </View>
  );
}
