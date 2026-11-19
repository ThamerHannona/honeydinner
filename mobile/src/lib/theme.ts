/** Honey, Dinner? — the single source of truth for the light design system.
 * Kept safe to load in Tailwind's Node process as well as the Expo app.
 */
export const colors = {
  cream: '#F4EDE0', paper: '#FFFFFF', ink: '#14110D', inkSoft: '#4E483F',
  muted: '#5E574D', hairline: '#D8CDB9', quietFill: '#EFE8DC',
  brandGreen: '#1DAF3A', forest: '#14702A', onGreen: '#FBF6EA',
  honey: '#F4AA22', honeyText: '#7A4E00', honeyOnForest: '#FFD36B', alert: '#FF5A3C',
  plateWheat: '#EBDDC6', plateSage: '#D9E4D6', plateRose: '#EED6D2', plateLilac: '#DEDDE8',
  checkboxBorder: '#C9BEA9', selectedCard: '#FFE7B0',
  // Fixed foregrounds for brand fills and intentionally dark cooking/camera surfaces.
  onHoney: '#14110D', onInk: '#FBF6EA', night: '#14110D',
  transparent: 'transparent', paperOverlay: '#FFFFFFDD', timerTrack: '#FFFFFF1F',
  googleYellow: '#FFC107', googleRed: '#FF3D00', googleGreen: '#4CAF50', googleBlue: '#1976D2',
  instagram: '#E1306C', facebook: '#1877F2', snapchat: '#FFFC00',
} as const;

// Compatibility names keep existing screens/data contracts intact.
const lightPalette = {
  ...colors,
  leaf: colors.brandGreen, leafDark: colors.forest, leafSoft: colors.plateSage,
  honeyDark: colors.honeyText, honeySoft: colors.selectedCard,
  creamDeep: colors.quietFill, line: colors.hairline,
  inkFaint: colors.muted, berry: colors.alert, berrySoft: colors.plateRose, white: colors.paper,
} as const;
export type ThemeColors = { [K in keyof typeof lightPalette]: string };
export const C: ThemeColors = lightPalette;
export const darkC: ThemeColors = {
  ...C,
  cream: '#191712', paper: '#26231E', white: '#26231E',
  ink: '#F4EDE0', inkSoft: '#DDD3C4', muted: '#BEB3A3', inkFaint: '#BEB3A3',
  hairline: '#544B3E', line: '#544B3E', checkboxBorder: '#897A63',
  quietFill: '#302B23', creamDeep: '#302B23', paperOverlay: '#26231EDD',
  honeyText: '#FFD36B', honeyDark: '#FFD36B', selectedCard: '#4A3619', honeySoft: '#4A3619',
  plateWheat: '#403527', plateSage: '#283D2D', plateRose: '#442C29', plateLilac: '#353342',
  leafSoft: '#283D2D', berrySoft: '#442C29',
  // Forest remains a fixed brand fill, with cream onGreen in either mode.
  forest: '#14702A', leafDark: '#65D37A',
};
export const plateTints = [C.plateWheat, C.plateSage, C.plateRose, C.plateLilac] as const;
export const fonts = {
  body: 'Nunito_500Medium', medium: 'Nunito_600SemiBold', semibold: 'Nunito_700Bold', bold: 'Nunito_800ExtraBold',
  display: 'Fraunces_600SemiBold', displayItalic: 'Fraunces_600SemiBold_Italic',
  label: 'BarlowCondensed_700Bold', logo: 'BarlowCondensed_800ExtraBold',
} as const;
export const typography = {
  screen: { fontFamily: fonts.display, fontSize: 42, lineHeight: 48, letterSpacing: -1.6 },
  recipe: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.label, fontSize: 15, lineHeight: 18, letterSpacing: 0.9, textTransform: 'uppercase' },
  badge: { fontFamily: fonts.label, fontSize: 13, lineHeight: 16, letterSpacing: 0.78, textTransform: 'uppercase' },
  logo: { fontFamily: fonts.logo, fontSize: 21, lineHeight: 23, letterSpacing: 1.26 },
} as const;
export const spacing = { unit: 8, screen: 20, xs: 8, sm: 16, md: 24, lg: 32, xl: 40, xxl: 48 } as const;
export const shape = { card: 24, hero: 28, tile: 22, pill: 999, border: 1.5, icon: 44, fab: 58, checkbox: 26, checkboxBorder: 1.75, chip: 38, button: 56, stamp: 82, plateInset: 13 } as const;
export const offsets = { cta: { x: 4, y: 4 }, hero: { x: 6, y: 6 }, fab: { x: 3, y: 3 }, selected: { x: 5, y: 5 } } as const;
export const motion = { pressScale: 0.97, rise: 12, stagger: 40, mascotDuration: 3200, pressIn: { damping: 18, stiffness: 400 }, pressOut: { damping: 14, stiffness: 300 } } as const;
export const signature = {
  highlight: { radius: 4, rotate: '-2deg', top: '16%', bottom: '4%', padding: 5 },
  genie: { radius: 18, tailRadius: 4, fontSize: 14, lineHeight: 20 },
  stamp: { rotate: '-10deg', labelSize: 8 },
  logo: { radius: 10, largeSize: 52, rotate: '-3deg' },
} as const;

// Retired soft-shadow exports: legacy surfaces remain flat, new shadows use HardShadow.
export const shadow = {};
export const shadowStrong = {};

function impact(kind: 'tap' | 'medium' | 'success' | 'select') {
  // Lazy loading lets Tailwind read the same file without importing native modules.
  const { Platform } = require('react-native') as typeof import('react-native');
  if (Platform.OS === 'web') return;
  const Haptics = require('expo-haptics') as typeof import('expo-haptics');
  const result = kind === 'select' ? Haptics.selectionAsync()
    : kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : kind === 'medium' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  result.catch(() => {});
}
export const haptic = { tap: () => impact('tap'), medium: () => impact('medium'), success: () => impact('success'), select: () => impact('select') };
export const inputStyle = {
  height: 52, borderRadius: shape.tile, backgroundColor: C.paper,
  borderWidth: shape.border, borderColor: C.hairline, paddingHorizontal: spacing.sm,
  fontFamily: fonts.medium, fontSize: 15, color: C.ink,
} as const;
export const theme = { colors, fonts, typography, spacing, shape, offsets, motion, signature, plateTints } as const;
