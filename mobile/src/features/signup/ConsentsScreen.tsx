import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import type { ConsentsPayload } from '../../api/types';
import { hasRequiredConsents, SIGNUP_ROUTES } from '../../flow/signupMachine';
import { useSignupFlow, useSignupGuard } from '../../flow/SignupFlowProvider';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, Button, CheckboxField, ScreenContainer, Text } from '../../ui';
import { AuthHeader } from '../auth/AuthHeader';
import { useLegalOpener } from '../legal/useLegalOpener';

/** S63 : consentements, après le contrôle d'âge (S68). Cases distinctes ; terms, privacy et sensitive_data obligatoires, marketing facultatif. */
export function ConsentsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { state, dispatch } = useSignupFlow();
  const guard = useSignupGuard('consents');
  const openLegal = useLegalOpener();
  const [legalError, setLegalError] = useState(false);

  const [consents, setConsents] = useState<ConsentsPayload>(
    state.consents ?? { terms: false, privacy: false, sensitive_data: false, marketing: false },
  );

  if (guard) return guard;

  const canContinue = hasRequiredConsents(consents);
  // Un texte légal obligatoire qui ne s'ouvre pas ne doit jamais échouer en silence.
  const read = (doc: 'terms' | 'privacy') => {
    setLegalError(false);
    void openLegal(doc).then((ok) => setLegalError(!ok));
  };
  const set = (key: keyof ConsentsPayload) => (value: boolean) => setConsents((c) => ({ ...c, [key]: value }));

  const next = () => {
    if (!canContinue) return;
    dispatch({ type: 'CONSENTS_ACCEPTED', consents });
    router.push(SIGNUP_ROUTES.account as never);
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-consents"
      footer={
        <View style={{ gap: space[2] }}>
          {/* Échec d'ouverture d'un texte légal : près du bouton, pas en haut d'une page qui défile. */}
          {legalError ? <Banner testID="consents-legal-error" variant="error" message={t('legal.openError')} /> : null}
          {!canContinue ? (
            <Text variant="caption" tone="textMuted" testID="consents-missing" accessibilityLiveRegion="polite">
              {t('consents.missing')}
            </Text>
          ) : null}
          <Button testID="consents-continue" label={t('common.continue')} onPress={next} disabled={!canContinue} />
        </View>
      }
    >
      <AuthHeader />
      <Text variant="title" header style={{ marginTop: space[4] }}>
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
        <View style={{ alignSelf: 'flex-start' }}>
          <Button testID="consent-terms-read" variant="ghost" label={t('consents.terms.read')} onPress={() => read('terms')} />
        </View>
        <CheckboxField
          testID="consent-privacy"
          label={t('consents.privacy.label')}
          description={t('consents.privacy.description')}
          badge={t('common.required')}
          checked={consents.privacy}
          onChange={set('privacy')}
        />
        <View style={{ alignSelf: 'flex-start' }}>
          <Button testID="consent-privacy-read" variant="ghost" label={t('consents.privacy.read')} onPress={() => read('privacy')} />
        </View>
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
