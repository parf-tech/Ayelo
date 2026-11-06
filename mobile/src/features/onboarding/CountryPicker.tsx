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
    const first = items.slice(0, 8);
    if (value && query.trim() === '' && !first.some((item) => item.code === value)) {
      const selected = COUNTRY_CODES.find((code) => code === value);
      if (selected) first.unshift({ code: selected, name: t(countryKey(selected)) });
    }
    return first;
  }, [items, value, query, t]);

  return (
    <View>
      <TextField label={label ?? t('profile.country')} value={query} onChangeText={setQuery} placeholder={searchPlaceholder ?? t('profile.country.search')} error={error} testID={`${idPrefix}-search`} autoCorrect={false} />
      <View style={{ marginTop: space[2], gap: space[2] }}>
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
      </View>
    </View>
  );
}
