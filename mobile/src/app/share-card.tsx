import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { Heart, Image as ImageIcon, Send, X } from 'lucide-react-native';
import { Button, PressableScale, Txt } from '@/components/ui';
import { goBack } from '@/lib/nav';
import { toast, useApp } from '@/lib/store';
import { haptic } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import type { Recipe } from '@/lib/types';

const fmtQty = (q: number | null) => {
  if (q == null) return '';
  const whole = Math.floor(q);
  const frac = q - whole;
  const map: [number, string][] = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']];
  const f = map.find(([v]) => Math.abs(frac - v) < 0.04)?.[1];
  if (f) return whole ? `${whole}${f}` : f;
  return String(Math.round(q * 100) / 100);
};

/** The picture that gets sent: photo, ingredients and numbered step cards. */
function RecipeCard({ recipe, onImageReady }: { recipe: Recipe; onImageReady: () => void }) {
  const { C } = useTheme();
  const half = Math.ceil(recipe.ingredients.length / 2);
  const cols = [recipe.ingredients.slice(0, half), recipe.ingredients.slice(half)];
  return (
    <View style={{ width: 360, backgroundColor: '#F4EDE0', borderRadius: 28, overflow: 'hidden' }}>
      <Image source={{ uri: recipe.image }} style={{ width: 360, height: 220, backgroundColor: '#E9DFCC' }} resizeMode="cover" onLoadEnd={onImageReady} />
      <View style={{ padding: 20 }}>
        <Txt display weight="extrabold" style={{ fontSize: 26, lineHeight: 30, color: '#1B1A17' }}>{recipe.title}</Txt>
        <Txt weight="bold" style={{ marginTop: 6, fontSize: 13, color: '#6B655B' }}>
          Serves {recipe.servings} · {recipe.cookTime} min · {recipe.steps.length} steps
        </Txt>

        <Txt label weight="extrabold" style={{ marginTop: 18, fontSize: 11, letterSpacing: 2, color: '#6B655B' }}>INGREDIENTS</Txt>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          {cols.map((col, ci) => (
            <View key={ci} style={{ flex: 1, gap: 5 }}>
              {col.map((i, n) => (
                <Txt key={n} weight="semibold" style={{ fontSize: 12.5, lineHeight: 17, color: '#1B1A17' }}>
                  {[fmtQty(i.qty), i.unit].filter(Boolean).join(' ')}{i.qty != null || i.unit ? ' ' : ''}{i.name}
                </Txt>
              ))}
            </View>
          ))}
        </View>

        <Txt label weight="extrabold" style={{ marginTop: 20, fontSize: 11, letterSpacing: 2, color: '#6B655B' }}>STEP BY STEP</Txt>
        <View style={{ gap: 8, marginTop: 8 }}>
          {recipe.steps.map((step, n) => {
            const img = recipe.stepImages?.[n] ?? null;
            return (
              <View key={n} style={{ flexDirection: 'row', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10, alignItems: 'center' }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt weight="extrabold" style={{ fontSize: 14, color: '#1B1A17' }}>{n + 1}</Txt>
                </View>
                <Txt weight="semibold" style={{ flex: 1, fontSize: 13, lineHeight: 18, color: '#1B1A17' }}>{step}</Txt>
                {img ? <Image source={{ uri: img }} style={{ width: 54, height: 40, borderRadius: 8 }} /> : null}
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 }}>
          <Heart size={13} color="#2F6B3F" fill="#2F6B3F" />
          <Txt weight="extrabold" style={{ fontSize: 12, color: '#2F6B3F' }}>Honey, Dinner?</Txt>
        </View>
      </View>
    </View>
  );
}

export default function ShareCard() {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useApp((s) => s.recipes.find((r) => r.id === id));
  const partnerName = useApp((s) => s.members.find((m) => !m.isMe)?.name ?? null);
  const sharedKitchen = useApp((s) => !!s.household && s.household.members.length > 1);
  const sendRecipeToPartner = useApp((s) => s.sendRecipeToPartner);
  const cardRef = useRef<View>(null);
  const [ready, setReady] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  if (!recipe) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: C.cream }}>
        <Button testID="share-card-missing-back" label="Go back" onPress={goBack} />
      </View>
    );
  }

  const sendInApp = () => {
    if (sendRecipeToPartner(recipe.id)) {
      haptic.success();
      toast(`Sent to ${partnerName ?? 'your partner'} 💌`);
      goBack();
    }
  };

  const sendBoth = async () => {
    const queued = sendRecipeToPartner(recipe.id);
    if (queued) haptic.success();
    const shared = await sharePicture();
    if (queued) {
      toast(shared ? `Sent to ${partnerName ?? 'your partner'} — in the app and by text 💌` : `Sent to ${partnerName ?? 'your partner'} in the app 💌`);
      goBack();
    }
  };

  const sharePicture = async (): Promise<boolean> => {
    if (!cardRef.current) return false;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
      const link = recipe.source?.url;
      const res = await Share.share({
        url: uri,
        message: `${partnerName ? `${partnerName}, ` : ''}dinner tonight? ${recipe.title} 🍽️${link ? `\n${link}` : ''}`,
      });
      return res.action === Share.sharedAction;
    } catch {
      toast('Couldn\'t make the picture. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: C.cream }} testID="share-card-screen">
      <View className="flex-row items-center justify-between px-5" style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}>
        <Txt display weight="extrabold" className="text-[24px]">Send recipe</Txt>
        <PressableScale testID="share-card-close" accessibilityLabel="Close" onPress={goBack}>
          <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: C.paper }}><X size={20} color={C.ink} /></View>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: 12 }}>
        <View ref={cardRef} collapsable={false} testID="share-card-preview">
          <RecipeCard recipe={recipe} onImageReady={() => setReady(true)} />
        </View>
      </ScrollView>

      <View className="px-5" style={{ paddingBottom: insets.bottom + 12, paddingTop: 10, gap: 10 }}>
        {sharedKitchen ? (
          <>
            {/* One tap: lands in their app AND opens the text, so they get it either way */}
            <Button
              testID="share-card-both"
              label={busy ? 'Making picture…' : `Send to ${partnerName ?? 'partner'} · app + text`}
              icon={busy ? <ActivityIndicator color={C.paper} /> : <Send size={19} color={C.paper} />}
              onPress={() => void sendBoth()}
              disabled={busy}
            />
            <View className="flex-row" style={{ gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button testID="share-card-in-app" variant="outline" label="App only" onPress={sendInApp} disabled={busy} />
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="share-card-picture" variant="outline" label="Text only" onPress={() => void sharePicture()} disabled={busy} />
              </View>
            </View>
          </>
        ) : (
          <>
            <Button
              testID="share-card-picture"
              label={busy ? 'Making picture…' : 'Share as picture'}
              icon={busy || !ready ? <ActivityIndicator color={C.paper} /> : <ImageIcon size={19} color={C.paper} />}
              onPress={() => void sharePicture()}
              disabled={busy}
            />
            {partnerName ? (
              <PressableScale testID="share-card-connect" accessibilityRole="button" onPress={() => router.push('/invite')}>
                <Txt weight="bold" className="text-center text-[13px]" style={{ color: C.inkSoft }}>
                  Want it to land in {partnerName}’s app too? <Txt weight="extrabold" style={{ color: C.leafDark }}>Connect your kitchens →</Txt>
                </Txt>
              </PressableScale>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
