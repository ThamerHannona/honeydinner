import { useTheme } from '@/lib/theme-context';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { ScreenHeader } from '@/components/app';
import { Illustration, type IllustrationKind } from '@/components/brand';
import { Txt } from '@/components/ui';


type TabPlaceholderProps = {
  title: string;
  screenId: string;
  illustration: IllustrationKind;
  headline: string;
  description: string;
};

export function TabPlaceholder({ title, screenId, illustration, headline, description }: TabPlaceholderProps) {
  const { C } = useTheme();
  return (
    <View className="flex-1 bg-cream" testID={`${screenId}-screen`}>
      <ScreenHeader title={title} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 32, paddingBottom: 112 }}
      >
        <View className="flex-1 items-center justify-center" testID={`${screenId}-placeholder`}>
          <Illustration kind={illustration} size={190} />
          <View className="mb-4 mt-7 flex-row items-center rounded-full px-3 py-1.5" style={{ backgroundColor: C.honeySoft, gap: 6 }}>
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: C.honey }} />
            <Txt weight="extrabold" className="text-[11px] uppercase tracking-widest" style={{ color: C.inkSoft }}>
              Coming soon
            </Txt>
          </View>
          <Txt display weight="bold" className="text-center text-[27px] leading-[34px]">
            {headline}
          </Txt>
          <Txt weight="semibold" className="mt-3 max-w-[290px] text-center text-[16px] leading-6 text-ink-soft">
            {description}
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
