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
- [ ] **N-09** minimisation (e-mail visible du modérateur, aperçus non journalisés) : lot suivant.
- [x] **N-10** mot de passe du personnel : 12 caractères minimum aussi via le profil (`EditStaffProfile`). Le mot de passe initial saisi à la création reste affiché en clair dans la console : non traité.
- [ ] **N-11** route `broadcasting/auth` dupliquée hors middlewares et `GET /` : lot suivant.
- [ ] **N-12** double contrôle des actions administrateur : décision produit.
- [ ] **N-13** traces incomplètes (expiration, console, ordre de suppression du selfie) : lot suivant.
- [ ] **N-14** médias : lecture non bornée, plafond de 40 Mpx, orphelins : lot suivant.
- [x] **F-23** un message texte avec `media_id` est refusé. Test : `F-23`.
- [x] E-mail envoyé en tableau : plus de 500 (`login`, `password-forgot`). Test dédié.
- [ ] F-06, F-16, F-22 résiduels : lot suivant.

## Exigences S2 (limites de débit)

- [x] 429 testé pour `age-check`, `register`, `password-forgot` et `media-upload` (`S2`).

## Preuves d'exécution (condition G3)

- [x] Pest rejoué (voir résultat ci-dessous).
- [ ] `composer audit` rejoué (la CI le fait déjà ; journal à joindre).
- [ ] `npm audit` mobile rejoué.
- [ ] `gitleaks` sur l'historique du commit final.
- [ ] Procès-verbal de restauration réel (S8).
- [ ] Troisième relecture ciblée N-01 / N-02 (S9).

## Hors code (propriétaire)

- [ ] Procédure aux autorités (T008), organisation et budget de la modération (T009), matrice juridique par marché, attestation d'appareil.

## Résultat de la suite complète

**257 tests, 1646 assertions, 0 échec** (Pest, PostgreSQL 16, PHP 8.5.12 avec `pdo_pgsql`, exécution du 2026-11-06). Sous Windows, les tests de signature RSA demandent `OPENSSL_CONF` vers un `openssl.cnf` existant.
