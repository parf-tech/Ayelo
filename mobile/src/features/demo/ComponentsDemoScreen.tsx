import React, { useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import {
  Banner,
  Button,
  ChoiceCard,
  EmptyState,
  Icon,
  IconButton,
  ScreenContainer,
  Skeleton,
  Text,
  TextField,
  useToast,
} from '../../ui';
import type { IconTone } from '../../ui';
import { ICON_NAMES } from '../../ui/icons';
import { BackButton } from '../common/BackButton';

/** Page de démonstration des composants (docs/07 : un exemple par état). Accessible depuis S01 en développement. */
export function ComponentsDemoScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<'a' | 'b'>('a');

  const noop = () => undefined;
  const [favorite, setFavorite] = useState(false);

  return (
    <ScreenContainer scroll testID="screen-components-demo">
      <BackButton />
      <Text variant="title" header>
        {t('demo.title')}
      </Text>

      <Section title={t('demo.buttons')}>
        <Button label={t('demo.sample.primary')} onPress={noop} />
        <Button label={t('demo.sample.secondary')} variant="secondary" onPress={noop} />
        <Button label={t('demo.sample.ghost')} variant="ghost" onPress={noop} />
        <Button label={t('demo.sample.danger')} variant="danger" onPress={noop} />
        <Button label={t('demo.sample.loading')} loading onPress={noop} />
        <Button label={t('demo.sample.disabled')} disabled onPress={noop} />
      </Section>

      <Section title={t('demo.fields')}>
        <TextField label={t('demo.sample.field')} value={text} onChangeText={setText} />
        <TextField
          label={t('demo.sample.fieldError')}
          value={text}
          onChangeText={setText}
          error={t('demo.sample.fieldErrorMessage')}
        />
        <TextField label={t('demo.sample.disabled')} value="" onChangeText={noop} disabled />
      </Section>

      <Section title={t('demo.choices')}>
        <ChoiceCard label={t('demo.sample.choiceA')} selected={choice === 'a'} onPress={() => setChoice('a')} />
        <ChoiceCard label={t('demo.sample.choiceB')} selected={choice === 'b'} onPress={() => setChoice('b')} />
      </Section>

      <Section title={t('demo.banners')}>
        <Banner variant="success" message={t('demo.sample.success')} />
        <Banner variant="warning" message={t('demo.sample.warning')} />
        <Banner variant="error" message={t('demo.sample.error')} />
        <Banner variant="info" message={t('demo.sample.info')} />
        <Button
          label={t('demo.sample.toast')}
          variant="secondary"
          onPress={() => toast.show({ message: t('demo.sample.toastMessage'), variant: 'success' })}
        />
      </Section>

      <Section title={t('demo.skeleton')}>
        <Skeleton variant="card" />
        <Skeleton />
        <Skeleton variant="circle" />
      </Section>

      <Section title={t('demo.empty')}>
        <EmptyState
          title={t('demo.sample.emptyTitle')}
          description={t('demo.sample.emptyBody')}
          actionLabel={t('demo.sample.emptyAction')}
          onAction={noop}
        />
      </Section>

      <Section title={t('demo.icons')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
          {ICON_NAMES.map((name) => (
            <View key={name} style={{ width: 88, alignItems: 'center', gap: space[1] }}>
              <Icon name={name} size="lg" />
              <Text variant="caption" tone="textMuted" align="center">
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t('demo.iconSizes')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
          <Icon name="Heart" size="sm" tone="like" filled />
          <Icon name="Heart" size="md" tone="like" filled />
          <Icon name="Heart" size="lg" tone="like" filled />
          <Icon name="Heart" size="xl" tone="like" filled />
        </View>
      </Section>

      <Section title={t('demo.iconTones')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
          {ICON_TONES.map((tone) => (
            <ToneSample key={tone} tone={tone} />
          ))}
        </View>
      </Section>

      <Section title={t('demo.iconButtons')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <IconButton icon="X" accessibilityLabel={t('demo.sample.iconClose')} onPress={noop} testID="demo-ib-plain" />
          <IconButton
            icon="Ellipsis"
            variant="tonal"
            expanded={false}
            accessibilityLabel={t('demo.sample.iconMenu')}
            onPress={noop}
            testID="demo-ib-tonal"
          />
          <IconButton
            icon="Send"
            variant="filled"
            accessibilityLabel={t('demo.sample.iconSend')}
            onPress={noop}
            testID="demo-ib-filled"
          />
          <IconButton
            icon="Trash2"
            variant="danger"
            accessibilityLabel={t('demo.sample.iconClose')}
            onPress={noop}
            testID="demo-ib-danger"
          />
          <IconButton
            icon="Star"
            size="lg"
            selected={favorite}
            accessibilityLabel={t('demo.sample.iconFavorite')}
            onPress={() => setFavorite((v) => !v)}
            testID="demo-ib-toggle"
          />
          <IconButton
            icon="SlidersHorizontal"
            variant="tonal"
            accessibilityLabel={t('demo.sample.iconFilters')}
            badge={{ kind: 'count', count: 3, accessibilityLabel: t('demo.sample.iconFiltersCount') }}
            onPress={noop}
            testID="demo-ib-badge"
          />
          <IconButton
            icon="Send"
            variant="filled"
            loading
            accessibilityLabel={t('demo.sample.iconSend')}
            onPress={noop}
            testID="demo-ib-loading"
          />
          <IconButton
            icon="X"
            disabled
            accessibilityLabel={t('demo.sample.iconClose')}
            onPress={noop}
            testID="demo-ib-disabled"
          />
          <IconButton
            icon="Send"
            variant="filled"
            disabled
            accessibilityLabel={t('demo.sample.iconSend')}
            onPress={noop}
            testID="demo-ib-disabled-filled"
          />
        </View>
      </Section>
      <View style={{ height: space[6] }} />
    </ScreenContainer>
  );
}

const ICON_TONES: IconTone[] = [
  'text',
  'textMuted',
  'primary',
  'onPrimary',
  'onAccent',
  'danger',
  'success',
  'warning',
  'verified',
  'like',
  'dislike',
  'disabledText',
];

/** Fond de l'échantillon : les tons « sur » (onPrimary, onAccent) ont besoin de leur fond. */
function ToneSample({ tone }: { tone: IconTone }) {
  const { colors, radius, space } = useTheme();
  const backgroundColor =
    tone === 'onPrimary'
      ? colors.primary
      : tone === 'onAccent'
        ? colors.accent
        : tone === 'disabledText'
          ? colors.disabledBg
          : colors.surface;
  return (
    <View style={{ backgroundColor, padding: space[2], borderRadius: radius.sm }}>
      <Icon name="BadgeCheck" size="lg" tone={tone} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ marginTop: space[5], gap: space[3] }}>
      <Text variant="h2" header>
        {title}
      </Text>
      {children}
    </View>
  );
}
