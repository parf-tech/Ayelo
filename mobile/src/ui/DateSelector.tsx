import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
import { Text } from './Text';

export type DateParts = { day?: number; month?: number; year?: number };

export type DateSelectorProps = {
  value: DateParts;
  onChange: (value: DateParts) => void;
  years: number[];
  monthLabels: string[]; // 12 entrées
  labels: { day: string; month: string; year: string };
  /** Année vers laquelle faire défiler la liste au premier affichage (aide visuelle, ne présélectionne rien). */
  initialScrollYear?: number;
  error?: string;
  testID?: string;
};

const ROW_HEIGHT = MIN_TARGET;
const LIST_HEIGHT = ROW_HEIGHT * 4;
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Sélecteur de date en trois colonnes (jour, mois, année), 100 % JavaScript : fonctionne dans Expo Go
 * sans module natif. Aucune valeur n'est présélectionnée.
 */
export function DateSelector({
  value,
  onChange,
  years,
  monthLabels,
  labels,
  initialScrollYear,
  error,
  testID,
}: DateSelectorProps) {
  const { space } = useTheme();
  return (
    <View testID={testID}>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Column
          title={labels.day}
          testID="date-day"
          items={DAYS.map((d) => ({ key: d, label: String(d) }))}
          selected={value.day}
          onSelect={(day) => onChange({ ...value, day })}
          flex={1}
        />
        <Column
          title={labels.month}
          testID="date-month"
          items={monthLabels.map((label, i) => ({ key: i + 1, label }))}
          selected={value.month}
          onSelect={(month) => onChange({ ...value, month })}
          flex={2}
        />
        <Column
          title={labels.year}
          testID="date-year"
          items={years.map((y) => ({ key: y, label: String(y) }))}
          selected={value.year}
          onSelect={(year) => onChange({ ...value, year })}
          flex={1.4}
          scrollToKey={initialScrollYear}
        />
      </View>
      {error ? (
        <Text
          variant="caption"
          tone="danger"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="date-error"
          style={{ marginTop: space[2] }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type ColumnProps = {
  title: string;
  testID: string;
  items: { key: number; label: string }[];
  selected?: number;
  onSelect: (key: number) => void;
  flex: number;
  scrollToKey?: number;
};

function Column({ title, testID, items, selected, onSelect, flex, scrollToKey }: ColumnProps) {
  const { colors, radius, space } = useTheme();
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollToKey === undefined) return;
    const index = items.findIndex((item) => item.key === scrollToKey);
    if (index > 0) {
      const id = setTimeout(() => ref.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false }), 0);
      return () => clearTimeout(id);
    }
    // Exécuté une seule fois au premier affichage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex }} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Text variant="caption" tone="textMuted" style={{ fontWeight: '600', marginBottom: space[1] }}>
        {title}
      </Text>
      <ScrollView
        ref={ref}
        testID={testID}
        nestedScrollEnabled
        style={{
          height: LIST_HEIGHT,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {items.map((item) => {
          const isSelected = item.key === selected;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="radio"
              accessibilityLabel={`${title} ${item.label}`}
              accessibilityState={{ checked: isSelected, selected: isSelected }}
              onPress={() => onSelect(item.key)}
              style={({ pressed }) => ({
                height: ROW_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSelected ? colors.primary : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="body" tone={isSelected ? 'onPrimary' : 'text'} style={{ fontWeight: isSelected ? '700' : '400' }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
