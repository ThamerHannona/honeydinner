import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import { Skeleton } from './ui';

/** Keep a content-shaped placeholder in place until the real photo is ready. */
export function RecipeImage({ style, testID, onLoadStart, onLoadEnd, onError, ...props }: ImageProps) {
  const [loading, setLoading] = useState<boolean>(true);
  return <View style={[style, { overflow: 'hidden' }]}>
    <Image {...props} testID={testID} style={StyleSheet.absoluteFill}
      onLoadStart={() => { setLoading(true); onLoadStart?.(); }}
      onLoadEnd={() => { setLoading(false); onLoadEnd?.(); }}
      onError={(event) => { setLoading(false); onError?.(event); }} />
    {loading ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><Skeleton testID={`${testID ?? 'recipe-image'}-skeleton`} height={undefined} style={{ flex: 1, height: '100%', borderRadius: 0 }} /></View> : null}
  </View>;
}
