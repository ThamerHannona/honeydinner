import React from 'react';
import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/lib/theme-context';

const SOURCES = {
  tiktok: require('../../assets/onboarding/share-tiktok.mp4'),
  instagram: require('../../assets/onboarding/share-instagram.mp4'),
};

/** Looping, muted walkthrough: TikTok/Instagram → Share → Honey, Dinner? → saved recipe. */
export function ShareVideo({ platform, width = 236 }: { platform: 'tiktok' | 'instagram'; width?: number }) {
  const { C } = useTheme();
  const player = useVideoPlayer(SOURCES[platform], (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const height = Math.round((width * 960) / 540);
  return (
    <View testID={`share-video-${platform}`} style={{ width: width + 12, height: height + 12, borderRadius: 36, borderWidth: 6, borderColor: C.ink, overflow: 'hidden', backgroundColor: '#111', alignSelf: 'center' }}>
      <VideoView player={player} style={{ width, height }} contentFit="cover" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
    </View>
  );
}
