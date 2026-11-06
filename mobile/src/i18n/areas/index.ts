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
import { verificationEn } from './verification.en';
import { verificationFr } from './verification.fr';

/** Textes des écrans fonctionnels, regroupés par domaine. fr.ts et en.ts les assemblent. */
export const frAreas = {
  ...commonFr,
  ...profileFr,
  ...discoverFr,
  ...messagesFr,
  ...callsFr,
  ...premiumFr,
  ...settingsFr,
  ...verificationFr,
} as const;
export const enAreas = {
  ...commonEn,
  ...profileEn,
  ...discoverEn,
  ...messagesEn,
  ...callsEn,
  ...premiumEn,
  ...settingsEn,
  ...verificationEn,
} as const;
