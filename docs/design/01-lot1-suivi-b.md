# Lot 1, suivi B : date de naissance, en-tête de conversation, pieds de page

Date : 2026-11-08. Périmètre : `mobile/` uniquement. Source : `01-decisions.md` (décisions 1 et 4, liste « À corriger tout de suite »). L'autre lot (accueil, jetons, EmptyState, SwitchRow, vérification, AuthFormScreen, texte d'inscription) n'est pas couvert ici.

## Fait

- [x] **Date de naissance en trois champs (décision 4).** `BirthdateScreen.tsx` : trois `TextField` Jour / Mois / Année, repères JJ / MM / AAAA, `keyboardType="number-pad"`, `maxLength` 2 / 2 / 4, seuls les chiffres sont gardés, le focus passe au champ suivant quand le champ est plein, `returnKeyType` next / next / done (done valide si la date est valide). Validation pure `checkBirthdateFields` dans `features/validation.ts` (s'appuie sur `toIsoBirthdate`, inchangé). Messages précis : jour hors 1-31, mois hors 1-12, année avant 1900, date inexistante (31/02), date future, saisie incomplète (affichée seulement après avoir quitté le champ année, jamais pendant la frappe). « Continuer » actif seulement si la date est complète et valide. Le format envoyé (`YYYY-MM-DD`), l'appel `age-check`, le 403 `age_not_eligible` vers l'écran de refus, les bannières 429 et réseau : inchangés. Le client ne juge jamais l'âge (une date de mineur est « ok » côté client, test dédié).
- [x] `DateSelector.tsx` supprimé : seul `BirthdateScreen` l'utilisait. `birthYears` supprimé avec lui. `TextField` gagne une propriété `invalid` (bordure et libellé en erreur sans message ; le message est porté par la ligne de trois champs).
- [x] **En-tête de conversation (320 pt, 200 %).** Deux lignes : actions (Retour, menu, appels si activés) puis identité (avatar et nom sur deux lignes au plus). Le menu signaler / bloquer reste atteignable, cibles de 44 pt conservées.
- [x] **Appels masqués (décision 1).** `src/config/features.ts` : `CALLS_ENABLED = false`. Utilisé par l'en-tête de conversation, seul point d'entrée sortant (aucun bouton d'appel dans Découverte ni dans le détail de profil : vérifié par recherche). « Rompre le match » reste dans le menu (il dépendait à tort de la condition d'appel). Aucun code d'appel supprimé.
- [x] **Button** : `numberOfLines={2}` retiré, libellé qui passe à la ligne, hauteur minimale 48, remplissage conservé.
- [x] **ScreenContainer** : pied de page plafonné à 45 % de la hauteur de l'écran ; à partir d'un agrandissement de 1,3 il se compacte (marges réduites) et défile. Zone sûre conservée (`SafeAreaView`).
- [x] **Fuites de texte** dans mes fichiers : « prototype D0 requis » retiré du texte d'appel (`calls.fr/en.ts`) ; « pas encore prises en charge dans cette version » retiré (`messages.fr/en.ts`).
- [x] i18n fr et en en parité : nouveau domaine `i18n/areas/birthdate.{fr,en}.ts` (évite de toucher `fr.ts` / `en.ts`). Test de non-copie : `birthdate.monthPlaceholder` (« MM ») ajouté aux termes identiques par nature.

## Tests

`flow.test.ts` (validation des trois champs), `screens.test.tsx` (écran de date : champs, plages, messages, anglais, rejet serveur, flux inchangés), `ui.test.tsx` (Button sans troncature, pied de page avec `fontScale` simulé 1 et 2 sur 320 x 640, `invalid`), `messages.test.tsx` (appels masqués, indicateur activé, non-match, en-tête 320 pt / 200 %), `calls.test.tsx` (texte d'indisponibilité).

## Pas fait, et pourquoi

- [ ] Clés `month.1` à `month.12` (fr.ts / en.ts) devenues inutilisées : non supprimées, ces fichiers sont modifiés en parallèle par l'autre lot. À retirer au prochain passage.
- [ ] Textes « pour le moment » des états vides (`state.empty.title`, `discover.empty.title`, `messages.empty.title`, `premium.offers.empty`, `photos.empty`, `support.tickets.empty`) : conservés, ce sont des états vides naturels, pas des fuites de jargon, et plusieurs tests les citent ; `state.empty.title` appartient à l'autre lot (EmptyState). Le texte du refus d'âge est hors périmètre (autre lot, décision 13).
- [ ] `CallProvider` écoute toujours les appels entrants : un appel entrant ouvrirait l'écran d'appel sans média. Non traité (hors consigne : « masquer » les entrées sortantes). À décider avec le moteur média.
- [ ] Capture et vérification visuelle : seulement date de naissance en 390 x 844 (sombre) et 320 x 640 (clair) ; en-tête de conversation et pied de page en grande police non capturés (écran connecté, API requise ; couverts par les tests avec `fontScale` simulé).

## Captures

`docs/design/captures/lot1b-date-sombre-390.png`, `docs/design/captures/lot1b-date-clair-320.png`.
