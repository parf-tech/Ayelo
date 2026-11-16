import type { I18n } from '../../i18n/I18nProvider';

/** Libellés accessibles du bouton afficher / masquer d'un champ mot de passe (le bouton est une icône, sans texte visible). */
export function passwordToggleLabels(t: I18n['t']) {
  return {
    show: t('ui.password.show'),
    hide: t('ui.password.hide'),
  };
}
