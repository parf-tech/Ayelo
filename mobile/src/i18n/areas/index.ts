import { birthdateEn } from './birthdate.en';
import { birthdateFr } from './birthdate.fr';
import { callsEn } from './calls.en';
import { callsFr } from './calls.fr';
import { commonEn } from './common.en';
import { commonFr } from './common.fr';
import { discoverEn } from './discover.en';
import { discoverFr } from './discover.fr';
import { messagesEn } from './messages.en';
import { messagesFr } from './messages.fr';
import { premiumEn } from './premium.en';
import { premiumFr } from './premium.fr';
import { profileEn } from './profile.en';
import { profileFr } from './profile.fr';
import { settingsEn } from './settings.en';
import { settingsFr } from './settings.fr';
import { uiEn } from './ui.en';
import { uiFr } from './ui.fr';
import { verificationEn } from './verification.en';
import { verificationFr } from './verification.fr';

/** Textes des écrans fonctionnels, regroupés par domaine. fr.ts et en.ts les assemblent. */
export const frAreas = {
  ...commonFr,
  ...birthdateFr,
  ...profileFr,
  ...discoverFr,
  ...messagesFr,
  ...callsFr,
  ...premiumFr,
  ...settingsFr,
  ...verificationFr,
  ...uiFr,
} as const;
export const enAreas = {
  ...commonEn,
  ...birthdateEn,
  ...profileEn,
  ...discoverEn,
  ...messagesEn,
  ...callsEn,
  ...premiumEn,
  ...settingsEn,
  ...verificationEn,
  ...uiEn,
} as const;
