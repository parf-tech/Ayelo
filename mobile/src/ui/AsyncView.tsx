import React from 'react';
import { View } from 'react-native';
import { isApiError } from '../api/errors';
import { useI18n } from '../i18n';
import { apiErrorMessage } from '../i18n/apiErrors';
import { useTheme } from '../theme';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Icon, type IconName } from './Icon';
import { Skeleton } from './Skeleton';

export type AsyncViewProps = {
  status: 'loading' | 'ready' | 'error';
  error?: unknown;
  onRetry?: () => void;
  /** true = la ressource est chargée mais vide. */
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  /** Pictogramme décoratif de l'état vide (le titre porte le sens). */
  emptyIcon?: IconName;
  /** Nombre de lignes squelettes pendant le chargement. */
  skeletonRows?: number;
  /** Squelette sur mesure (ex. une carte plein cadre) à la place des lignes ; reste annoncé « Chargement ». */
  loadingSkeleton?: React.ReactNode;
  testID?: string;
  children: React.ReactNode;
};

/** États communs d'une liste ou d'une page : chargement (squelettes), erreur (dont hors ligne) avec « Réessayer », vide. */
export function AsyncView({
  status,
  error,
  onRetry,
  empty,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  emptyIcon,
  skeletonRows = 4,
  loadingSkeleton,
  testID,
  children,
}: AsyncViewProps) {
  const { t } = useI18n();
  const { space } = useTheme();

  if (status === 'loading') {
    return (
      <View
        testID={testID ? `${testID}-loading` : 'async-loading'}
        accessible
        accessibilityLabel={t('common.loading')}
        style={loadingSkeleton ? { flex: 1 } : { gap: space[3], paddingVertical: space[3] }}
      >
        {loadingSkeleton ??
          Array.from({ length: skeletonRows }, (_, i) => <Skeleton key={i} variant="card" height={64} />)}
      </View>
    );
  }

  if (status === 'error') {
    const offline = isApiError(error) && error.isNetwork;
    const { key, params } = apiErrorMessage(error);
    return (
      <View testID={testID ? `${testID}-error` : 'async-error'}>
        <EmptyState
          illustration={<Icon name={offline ? 'WifiOff' : 'CircleAlert'} size="xl" tone="textMuted" testID="async-error-icon" />}
          title={offline ? t('state.offline.title') : t('state.error.title')}
          description={t(key, params)}
        />
        {onRetry ? (
          <View style={{ alignItems: 'center' }}>
            <Button testID="async-retry" label={t('common.retry')} onPress={onRetry} variant="secondary" />
          </View>
        ) : null}
      </View>
    );
  }

  if (empty) {
    return (
      <View testID={testID ? `${testID}-empty` : 'async-empty'}>
        <EmptyState
          illustration={emptyIcon ? <Icon name={emptyIcon} size="xl" tone="textMuted" testID="async-empty-icon" /> : undefined}
          title={emptyTitle ?? t('state.empty.title')}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      </View>
    );
  }

  return <>{children}</>;
}
