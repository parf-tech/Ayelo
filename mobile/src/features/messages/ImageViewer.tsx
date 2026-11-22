import React from 'react';
import { Image, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { IconButton } from '../../ui';

/**
 * Photo d'une conversation en plein écran : l'image entière (sans recadrage) sur le fond opaque des modales, un bouton Fermer
 * de 44 pt au moins, et le geste de retour du système (`onRequestClose`).
 */
export function ImageViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { t } = useI18n();
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View testID="image-viewer" accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.overlay }}>
        <Image
          testID="image-viewer-image"
          source={{ uri }}
          resizeMode="contain"
          accessibilityLabel={t('conversation.media.image')}
          accessibilityIgnoresInvertColors
          style={{ flex: 1 }}
        />
        <View style={{ position: 'absolute', top: insets.top + space[2], right: space[2] }}>
          <IconButton testID="image-viewer-close" icon="X" variant="filled" accessibilityLabel={t('conversation.image.close')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
