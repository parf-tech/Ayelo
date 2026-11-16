import React, { useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { borderWidth, ThemeProvider, useTheme } from '../../theme';
import type { Scheme } from '../../theme';
import {
  Avatar,
  ListRow,
  VerifiedBadge,
  Banner,
  Button,
  CheckboxField,
  ChoiceCard,
  EmptyState,
  Icon,
  IconButton,
  Logo,
  NavRow,
  RowGroup,
  ScreenContainer,
  Skeleton,
  SwitchGroup,
  SwitchRow,
  Text,
  TextField,
  useToast,
} from '../../ui';
import type { IconTone } from '../../ui';
import { LOGO_VARIANTS, isOnBrandVariant } from '../../ui/brandArt';
import { ICON_NAMES } from '../../ui/icons';
import { BackButton } from '../common/BackButton';
import { OnboardingDemo } from '../onboarding/OnboardingDemo';
import { ConfirmPanel } from '../settings/ConfirmPanel';

/** Page de démonstration des composants (docs/07 : un exemple par état). Accessible depuis S01 en développement. */
export function ComponentsDemoScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<'a' | 'b'>('a');

  const noop = () => undefined;
  const [favorite, setFavorite] = useState(false);
  const [checked, setChecked] = useState(false);
  const [switched, setSwitched] = useState(false);

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

      <OnboardingDemo />

      <Section title={t('demo.banners')}>
        <Banner variant="success" message={t('demo.sample.success')} />
        <Banner variant="warning" message={t('demo.sample.warning')} />
        <Banner variant="error" message={t('demo.sample.error')} />
        <Banner variant="info" message={t('demo.sample.info')} />
        <Banner
          variant="warning"
          message={t('demo.sample.bannerAction')}
          actionLabel={t('demo.sample.bannerActionLabel')}
          onAction={noop}
          onDismiss={noop}
          dismissLabel={t('ui.banner.dismiss')}
          testID="demo-banner-action"
        />
        <Button
          label={t('demo.sample.toast')}
          variant="secondary"
          onPress={() => toast.show({ message: t('demo.sample.toastMessage'), variant: 'success' })}
        />
      </Section>

      <Section title={t('demo.controls')}>
        <CheckboxField label={t('demo.sample.checkbox')} checked={checked} onChange={setChecked} testID="demo-checkbox" />
        <CheckboxField label={t('demo.sample.checkboxDisabled')} checked disabled onChange={noop} testID="demo-checkbox-disabled" />
        <SwitchGroup>
          <SwitchRow label={t('demo.sample.switch')} value={switched} onValueChange={setSwitched} testID="demo-switch" />
          <SwitchRow label={t('demo.sample.disabled')} value disabled onValueChange={noop} divider={false} testID="demo-switch-disabled" />
        </SwitchGroup>
        <RowGroup>
          <NavRow icon="User" label={t('demo.sample.navRow')} value={t('demo.sample.rowValue')} onPress={noop} testID="demo-navrow" />
          <NavRow icon="Trash2" tone="danger" label={t('demo.sample.rowDanger')} onPress={noop} testID="demo-navrow-danger" />
        </RowGroup>
        <ConfirmPanel testID="demo-confirm" message={t('demo.sample.confirm')} onConfirm={noop} onCancel={noop} />
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

      <Section title={t('demo.rows')}>
        <View>
          <ListRow
            label={t('demo.sample.rowTitle')}
            description={t('demo.sample.rowDescription')}
            value={t('demo.sample.rowValue')}
            leading={<Avatar name="A" size={40} />}
            onPress={noop}
            testID="demo-row-press"
          />
          <ListRow label={t('demo.sample.rowStatic')} value="1.0" testID="demo-row-static" />
          <ListRow label={t('demo.sample.rowDanger')} tone="danger" onPress={noop} testID="demo-row-danger" />
        </View>
      </Section>

      <Section title={t('demo.avatars')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
          <Avatar name={t('demo.sample.ringNone')} size={64} testID="demo-avatar-plain" />
          <Avatar name={t('demo.sample.ringStory')} size={64} ring="story" testID="demo-avatar-story" />
          <Avatar name={t('demo.sample.ringVerified')} size={64} ring="verified" testID="demo-avatar-verified" />
        </View>
      </Section>

      <Section title={t('demo.verifiedBadge')}>
        <VerifiedBadge
          label={t('demo.sample.verifiedLabel')}
          explanation={t('verified.explain')}
          hint={t('verified.hint')}
          testID="demo-verified"
        />
      </Section>

      <Section title={t('demo.logo')}>
        <LogoPanel scheme="light" title={t('demo.logoLight')} />
        <LogoPanel scheme="dark" title={t('demo.logoDark')} />
      </Section>

      <Section title={t('demo.typography')}>
        <Text variant="title">{t('demo.typeTitle')}</Text>
        <Text variant="h2">{t('demo.typeH2')}</Text>
        <Text variant="h3">{t('demo.typeH3')}</Text>
        <Text variant="body">{t('demo.typeBody')}</Text>
        <Text variant="label">{t('demo.typeLabel')}</Text>
        <Text variant="caption">{t('demo.typeCaption')}</Text>
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
  'onBrand',
  'accent',
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
        : tone === 'onBrand'
          ? colors.brand
          : tone === 'disabledText'
            ? colors.disabledBg
            : colors.surface;
  return (
    <View style={{ backgroundColor, padding: space[2], borderRadius: radius.sm }}>
      <Icon name="BadgeCheck" size="lg" tone={tone} />
    </View>
  );
}

/** Variantes x dispositions du logo sur le fond du mode donné (le blanc sur fond de marque). */
function LogoPanel({ scheme, title }: { scheme: Scheme; title: string }) {
  return (
    <ThemeProvider scheme={scheme}>
      <LogoPanelBody title={title} scheme={scheme} />
    </ThemeProvider>
  );
}

function LogoPanelBody({ scheme, title }: { scheme: Scheme; title: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: space[4], gap: space[3], borderWidth: borderWidth.hairline, borderColor: colors.border }}>
      <Text variant="label" tone="textMuted">
        {title}
      </Text>
      {LOGO_VARIANTS.map((variant) => (
        <View
          key={variant}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[4],
            padding: space[3],
            borderRadius: radius.sm,
            backgroundColor: isOnBrandVariant(variant) ? colors.brand : undefined,
          }}
        >
          <Logo variant={variant} layout="symbol" size={48} testID={`demo-logo-${scheme}-${variant}-symbol`} />
          <Logo variant={variant} layout="horizontal" size={48} testID={`demo-logo-${scheme}-${variant}-horizontal`} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        {[24, 32, 48].map((size) => (
          <Logo key={size} size={size} testID={`demo-logo-${scheme}-small-${size}`} />
        ))}
      </View>
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
