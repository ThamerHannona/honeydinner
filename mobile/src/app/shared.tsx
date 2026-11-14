// Opened by the share extension's "Cook it now" / "Finish in the app" buttons
// (honeydinner://shared or honeydinner://shared?url=...).
// Saves whatever was shared and jumps straight to that recipe, or finishes a
// queued link import if the extension couldn't read the post itself.
import { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { queueLink } from '@/lib/share-inbox';
import { ingestInbox, whenHydrated } from '@/lib/use-share-inbox';
import { useApp } from '@/lib/store';
import { C } from '@/lib/theme';

export default function SharedRoute() {
  const params = useLocalSearchParams<{ url?: string | string[] }>();
  useEffect(() => {
    whenHydrated(() => {
      void (async () => {
        const raw = params.url;
        const url = Array.isArray(raw) ? raw[0] : raw;
        if (url) queueLink(url);
        const { lastId, hasLink } = await ingestInbox();
        const id =
          lastId ??
          [...useApp.getState().recipes]
            .filter((r) => r.importedAt)
            .sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''))[0]?.id ??
          null;
        if (id) router.replace({ pathname: '/recipe/[id]', params: { id } });
        else if (!hasLink) router.replace('/');
      })();
    });
  }, [params.url]);
  return <View testID="shared-route" style={{ flex: 1, backgroundColor: C.cream }} />;
}
