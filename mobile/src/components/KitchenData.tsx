import { useKitchenRefresh } from '@/lib/use-kitchen-refresh';
import { useTheme } from '@/lib/theme-context';
import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { RecipeImage as Image } from '@/components/recipe-image';
import { router } from 'expo-router';
import { ChevronRight, Clock } from 'lucide-react-native';
import { ScreenHeader } from '@/components/app';
import { PlatformBadge } from '@/components/brand';
import { PressableScale, Txt } from '@/components/ui';

import type { Recipe } from '@/lib/types';

export function KitchenDataScreen({ title, screenId, subtitle, children }: {
  title: string;
  screenId: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { C } = useTheme();
  const { refreshing, onRefresh } = useKitchenRefresh();
  return (
    <View className="flex-1 bg-cream" testID={`${screenId}-screen`}>
      <ScreenHeader title={title} />
      <ScrollView testID={`${screenId}-data`} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.inkSoft} />} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 }}>
        <View className="mb-5 flex-row items-center" style={{ gap: 8 }}>
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: C.honeySoft }}>
            <Txt weight="extrabold" className="text-[11px] uppercase tracking-wider text-ink-soft">Your kitchen</Txt>
          </View>
          <Txt weight="semibold" className="flex-1 text-[14px] text-ink-soft">{subtitle}</Txt>
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

export function KitchenSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Txt display weight="bold" accessibilityRole="header" className="mb-3 text-[23px] leading-7">{title}</Txt>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

export function KitchenRecipeCard({ recipe, testID, detail }: { recipe: Recipe; testID: string; detail?: string }) {
  const { C } = useTheme();
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}`} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}>
      <View className="flex-row items-center rounded-2xl bg-white p-2.5" style={{ gap: 12, borderWidth: 1, borderColor: C.line }}>
        <View>
          <Image source={{ uri: recipe.image }} contentFit="cover" accessibilityLabel={recipe.title} style={{ width: 94, height: 104, borderRadius: 12, backgroundColor: C.creamDeep }} />
          <View className="absolute bottom-1 left-1"><PlatformBadge platform={recipe.source.platform} size={24} /></View>
        </View>
        <View className="flex-1 py-1">
          <Txt weight="extrabold" className="text-[17px] leading-[22px]">{recipe.title}</Txt>
          <View className="mt-2 flex-row items-center" style={{ gap: 5 }}>
            <Clock size={13} color={C.inkSoft} />
            <Txt weight="bold" className="text-[12px] text-ink-soft">{recipe.cookTime} min · {recipe.servings} servings</Txt>
          </View>
          <Txt weight="semibold" className="mt-1 text-[12px] text-ink-soft" numberOfLines={1}>{recipe.source.creator}</Txt>
          {detail ? <Txt weight="bold" className="mt-2 text-[12px] text-leaf-dark">{detail}</Txt> : null}
        </View>
        <ChevronRight size={16} color={C.inkFaint} />
      </View>
    </PressableScale>
  );
}
