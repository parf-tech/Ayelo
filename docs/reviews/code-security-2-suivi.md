# Suivi des constats de `code-security-2.md`

Date : 2026-11-06. Preuve : `backend/tests/Feature/SecurityHardeningRound2Test.php` (un test par constat corrigé) et la suite complète Pest sur PostgreSQL 16 (port 54330). Le résultat de la suite complète est reporté en bas de page.
Statuts : [x] corrigé (test cité) | [~] atténué ou décision requise | [ ] ouvert.

## Constats hauts

- [x] **N-01** panneau lié à `ADMIN_DOMAIN` (`AdminPanelProvider::adminDomain`), et `/admin`, `/livewire`, `/filament` répondent 404 sur le domaine de l'API dans le Caddyfile. Test : `N-01`. Reste à faire au déploiement : renseigner `ADMIN_DOMAIN` et la liste d'IP.
- [x] **N-02** un compte suspendu ou banni se reconnecte avec un jeton restreint, lit sa sanction et la conteste ; un compte supprimé ne le peut pas. Tests : `N-02` (2).

## Constats moyens

- [x] **N-03** limites par IP relevées (connexion 120 / 15 min, OAuth 120, inscription 60 / h, contrôle d'âge 100 / h) ; le compteur d'appareil reste strict.
- [x] **N-04** le refus d'âge lié à l'IP expire après 30 minutes ; le refus lié à l'appareil reste de 90 jours. Test : `N-04`.
- [x] **N-05** le secret 2FA est créé et affiché à la création du compte du personnel (`StaffCreateCommand`), donc plus d'enrôlement par le seul mot de passe.
- [x] **N-06** les échecs par e-mail sont comptés dans `LoginController`, pas dans le limiteur ; une connexion réussie remet le compteur à zéro. Tests : `N-06` (3).
- [~] **F-02 résiduel** changement d'IP et IPv6 : non traité. Demande une attestation d'appareil (spec 001 T012) ; risque accepté pour la bêta fermée, à confirmer par le propriétaire.
- [x] **F-08 résiduel** commande `billing:replay-unknown`, planifiée toutes les 15 minutes. Test : `F-08`.
- [~] **F-09 résiduel** suspension par deux comptes jetables : décision produit requise (voir `DECISIONS-PROPRIETAIRE.md`). Atténuation actuelle conservée (conversation commune ou second signaleur distinct, 3 signalements par jour).
- [x] **F-10 résiduel** `is_visible` pris en compte dans la liste des matchs. Test : `F-10`.

## Constats bas

- [x] **N-07** exemple de production : `SESSION_DRIVER=redis`, `SESSION_SECURE_COOKIE=true`, `SESSION_SAME_SITE=strict` (`infra/.env.prod.example`).
- [x] **N-08** l'e-mail saisi lors d'un échec de connexion du personnel est borné à 190 caractères et ignoré s'il n'est pas une chaîne (`StaffAuthAudit`).
- [~] **N-09** fait : e-mail du média masqué sans le droit `users.view`, `canViewForRecord` aligné sur `users.view` dans les trois relations. Reste : téléphone et score de risque pour le support, journalisation des aperçus d'images de message, séparation du droit selfie (non vérifié dans un vrai navigateur).
- [x] **N-10** mot de passe du personnel : 12 caractères minimum aussi via le profil (`EditStaffProfile`). Le mot de passe initial saisi à la création reste affiché en clair dans la console : non traité.
- [x] **N-11** `channels:` retiré de `bootstrap/app.php` (les canaux sont chargés par `routes/api/realtime.php`), `GET /` supprimé. Test : `N-11`.
- [ ] **N-12** double contrôle des actions administrateur : décision produit.
- [~] **N-13** fait : l'expiration automatique écrit `sanction.expired` (test dans `StaffCommandTest`). Reste : opérateur de la console (acteur nul), ordre de suppression du selfie avant commit (probabilité faible), obligation d'ouvrir le selfie avant d'approuver.
- [~] **N-14** fait : lecture bornée à `max_bytes + 1` octets (`Range` côté S3), plafond ramené à 20 Mpx. Tests : `N-14` (2). Reste : balayage des clés orphelines, mise à jour des bibliothèques d'images, traitement hors processus web.
- [x] **F-23** un message texte avec `media_id` est refusé. Test : `F-23`.
- [x] E-mail envoyé en tableau : plus de 500 (`login`, `password-forgot`). Test dédié.
- [ ] F-06, F-16, F-22 résiduels : lot suivant.

## Exigences S2 (limites de débit)

- [x] 429 testé pour `age-check`, `register`, `password-forgot` et `media-upload` (`S2`).

## Preuves d'exécution (condition G3)

- [x] Pest rejoué (voir résultat ci-dessous).
- [x] `composer audit` rejoué le 2026-11-06 : « No security vulnerability advisories found ».
- [x] `npm audit --omit=dev` mobile rejoué le 2026-11-06 : 22 vulnérabilités (1 basse, 21 modérées), aucune haute ni critique (outils de build transitifs ; le correctif proposé est un retour à Expo 52, refusé).
- [ ] `gitleaks` sur l'historique du commit final : non rejoué en local (binaire absent du poste, téléchargement non autorisé) ; le workflow CI `schema` le fait sur l'historique complet.
- [ ] Procès-verbal de restauration réel (S8).
- [ ] Troisième relecture ciblée N-01 / N-02 (S9).

## Hors code (propriétaire)

- [ ] Procédure aux autorités (T008), organisation et budget de la modération (T009), matrice juridique par marché, attestation d'appareil.

## Résultat de la suite complète

**260 tests, 1653 assertions, 0 échec** (Pest, PostgreSQL 16, PHP 8.5.12 avec `pdo_pgsql`, exécution du 2026-11-06). Sous Windows, les tests de signature RSA demandent `OPENSSL_CONF` vers un `openssl.cnf` existant.
