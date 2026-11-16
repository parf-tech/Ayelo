import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { ChoiceCard, Text, TextField } from '../../ui';
import { COUNTRY_CODES, countryKey } from './countries';

type Props = {
  value: string | null;
  onChange: (code: string) => void;
  error?: string;
  /** Libellé du champ (par défaut : pays de résidence). */
  label?: string;
  searchPlaceholder?: string;
  /** Préfixe des testID (country-FR par défaut ; origin-FR pour le pays d'origine). */
  idPrefix?: string;
};

/** Nombre de pays affichés sans recherche (les autres s'obtiennent en tapant dans le champ). */
const MAX_VISIBLE = 8;

/** Sélecteur de pays recherchable (liste courte du lancement). États : vide, sélectionné, aucun résultat. */
export function CountryPicker({ value, onChange, error, label, searchPlaceholder, idPrefix = 'country' }: Props) {
  const { t } = useI18n();
  const { space } = useTheme();
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRY_CODES.map((code) => ({ code, name: t(countryKey(code)) })).filter(
      (item) => q === '' || item.name.toLowerCase().includes(q) || item.code.toLowerCase() === q,
    );
  }, [query, t]);

  const visible = useMemo(() => {
    const first = items.slice(0, MAX_VISIBLE);
    if (value && query.trim() === '' && !first.some((item) => item.code === value)) {
      const selected = COUNTRY_CODES.find((code) => code === value);
      if (selected) first.unshift({ code: selected, name: t(countryKey(selected)) });
    }
    return first;
  }, [items, value, query, t]);

  const hidden = Math.max(items.length - MAX_VISIBLE, 0);
  const fieldLabel = label ?? t('profile.country');

  return (
    <View>
      <TextField
        label={fieldLabel}
        value={query}
        onChangeText={setQuery}
        placeholder={searchPlaceholder ?? t('profile.country.search')}
        error={error}
        testID={`${idPrefix}-search`}
        autoCorrect={false}
      />
      <View accessibilityRole="radiogroup" accessibilityLabel={fieldLabel} style={{ marginTop: space[2], gap: space[2] }}>
        {visible.length === 0 ? (
          <Text variant="caption" tone="textMuted">
            {t('profile.country.none')}
          </Text>
        ) : (
          visible.map((item) => (
            <ChoiceCard
              key={item.code}
              testID={`${idPrefix}-${item.code}`}
              label={item.name}
              selected={value === item.code}
              onPress={() => onChange(item.code)}
            />
          ))
        )}
        {hidden > 0 && query.trim() === '' ? (
          <Text variant="caption" tone="textMuted" testID={`${idPrefix}-more`}>
            {t('profile.country.more', { count: hidden })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
