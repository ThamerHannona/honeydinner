// Opened by the share extension's "Cook it now" button (honeydinner://shared).
// Saves whatever was shared and jumps straight to that recipe.
import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ingestInbox, whenHydrated } from '@/lib/use-share-inbox';
import { useApp } from '@/lib/store';
import { C } from '@/lib/theme';

export default function SharedRoute() {
  useEffect(() => {
    whenHydrated(() => {
      const id =
        ingestInbox() ??
        [...useApp.getState().recipes]
          .filter((r) => r.importedAt)
          .sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''))[0]?.id ??
        null;
      if (id) router.replace({ pathname: '/recipe/[id]', params: { id } });
      else router.replace('/');
    });
  }, []);
  return <View testID="shared-route" style={{ flex: 1, backgroundColor: C.cream }} />;
}
