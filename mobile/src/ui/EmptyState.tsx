import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export type EmptyStateProps = {
  title: string;
  description?: string;
  /** Illustration ou icône (à fournir par l'écran ; aucune image d'origine incluse). */
  illustration?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/**
 * État vide : illustration + titre + explication + action.
 * Pas de conteneur accessible : le titre et la description se lisent dans l'ordre, et le bouton reste atteignable.
 */
export function EmptyState({ title, description, illustration, actionLabel, onAction, testID }: EmptyStateProps) {
  const { space } = useTheme();
  return (
    <View
      testID={testID}
      style={{ alignItems: 'center', justifyContent: 'center', padding: space[6] }}
    >
      {illustration ? <View style={{ marginBottom: space[4] }}>{illustration}</View> : null}
      <Text variant="h2" align="center" header>
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="textMuted" align="center" style={{ marginTop: space[2] }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: space[5] }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
