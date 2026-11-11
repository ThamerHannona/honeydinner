import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { haptic } from './theme';

/** Local kitchen lists are live Zustand data. Refresh re-evaluates freshness and
 * recommendations, and invalidates any cached async kitchen work without
 * replacing a person's current list with stale persisted data. */
export function useKitchenRefresh() {
  const client = useQueryClient();
  const [revision, setRevision] = useState<number>(0);
  const refresh = useMutation({
    mutationFn: async () => {
      await client.invalidateQueries({ queryKey: ['kitchen'] });
      setRevision((value) => value + 1);
      haptic.select();
    },
  });
  return { refreshing: refresh.isPending, onRefresh: () => refresh.mutate(), revision };
}
