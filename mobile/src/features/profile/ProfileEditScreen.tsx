import { usePreventRemove, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GENDERS, INTENTS, isApiError, type Gender, type Intent, type ProfileInput, type SelfProfile } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ChoiceCard, ListRow, ScreenContainer, Text, TextField, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { CountryPicker } from '../onboarding/CountryPicker';
import { FormSection } from '../onboarding/FormSection';
import { PhotosManager } from '../photos/PhotosManager';
import { validateCity, validateDisplayName } from '../validation';

type Form = {
  displayName: string;
  gender: Gender;
  residence: string;
  origin: string;
  city: string;
  bio: string;
  intent: Intent;
};

/** Longueur maximale de la présentation (même limite que le serveur) : champ, message d'erreur et validation. */
const BIO_MAX_LENGTH = 500;
/** Largeur minimale d'une carte de genre : trois cartes tiennent sur une ligne à 390 pt, passent à la ligne au-delà du texte agrandi. */
const GENDER_TILE_MIN_WIDTH = 104;

/** Champs modifiés par rapport au profil enregistré : seuls ceux-ci sont envoyés (PUT /me/profile), et leur absence = rien à perdre. */
function changedFields(form: Form, profile: SelfProfile): ProfileInput {
  const body: ProfileInput = {};
  if (form.displayName.trim() !== profile.display_name) body.display_name = form.displayName.trim();
  if (form.gender !== profile.gender) body.gender = form.gender;
  if (form.residence !== profile.residence_country) body.residence_country = form.residence;
  if (form.origin !== profile.origin_country) body.origin_country = form.origin;
  if ((form.city.trim() || null) !== profile.city) body.city = form.city.trim() || null;
  if ((form.bio.trim() || null) !== profile.bio) body.bio = form.bio.trim() || null;
  if (form.intent !== profile.intent) body.intent = form.intent;
  return body;
}

/** S60 : édition du profil (PUT /me/profile : seuls les champs modifiés sont envoyés) et gestion des photos. */
export function ProfileEditScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api, refreshMe } = useAuth();
  const me = useResource(() => api.auth.me(), [api]);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<{ name?: string; city?: string; bio?: string }>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const profile = me.data?.profile ?? null;
  // Sortie interceptée tant que des modifications ne sont pas enregistrées (bouton retour, retour matériel, geste de retour) :
  // `usePreventRemove` (expo-router 58 ; l'événement `beforeRemove` n'existe plus). `discarded` coupe la protection quand
  // l'utilisateur choisit de quitter ou quand l'enregistrement a réussi.
  const dirty = form !== null && profile !== null && Object.keys(changedFields(form, profile)).length > 0;
  const [discarded, setDiscarded] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const disablePrevention = usePreventRemove(dirty && !discarded, ({ repeat }) => setPendingLeave(() => repeat));
  const leaveWithoutSaving = () => {
    const repeat = pendingLeave;
    setPendingLeave(null);
    setDiscarded(true);
    repeat?.();
  };

  useEffect(() => {
    if (form || !profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      displayName: profile.display_name,
      gender: profile.gender,
      residence: profile.residence_country,
      origin: profile.origin_country,
      city: profile.city ?? '',
      bio: profile.bio ?? '',
      intent: profile.intent,
    });
  }, [profile, form]);

  const patch = (change: Partial<Form>) => setForm((current) => (current ? { ...current, ...change } : current));

  const save = async () => {
    if (!form || !profile) return;
    setBanner(undefined);
    const nameKey = validateDisplayName(form.displayName);
    const cityKey = form.city.trim() === '' ? null : validateCity(form.city);
    const bioTooLong = form.bio.length > BIO_MAX_LENGTH;
    const found = {
      name: nameKey ? t(nameKey) : undefined,
      city: cityKey ? t(cityKey) : undefined,
      bio: bioTooLong ? t('edit.bio.tooLong') : undefined,
    };
    setErrors(found);
    if (found.name || found.city || found.bio) return;

    const body = changedFields(form, profile);

    if (Object.keys(body).length === 0) {
      router.back();
      return;
    }
    setSaving(true);
    try {
      await api.profile.update(body);
      await refreshMe();
      toast.show({ message: t('edit.saved'), variant: 'success' });
      setDiscarded(true);
      disablePrevention();
      router.back();
    } catch (error) {
      if (isApiError(error) && error.isValidation && error.fieldError('residence_country')) {
        setBanner(t('edit.residenceLimit'));
      } else {
        const { key, params } = apiErrorMessage(error);
        setBanner(t(key, params));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-profile-edit"
      footer={
        <View style={{ gap: space[3] }}>
          {pendingLeave !== null ? (
            <Banner
              testID="edit-unsaved"
              variant="warning"
              message={t('edit.unsaved')}
              actionLabel={t('edit.unsaved.leave')}
              onAction={leaveWithoutSaving}
              onDismiss={() => setPendingLeave(null)}
              dismissLabel={t('edit.unsaved.stay')}
            />
          ) : null}
          <Button testID="edit-save" label={t('common.save')} onPress={() => void save()} loading={saving} disabled={!form} />
        </View>
      }
    >
      <ScreenHeader title={t('edit.title')} fallbackHref="/profile" />
      <View style={{ paddingTop: space[3] }}>
        {banner ? (
          <Banner
            testID="edit-banner"
            variant="error"
            message={banner}
            onDismiss={() => setBanner(undefined)}
            dismissLabel={t('ui.banner.dismiss')}
            style={{ marginBottom: space[4] }}
          />
        ) : null}
        <AsyncView status={form ? 'ready' : me.status === 'error' ? 'error' : 'loading'} error={me.error} onRetry={() => void me.reload()} testID="edit">
          {form ? (
            // Groupes séparés par l'espace (32), champs d'un même groupe à 16 : aucun trait entre deux champs seuls.
            <View style={{ gap: space[6] }}>
              <View style={{ gap: space[4] }}>
                <TextField testID="edit-name" label={t('profile.name')} value={form.displayName} onChangeText={(displayName) => patch({ displayName })} error={errors.name} maxLength={40} />
                <View accessibilityRole="radiogroup" accessibilityLabel={t('profile.gender')} style={{ gap: space[1] }}>
                  <Text variant="labelStrong">
                    {t('profile.gender')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                    {GENDERS.map((gender) => (
                      <ChoiceCard
                        key={gender}
                        layout="tile"
                        testID={`edit-gender-${gender}`}
                        label={t(`gender.${gender}`)}
                        selected={form.gender === gender}
                        onPress={() => patch({ gender })}
                        style={{ flexGrow: 1, minWidth: GENDER_TILE_MIN_WIDTH }}
                      />
                    ))}
                  </View>
                </View>
                <TextField
                  testID="edit-bio"
                  label={t('edit.bio')}
                  helper={t('edit.bio.hint')}
                  value={form.bio}
                  onChangeText={(bio) => patch({ bio })}
                  error={errors.bio}
                  multiline
                  maxLength={BIO_MAX_LENGTH}
                />
              </View>

              <View style={{ gap: space[4] }}>
                <CountryPicker idPrefix="edit-residence" value={form.residence} onChange={(residence) => patch({ residence })} />
                <CountryPicker
                  idPrefix="edit-origin"
                  label={t('profile.origin')}
                  searchPlaceholder={t('profile.origin.search')}
                  value={form.origin}
                  onChange={(origin) => patch({ origin })}
                />
                <TextField testID="edit-city" label={t('profile.city')} value={form.city} onChangeText={(city) => patch({ city })} error={errors.city} maxLength={80} />
              </View>

              <FormSection title={t('intent.title')}>
                <View accessibilityRole="radiogroup" accessibilityLabel={t('intent.title')} style={{ gap: space[2] }}>
                  {INTENTS.map((intent) => (
                    <ChoiceCard key={intent} testID={`edit-intent-${intent}`} label={t(`intent.${intent}.label`)} selected={form.intent === intent} onPress={() => patch({ intent })} />
                  ))}
                </View>
              </FormSection>

              <FormSection title={t('edit.photos')}>
                <PhotosManager />
              </FormSection>

              <ListRow testID="edit-preferences" label={t('edit.preferences')} onPress={() => router.push('/settings/preferences' as never)} />
            </View>
          ) : null}
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
