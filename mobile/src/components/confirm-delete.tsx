import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import { Button, Txt } from '@/components/ui';
import { useTheme } from '@/lib/theme-context';

/** Bottom sheet that confirms deleting a recipe. */
export function ConfirmDelete({
  title,
  visible,
  onCancel,
  onConfirm,
}: {
  title: string | null;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { C } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View entering={FadeIn.duration(160)} style={{ flex: 1, backgroundColor: 'rgba(20,18,14,0.45)', justifyContent: 'flex-end' }}>
        <Pressable testID="confirm-delete-backdrop" accessibilityLabel="Cancel" style={{ flex: 1 }} onPress={onCancel} />
        <Animated.View entering={SlideInDown.springify().damping(18)} style={{ backgroundColor: C.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, gap: 12 }} testID="confirm-delete-sheet">
          <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: '#F6D9D2' }}>
            <Trash2 size={22} color="#B23A26" />
          </View>
          <Txt display weight="extrabold" className="text-[24px] leading-[28px]">Delete {title ? `“${title}”` : 'this recipe'}?</Txt>
          <Txt weight="semibold" className="text-[15px] leading-[21px]" style={{ color: C.inkSoft }}>
            It’s removed from your recipe box — and from your partner’s if you share a kitchen.
          </Txt>
          <Button testID="confirm-delete-yes" variant="dark" label="Delete recipe" icon={<Trash2 size={18} color={C.cream} />} onPress={onConfirm} />
          <Button testID="confirm-delete-no" variant="outline" label="Keep it" onPress={onCancel} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
