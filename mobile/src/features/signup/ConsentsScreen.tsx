import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import type { ConsentsPayload } from '../../api/types';
import { hasRequiredConsents, SIGNUP_ROUTES } from '../../flow/signupMachine';
import { useSignupFlow, useSignupGuard } from '../../flow/SignupFlowProvider';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, CheckboxField, ScreenContainer, Text } from '../../ui';
import { BackButton } from '../common/BackButton';

/** S63 : consentements. Cases distinctes ; terms, privacy et sensitive_data obligatoires, marketing facultatif. */
export function ConsentsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { state, dispatch } = useSignupFlow();
  const guard = useSignupGuard('consents');

  const [consents, setConsents] = useState<ConsentsPayload>(
    state.consents ?? { terms: false, privacy: false, sensitive_data: false, marketing: false },
  );

  if (guard) return guard;

  const canContinue = hasRequiredConsents(consents);
  const set = (key: keyof ConsentsPayload) => (value: boolean) => setConsents((c) => ({ ...c, [key]: value }));

  const next = () => {
    if (!canContinue) return;
    dispatch({ type: 'CONSENTS_ACCEPTED', consents });
    router.push(SIGNUP_ROUTES.birthdate as never);
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-consents"
      footer={
        <View style={{ gap: space[2] }}>
          {!canContinue ? (
            <Text variant="caption" tone="textMuted" testID="consents-missing">
              {t('consents.missing')}
            </Text>
          ) : null}
          <Button testID="consents-continue" label={t('common.continue')} onPress={next} disabled={!canContinue} />
        </View>
      }
    >
      <BackButton />
      <Text variant="title" header style={{ marginTop: space[2] }}>
        {t('consents.title')}
      </Text>
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2], marginBottom: space[4] }}>
        {t('consents.intro')}
      </Text>
      <View style={{ gap: space[3] }}>
        <CheckboxField
          testID="consent-terms"
          label={t('consents.terms.label')}
          description={t('consents.terms.description')}
          badge={t('common.required')}
          checked={consents.terms}
          onChange={set('terms')}
        />
        <CheckboxField
          testID="consent-privacy"
          label={t('consents.privacy.label')}
          description={t('consents.privacy.description')}
          badge={t('common.required')}
          checked={consents.privacy}
          onChange={set('privacy')}
        />
        <CheckboxField
          testID="consent-sensitive"
          label={t('consents.sensitive.label')}
          description={t('consents.sensitive.description')}
          badge={t('common.required')}
          checked={consents.sensitive_data}
          onChange={set('sensitive_data')}
        />
        <CheckboxField
          testID="consent-marketing"
          label={t('consents.marketing.label')}
          description={t('consents.marketing.description')}
          badge={t('common.optional')}
          checked={Boolean(consents.marketing)}
          onChange={set('marketing')}
        />
      </View>
    </ScreenContainer>
  );
}
