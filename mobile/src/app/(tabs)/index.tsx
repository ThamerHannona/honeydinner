import { useKitchenRefresh } from '@/lib/use-kitchen-refresh';
import { useTheme } from '@/lib/theme-context';
import { signature } from '@/lib/theme';
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { RecipeImage as Image } from '@/components/recipe-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpRight, Heart, Sparkles } from 'lucide-react-native';
import { AnimatedFridgeGenie } from '@/components/fridge-genie';
import { DIETS } from '@/lib/services/genie-recipes';
import { Logo } from '@/components/brand';
import { Avatar, PressableScale, Txt, HardShadow, GenieBubble, MatchStamp, StatusDot } from '@/components/ui';
import { pantryGreeting } from '@/lib/genie';
import { expiryLabel, freshness, matchRecipe, rankSuggestions } from '@/lib/kitchen';
import { useApp } from '@/lib/store';

/** Tonight heading only — Caveat Brush; other screens keep Fraunces. */
const TONIGHT_SCRIPT = {
  fontFamily: 'CaveatBrush_400Regular',
  fontSize: 42,
  lineHeight: 48,
  letterSpacing: -0.5,
} as const;


export default function TonightScreen() {
  const { C } = useTheme();
  const { refreshing, onRefresh, revision } = useKitchenRefresh();
  const recipes = useApp((s) => s.recipes);
  const pantry = useApp((s) => s.pantry);
  const members = useApp((s) => s.members);
  const diets = useApp((s) => s.diets);
  const insets = useSafeAreaInsets();
  const soon = useMemo(() => pantry.filter((item) => freshness(item.expiresAt) === 'soon').sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '')), [pantry, revision]);
  const suggestions = useMemo(() => {
    const ranked = rankSuggestions(recipes, pantry);
    const ids = new Set(ranked.map(({ recipe }) => recipe.id));
    return [...ranked, ...recipes.filter((r) => !ids.has(r.id)).map((recipe) => ({ recipe, match: matchRecipe(recipe, pantry) }))].slice(0, 3);
  }, [recipes, pantry, revision]);
  const hero = suggestions[0];
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

  return (
    <View className="flex-1 bg-cream" testID="tonight-screen">
      <ScrollView testID="tonight-data" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.inkSoft} colors={[C.forest]} />} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 28 }}>
        <View className="mx-5 mb-5 flex-row items-center justify-between">
          <Logo size="sm" />
          <PressableScale testID="tonight-profile-button" accessibilityRole="button" accessibilityLabel="Profile and household" onPress={() => router.push('/profile')}>
            <View className="flex-row">
              {members.slice(0, 2).map((member, index) => <View key={member.id} style={{ marginLeft: index ? -9 : 0, borderWidth: 1.5, borderColor: C.ink, borderRadius: 22 }}><Avatar member={member} size={37} /></View>)}
            </View>
          </PressableScale>
        </View>
        <View className="px-5">
          <Txt label weight="extrabold" className="mb-2 text-[15px] uppercase tracking-wider">{day} <Txt style={{ color: C.leaf }}>●</Txt> DINNER</Txt>
          <Text accessibilityRole="header" style={[TONIGHT_SCRIPT, { color: C.ink }]}>What’s for dinner,</Text>
          <View className="mb-5 self-start" style={{ position: 'relative', paddingHorizontal: signature.highlight.padding }}>
            <View
              accessible={false}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: signature.highlight.top,
                bottom: signature.highlight.bottom,
                left: 0,
                right: 0,
                borderRadius: signature.highlight.radius,
                backgroundColor: C.honey,
                transform: [{ rotate: signature.highlight.rotate }],
              }}
            />
            <Text style={[TONIGHT_SCRIPT, { color: C.onHoney, fontSize: 44, lineHeight: 50 }]}>honey?</Text>
          </View>
          <GenieBubble testID="fridgegenie-greeting-card" style={{ marginBottom: 14 }}>
            <Txt testID="fridgegenie-greeting" style={{ color: C.onGreen, fontSize: 14, lineHeight: 20 }}>{pantryGreeting(pantry)}</Txt>
          </GenieBubble>
          <PressableScale testID="tonight-genie-chef" accessibilityRole="button" accessibilityLabel="Ask FridgeGenie to make dinner from my kitchen" onPress={() => router.push('/genie-chef')} style={{ marginBottom: 24 }}>
            <View className="flex-row items-center rounded-[22px] px-4 py-3" style={{ backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink, gap: 12 }}>
              <AnimatedFridgeGenie size={46} mood="idle" testID="tonight-genie-chef-mascot" />
              <View className="flex-1">
                <Txt weight="extrabold" className="text-[16px]">Cook from my kitchen</Txt>
                <Txt weight="semibold" className="mt-0.5 text-[13px]" style={{ color: C.inkSoft }} numberOfLines={1}>
                  {diets.length ? `FridgeGenie makes ${diets.map((d) => DIETS.find((x) => x.id === d)?.label ?? d).join(' + ')} dinners` : 'FridgeGenie invents dinners from what you have'}
                </Txt>
              </View>
              <Sparkles size={20} color={C.honey} fill={C.honey} />
            </View>
          </PressableScale>
          {hero ? (
            <HardShadow color={C.ink} x={6} y={6} radius={28} style={{ marginBottom: 24 }}><View testID="tonight-featured-card" className="rounded-[28px] bg-honey p-5" style={{ borderWidth: 1.5, borderColor: C.ink }}>
              <View className="mb-2 h-[146px] flex-row items-start justify-between">
                <View className="mt-2"><MatchStamp testID="suggestion-match-0" have={hero.match.have} total={hero.match.total} /></View>
                <PressableScale testID="suggestion-0" accessibilityRole="button" accessibilityLabel={`Open ${hero.recipe.title}`} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: hero.recipe.id } })} style={{ marginTop: -30, marginRight: -13 }}>
                  <View className="items-center justify-center rounded-full bg-white p-2" style={{ width: 176, height: 176 }}>
                    <Image testID="suggestion-photo-0" source={{ uri: hero.recipe.image }} accessibilityLabel={hero.recipe.title} contentFit="cover" style={{ width: 158, height: 158, borderRadius: 79, borderWidth: 1.5, borderColor: C.ink }} transition={200} />
                  </View>
                </PressableScale>
              </View>
              <Txt label weight="extrabold" className="mb-1 text-[15px] uppercase tracking-widest text-onHoney">{hero.recipe.cookTime} MIN · FROM {hero.recipe.source.platform === 'photo' ? 'PHOTOS' : hero.recipe.source.platform.toUpperCase()}</Txt>
              <PressableScale testID="tonight-featured-title" accessibilityRole="button" accessibilityLabel={`Open ${hero.recipe.title}`} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: hero.recipe.id } })}>
                <Txt display weight="bold" className="mb-4 text-[27px] leading-[29px]" style={{ letterSpacing: -0.8, color: C.onHoney }}>{hero.recipe.title}</Txt>
              </PressableScale>
              <View className="flex-row" style={{ gap: 10 }}>
                <PressableScale testID="tonight-cook" accessibilityRole="button" accessibilityLabel="Cook tonight" style={{ flex: 1.15 }} onPress={() => router.push({ pathname: '/cook/[id]', params: { id: hero.recipe.id, servings: String(hero.recipe.servings) } })}>
                  <HardShadow color={C.honey} radius={999}><View className="h-[50px] items-center justify-center rounded-full bg-ink"><Txt weight="extrabold" className="text-[14px] text-cream">Cook tonight</Txt></View></HardShadow>
                </PressableScale>
                <PressableScale testID="tonight-ask-honey" accessibilityRole="button" accessibilityLabel="Ask Honey" style={{ flex: 1 }} onPress={() => router.push('/ask-honey')}>
                  <View className="h-[50px] flex-row items-center justify-center rounded-full border border-ink bg-white" style={{ gap: 6 }}><Heart size={14} fill={C.ink} color={C.ink} /><Txt weight="extrabold" className="text-[14px]">Ask Honey</Txt></View>
                </PressableScale>
              </View>
            </View></HardShadow>
          ) : <Txt testID="empty-suggestions" className="mb-6 text-ink-soft">No recipes yet. Add one with the + button.</Txt>}
          <Txt label weight="extrabold" className="mb-2 text-[15px] uppercase tracking-wider">Use it up soon</Txt>
        </View>
        <ScrollView horizontal testID="expiring-strip" showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 8 }}>
          {soon.map((item, index) => <PressableScale key={item.id} testID={`tonight-expiring-${item.id}`} accessibilityRole="button" accessibilityLabel={`Find ${item.name} in your kitchen`} onPress={() => router.navigate('/pantry')}>
            <View className="flex-row items-center rounded-full border border-ink px-3 py-2.5" style={{ backgroundColor: index === 0 ? C.ink : 'transparent', gap: 6 }}>
              <StatusDot status="soon" />
              <Txt weight="bold" style={{ color: index === 0 ? C.cream : C.ink, fontSize: 12 }}>{item.name} · {expiryLabel(item.expiresAt)}</Txt>
            </View>
          </PressableScale>)}
        </ScrollView>
        {soon.length === 0 ? <Txt testID="empty-expiring" className="px-5 text-[14px] text-ink-soft">Nothing needs using soon. Nice!</Txt> : null}
        {suggestions.length > 1 ? <View className="mx-5 mt-6" testID="suggestions-list">
          <View className="mb-3 flex-row items-center justify-between"><Txt label weight="extrabold" className="text-[15px] uppercase tracking-wider">Or, something different</Txt><ArrowUpRight size={17} color={C.inkSoft} /></View>
          {suggestions.slice(1).map(({ recipe, match }, i) => <PressableScale key={recipe.id} revealIndex={i} testID={`suggestion-${i + 1}`} accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}`} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}>
            <View className="flex-row items-center border-t border-cream-line py-3" style={{ gap: 12 }}>
              <Image source={{ uri: recipe.image }} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: C.ink }} />
              <View className="flex-1"><Txt display weight="bold" className="text-[18px] leading-[22px]">{recipe.title}</Txt><Txt className="mt-1 text-[12px] text-ink-soft">{recipe.cookTime} min · {match.have}/{match.total} in your kitchen</Txt></View>
              <ArrowUpRight size={18} color={C.ink} />
            </View>
          </PressableScale>)}
        </View> : null}
      </ScrollView>
    </View>
  );
}
