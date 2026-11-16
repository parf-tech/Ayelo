import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { AsyncView, Button, ScreenContainer } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { PreferenceFields, type PreferenceValues } from '../preferences/PreferenceFields';
import { useDiscoverFilters } from './DiscoverFiltersProvider';

/** S09 : filtres de la découverte (âge, pays, origine, intentions, vérifiés). Valeurs de départ = filtres actifs, sinon préférences. */
export function FiltersScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api } = useAuth();
  const { filters, setFilters } = useDiscoverFilters();
  const prefs = useResource(() => api.profile.preferences(), [api]);
  const [draft, setDraft] = useState<PreferenceValues | null>(null);

  useEffect(() => {
    if (draft || !prefs.data) return;
    const base = prefs.data;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      seeking_genders: base.seeking_genders,
      age_min: filters?.age_min ?? base.age_min,
      age_max: filters?.age_max ?? base.age_max,
      countries: filters?.countries ?? base.countries,
      origins: filters?.origins ?? base.origins,
      intents: filters?.intents ?? base.intents,
      verified_only: filters?.verified_only ?? base.verified_only,
    });
  }, [prefs.data, draft, filters]);

  const apply = () => {
    if (!draft) return;
    setFilters({
      age_min: draft.age_min,
      age_max: draft.age_max,
      countries: draft.countries,
      origins: draft.origins,
      intents: draft.intents,
      verified_only: draft.verified_only,
    });
    router.back();
  };

  const reset = () => {
    setFilters(null);
    router.back();
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-filters"
      footer={
        <View style={{ gap: space[2] }}>
          <Button testID="filters-apply" label={t('filters.apply')} onPress={apply} disabled={!draft} />
          <Button testID="filters-reset" variant="ghost" label={t('filters.reset')} onPress={reset} />
        </View>
      }
    >
      <ScreenHeader title={t('filters.title')} />
      <View style={{ paddingTop: space[3] }}>
        <AsyncView status={draft ? 'ready' : prefs.status === 'error' ? 'error' : 'loading'} error={prefs.error} onRetry={() => void prefs.reload()} testID="filters">
          {draft ? <PreferenceFields idPrefix="filter" showSeeking={false} value={draft} onChange={setDraft} /> : null}
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
