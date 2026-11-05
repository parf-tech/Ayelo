import React, { useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, Button, ChoiceCard, EmptyState, ScreenContainer, Skeleton, Text, TextField, useToast } from '../../ui';
import { BackButton } from '../common/BackButton';

/** Page de démonstration des composants (docs/07 : un exemple par état). Accessible depuis S01 en développement. */
export function ComponentsDemoScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<'a' | 'b'>('a');

  const noop = () => undefined;

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
      <View style={{ height: space[6] }} />
    </ScreenContainer>
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
