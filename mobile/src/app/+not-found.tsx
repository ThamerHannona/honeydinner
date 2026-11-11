import { useTheme } from '@/lib/theme-context';
import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Txt } from '@/components/ui';

export default function NotFoundScreen() {
  const { C } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View testID="not-found-screen" style={{ backgroundColor: C.cream }} className="flex-1 items-center justify-center bg-cream p-5">
        <Txt display weight="bold" className="text-xl">
          This screen doesn't exist.
        </Txt>

        <Link href="/" testID="go-home-link" className="mt-4 py-4">
          <Txt className="text-sm text-leaf-dark">Go to home screen!</Txt>
        </Link>
      </View>
    </>
  );
}
