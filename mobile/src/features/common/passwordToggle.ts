import type { I18n } from '../../i18n/I18nProvider';

/** Libellés du bouton afficher / masquer d'un champ mot de passe : texte visible court, libellé accessible complet. */
export function passwordToggleLabels(t: I18n['t']) {
  return {
    show: t('ui.password.show'),
    hide: t('ui.password.hide'),
    showShort: t('ui.password.showShort'),
    hideShort: t('ui.password.hideShort'),
  };
}
