# Lot 1 : suivi (application mobile)

Date : 2026-11-08. Périmètre : `mobile/` uniquement. Les éléments du lot 1 confiés à un autre agent (conversation, sélecteur de date en trois champs, boutons d'appel, pieds de page en grande police) ne sont pas dans cette liste. Chaque point ci-dessous a un test Jest (`mobile/__tests__/lot1.test.tsx`, sauf mention) et ses textes en français et en anglais.

| # | Point | État | Détail |
|---|---|---|---|
| 1 | Lien « Voir les composants (développement) » seulement en développement | Fait | Le bouton était déjà conditionné par `__DEV__` dans `WelcomeScreen.tsx`. Ajout du test dans les deux cas (`__DEV__` vrai : visible ; faux : absent). Aucun changement de code nécessaire. |
| 2 | Jetons clairs `like` `#137538`, `dislike` `#C81E1E` | Fait | `tokens.ts` (sombre inchangé). `theme.test.ts` : contraste texte >= 4,5:1 calculé sur `bg` et `surface` pour `like`, `dislike` et `verified`, en clair et en sombre, plus un test des valeurs. `app.json` laissé tel quel : `#C2410C` est la couleur `primary`, qui n'a pas changé (l'audit `00-a11y.md` ne demande la mise à jour que si `primary` change). |
| 3 | `EmptyState` sans regroupement accessible | Fait | Le conteneur `accessible` avec libellé fusionné est supprimé : titre (en-tête), description et bouton sont lus dans l'ordre et le bouton est atteignable par son rôle. Test avec `getByRole('button')` et appui. |
| 4 | Badge vérifié | Fait | Nouveau composant `ui/VerifiedBadge.tsx` (jeton `verified`, rôle bouton, état déplié annoncé, indication, texte d'explication en zone vocale polie). Utilisé dans `ProfileDetailScreen` et `ProfileTabScreen`. `SwipeCard` utilise le jeton `verified` mais reste non interactif : la carte est déjà un seul élément accessible à gestes, un bouton imbriqué y serait inaccessible ; l'explication est un toucher plus loin, sur la fiche. Textes `verified.explain` et `verified.hint` en fr et en ; `verify.subtitle` reformulé dans les deux langues (plus de « prouve que vous êtes bien la personne »). Reste : validation par le juriste. |
| 5 | `SwitchRow` : ligne entière cliquable | Fait | `Pressable` sur toute la ligne (hauteur minimale 56 pt), désactivé respecté. Le lecteur d'écran n'expose que l'interrupteur (libellé, description en indication) ; le texte visuel est masqué pour éviter la double annonce. |
| 6 | Refus d'âge sans « pour le moment » | Fait | fr : « Nous ne pouvons pas créer de compte. » ; en : « We are unable to create an account. » Test `screens.test.tsx` mis à jour. |
| 7 | Bouton afficher / masquer le mot de passe | Fait | `TextField` : libellés visibles courts `Afficher` / `Masquer` (`Show` / `Hide`), libellé accessible complet conservé, `accessibilityState` `{ disabled, selected }`. Choix du libellé court plutôt qu'une icône : aucune bibliothèque d'icônes avant la phase 3 (décision 11). Appliqué à la connexion, l'inscription, la réinitialisation, la suppression de compte et l'export (aide `features/common/passwordToggle.ts`). |
| 8 | Enchaînement des champs | Fait (partiel assumé) | `TextField` accepte `inputRef`. Connexion et inscription : e-mail (`next`) vers mot de passe (`go`) qui valide ; réinitialisation : code, mot de passe, confirmation (validation au dernier). Non traités : `BasicProfileScreen` et les écrans de saisie libre (hors e-mail, mot de passe). L'écran de date de naissance appartient à l'autre agent. |

## Vérifications

- `npm run typecheck` et `npm run lint` : propres à la fin du lot.
- `npx jest --testTimeout=30000` : 13 nouveaux tests du lot 1 et 6 tests de contraste ajoutés. Un échec hors de mes fichiers, dû aux modifications en cours de l'autre agent : `i18n.test.tsx` (la clé `birthdate.monthPlaceholder` est identique en fr et en).
- Captures avant / après : non réalisées (aucun serveur web lancé ; l'écran de date de naissance était en cours de modification par l'autre agent).

## Points à surveiller

- `BirthdateScreen.tsx` (autre agent) déclare ses références avec `useRef<TextInput>`. Pour `TextField.inputRef`, le type correct en React Native 0.88 est `TextInputInstance` (exporté par `react-native`). La vérification des types a échoué sur ce point à un moment ; elle passait à la fin du lot.
- L'avis du juriste reste nécessaire pour la formulation du badge (`00-audit.md`, point 5).
