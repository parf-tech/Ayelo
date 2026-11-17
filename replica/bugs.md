# Bogues : passe `replica-test` (2026-11-17)

Build testé : `e4f6954` + corrections de cette passe. Environnement : aperçu local (Expo web, Chrome, 390 x 844 puis 320 x 568), API Laravel réelle, PostgreSQL jetable. Plan : `replica/test-plan.md`. Spécifications : `e2e/`.

Gravité : S1 perte de données, faille, paiement faux, flux principal bloqué ; S2 fonction cassée sans contournement ; S3 cassée avec contournement ou visiblement fausse ; S4 cosmétique. Ne figure ici que ce qui a été reproduit ; le reste est dans « À vérifier ».

Aucun S1 ni S2 ouvert.

### BUG-001 : session expirée ou révoquée, retour muet à l'accueil

- Severity: S3
- Flow / case: F01 / F01-N4
- Screen: accueil (S01)
- Build: `e4f6954`  Browser / device: Chrome, 390 pt, aperçu web

Steps
1. Se connecter avec le membre d'aperçu dans le navigateur.
2. Depuis l'API, ouvrir une autre session puis appeler `DELETE /api/v1/auth/sessions` (déconnexion partout) : le jeton du navigateur est révoqué.
3. Dans le navigateur, ouvrir l'onglet « Messages ».

Expected: retour à la connexion ou à l'accueil avec le message « Votre session a expiré. Reconnectez-vous. » (la chaîne `error.unauthorized` existe dans les traductions).
Actual: retour à l'accueil sans aucune explication ; la chaîne n'était affichée nulle part.
Evidence: `e2e/f01-auth.spec.ts` « F01-N4 », échec avant correction sur `getByText('Votre session a expiré. Reconnectez-vous.')` (élément absent) alors que l'accueil était bien affiché.
Suspected cause: `AuthProvider.expireSession` effaçait la session sans signaler la raison.
Status: fixed (commit de cette passe) : `mobile/src/auth/sessionNotice.ts`, bannière sur l'accueil, effacée par une connexion ; une déconnexion voulue n'affiche rien. Tests `mobile/__tests__/sessionExpired.test.tsx` (4) écrits avant la correction (rouge : module absent), puis verts ; relu dans le navigateur par `F01-N4`.

### BUG-002 : confidentialité, chaque interrupteur est déclaré deux fois (web)

- Severity: S3
- Flow / case: F08 / F08-H1 (audit axe transversal)
- Screen: Réglages, Confidentialité (aussi Notifications et Consentements, qui utilisent le même composant)
- Build: `e4f6954`  Browser / device: Chrome, 390 et 320 pt

Steps
1. Se connecter, Mon profil, Paramètres, Confidentialité.
2. Lancer un balayage axe (WCAG 2 A et AA).

Expected: aucune violation sérieuse ou critique ; un seul `role=switch` par interrupteur.
Actual: `aria-required-attr` (critique, 3 noeuds) et `nested-interactive` (sérieux, 3 noeuds) ; chaque interrupteur apparaît deux fois dans l'arbre d'accessibilité (un `div role=switch` sans `aria-checked` qui contient le champ natif `input role=switch`). Un test Playwright `getByRole('switch', { name })` résolvait 2 éléments.
Evidence: `e2e/a11y-largeur.spec.ts` (écrans connectés, 390 et 320 pt) et `e2e/f08-visibilite.spec.ts` avant correction.
Suspected cause: `SwitchRow` posait `accessibilityRole="switch"` et `accessibilityState` sur le composant `Switch`, que react-native-web transmet au conteneur en plus du champ natif.
Status: fixed (commit de cette passe) : rôle et état ne sont posés que hors web (`mobile/src/ui/SwitchRow.tsx`). Natif inchangé (test `webA11y.test.tsx`). Le rendu web n'est pas reproductible dans Jest : la preuve est l'audit axe réel (`e2e/a11y-largeur.spec.ts`).

### BUG-003 : accueil, la liste des engagements n'a pas d'éléments de liste (web)

- Severity: S3
- Flow / case: F01 / audit axe transversal
- Screen: accueil (S01)
- Build: `e4f6954`  Browser / device: Chrome, 390 et 320 pt

Steps
1. Ouvrir l'accueil non connecté.
2. Lancer un balayage axe.

Expected: aucune violation sérieuse ou critique.
Actual: `aria-required-children` (critique, 1 noeud) : `role=list` « Ce que propose Ayelo » dont les trois enfants n'ont pas le rôle `listitem`.
Evidence: `e2e/a11y-largeur.spec.ts` (écrans publics, 390 et 320 pt) avant correction.
Suspected cause: `WelcomeBenefits` déclarait `accessibilityRole="list"` sans rôle sur les engagements.
Status: fixed (commit de cette passe) : `role="listitem"` sur chaque engagement. Test `webA11y.test.tsx` (rouge avant, vert après) et audit axe réel.

## À vérifier (non reproduit comme défaut, ou décision de produit)

- **Refus d'âge et adresse IP partagée** : après un refus d'âge, l'inscription d'un majeur est refusée depuis la même adresse IP pendant 30 minutes (`AgeGate::IP_REFUSAL_MINUTES`). C'est voulu (contournement), mais derrière une adresse partagée (réseau mobile, foyer) un majeur peut être refusé à tort. Décision de produit à confirmer ; observé pendant la passe (un test de mineur a bloqué les inscriptions suivantes).
- **Carte suivante exposée comme bouton** : sur le web, la carte placée derrière la carte du dessus apparaît dans l'arbre d'accessibilité comme un bouton nommé (`swipe-card-next`, `accessible={false}` mais `accessibilityRole="button"` et libellé conservés). Sur appareil, un lecteur d'écran pourrait annoncer ses textes ; à contrôler avec VoiceOver et TalkBack. Piste : `accessibilityElementsHidden` et `importantForAccessibility="no-hide-descendants"` sur la carte non interactive.
- **Hiérarchie des titres** : plusieurs écrans (Paramètres, Filtres, fiche de profil, Mon profil) emploient le niveau 1 pour les titres de section (`heading level=1` partout). axe ne le signale pas en gravité sérieuse ; à revoir avec une vraie hiérarchie (niveau 2 pour les sections).
- **Export de données dans l'aperçu** : `POST /me/export` répond 500 dans l'aperçu local. Cause établie dans le journal : file synchrone et `PutObject` vers un stockage objet absent. En production la file est asynchrone ; non reproductible là, donc non classé en bogue. Le chemin 202 n'a pas été exécuté contre un vrai stockage (cas `F07-H2` en `fixme`).
- **F04 invitation vidéo** : aucune route ni écran. Fonction de la recon non implémentée ; décision de périmètre, pas un bogue.
- **Lenteur du serveur d'aperçu** : une fois sur la suite complète, la découverte a affiché « Vous êtes hors ligne » (délai de requête dépassé) sur `F06-H3` ; le test réussit seul (4 sur 4) et avait réussi à la première passe. Le serveur PHP intégré traite une requête à la fois (voir `docs/runbooks/apercu-local.md`). Non classé en bogue ; à surveiller sur un vrai serveur.
