# Revue indépendante, seconde passe : phase 0 (gate G1)

Relecteur : Independent Reviewer (seconde passe). Je n'ai écrit aucun des documents relus. Date : 2026-11-05.
Entrées : `reviews/phase0.md` (55 constats), `reviews/phase0-suivi.md`, `docs/00` à `15`, `docs/DECISIONS-PROPRIETAIRE.md` (DEC), `docs/adr/001-stack-evaluation.md` (ADR), `docs/schema/001_initial.sql`, `replica/features.csv`, `replica/recon.md`.
Aucun fichier existant n'a été modifié. Les scripts de test ajoutés sont dans une copie du harnais : `C:\Users\pc\AppData\Local\Temp\claude\5d6096a35e425d74\98f81393-ff33-43c9-8d0c-899c2331f0f2\scratchpad\pgtest2\` (`extra.mjs`, `extra2.mjs`). Le dossier `pgtest` d'origine n'a pas été touché.
Abréviations : numéros de fichier 00 à 15 = `docs/NN-*.md`.

## Synthèse

| gravité | nombre |
| --- | --- |
| Bloquant | 1 |
| Majeur | 9 |
| Mineur | 15 |
| Total | 25 |

Résultat en une phrase : les 4 bloquants de la première passe sont bien levés dans les documents, et les compteurs annoncés sont exacts. Mais 10 corrections marquées « traité » (MAJ-01, 02, 03, 12, 14, 19, 25, 30, MIN-01, MIN-04) sont absentes ou contredites en tout ou partie, et MAJ-15 (partiel) est faux, la spec du contrôle d'âge se contredit, le SQL a deux défauts fonctionnels que les 24 tests ne couvrent pas, et la condition « SQL exécuté sur PostgreSQL 16 natif » n'est pas remplie.

## 1. Vérification des corrections marquées « traité »

Légende : **OK** = correction présente et cohérente ; **PARTIEL** = présente mais un passage contredit encore ou manque ; **FAUX** = annoncée mais absente ou contredite dans le document nommé.

### Bloquants

| id | verdict | preuve (fichier + passage) |
| --- | --- | --- |
| BLQ-01 | OK avec résidus | 00 « Le périmètre de **lancement** est A + B + D » et « gate G6 (stores) et G7, après A, B et D » ; 15 « B9 **Déplacé** : la soumission aux stores se fait après la phase D (gate G6 = stores + appels) » et chemin critique `… A14 → (D0 en parallèle) → B1 → D1..D5 → G6 → G7` ; ADR décision 2 « Mise à jour du 2026-11-05 : le propriétaire a décidé d'inclure les appels au lancement » ; 14 « Les appels sont **inclus au lancement** » ; 03 FR-E-9, FR-E-10. Résidus : 13 G6, 14 §Appels puce 3, ADR points ouverts, DEC « Conséquences » (voir BIS-M08, BIS-m05, BIS-m06). |
| BLQ-02 | OK | `001_initial.sql` l.3-4 : « citext uniquement » et « La proximité (PostGIS) est hors de cette migration » ; aucune occurrence de `geography` ni de `gist` dans le SQL ; 14 « `postgres` : PostgreSQL 16 (image standard ; l'image `postgis/postgis` seulement quand la migration de proximité arrive, phase E) ». Exécution reproduite : `tables created: 36`, `tests: 24, echecs: 0`. Réserve : moteur PGlite = PostgreSQL **18.6** WASM, pas 16 (voir BIS-B01). |
| BLQ-03 | OK | Script : les 36 noms de tables du SQL figurent dans 08 et dans 09 ; aucun nom fantôme (`message_attachments`, `story_reactions`, `push_tokens` n'apparaissent que dans la phrase de 09 l.42 qui les nie). `notification_prefs` existe (SQL l.105) et `GET/PUT /me/notifications` y est adossée. Les colonnes citées en backticks dans 03/08/09/10/11/12 (`devices.push_token`, `devices.token_id`, `devices.voip_push_token`, `media.purge_after`, `story_views.reaction`, `gift_sends.idempotency_key`, `users.locale`, `purchases.transaction_id`, `webhook_events.id`, `preferences.seeking_genders`) existent toutes. |
| BLQ-04 | OK | 11 « Données personnelles » n°2 : « **Données sensibles (article 9 du RGPD) : il y en a** … `preferences.seeking_genders` révèle indirectement l'orientation sexuelle » ; SQL l.42-52 `user_consents` (kinds `terms, privacy, sensitive_data, location, marketing, verification_biometric`) ; 10 `POST /me/consents` ; 10 `POST /auth/register` « consentements ». Validation juridique restée ouverte, comme annoncé. |

### Majeurs marqués traités (23)

| id | verdict | preuve ou écart |
| --- | --- | --- |
| MAJ-01 | PARTIEL | 00 est réécrit en trois niveaux (« Établi par des sources lues (niveau C) », « Déclaré par des tiers (niveau T) », « Non établi »). 03 n'a pas changé ses colonnes « origine » (FR-F-1 reste H, FR-G-3 reste H) : seul un paragraphe final dit qu'elles sont « à jour par ce paragraphe ». 00 affirme « 4,0 sur l'App Store FR » : aucune note FR n'existe dans 02 (le seul « 4,0/5 » de 02 l.78 est le chiffre Google Play déclaré par le site). Voir BIS-m02. |
| MAJ-02 | PARTIEL | 01 corrigé (« l'original décrit une certification par photos ou courte vidéo, avec revue humaine ») ; `features.csv` ligne « Profils certifiés par pays » corrigée. Restent faux : `features.csv` l.25 `Badge profil vérifié … processus inconnu` ; `recon.md` l.164 « le processus de certification n'est pas documenté publiquement » ; 02 « Limites » n°3 « Les avis utilisateurs n'ont pas été étudiés » face à la section « Points faibles relevés dans les avis ». Le suivi parle de « 3 avis cités » : 02 ne cite aucun avis, date ni nombre. Voir BIS-M09. |
| MAJ-03 | FAUX en partie | OK : 00 « ADR 001 acceptée par le propriétaire », 15 P0-2 « acceptée », P0-4 « fait sauf Google Play », `features.csv` (stories, cadeaux, test de compatibilité, message direct, filtres avancés ajoutés). **Absent** : 08 l.3 « Dépend de `adr/001-stack-evaluation.md` (statut : proposé, à valider) » ; ADR « Points ouverts, à valider par le propriétaire » (l.55) avec les 4 points déjà décidés par DEC, et tableau « V1 (sans appels) / avec appels » (l.40) ; 06 l.73 « À valider avec le propriétaire : 2. Langues de lancement » alors que le suivi écrit « 06 : langues décidées ». Voir BIS-M08. |
| MAJ-04 | OK | 03 « FR-Z-1 … FR-Z-3 » ; SQL `users.locale text … check (locale in ('fr','en'))` ; 15 « A0 Internationalisation fr / en ». |
| MAJ-07 | OK | 08 §Temps réel : « push VoIP (PushKit) qui déclenche CallKit … envoyer ce push directement à APNs (jeton `devices.voip_push_token`), FCM et Expo Notifications ne le font pas » ; 15 D0 avec critères go/no-go et décision du propriétaire en cas de no-go ; 03 FR-E-10. |
| MAJ-08 | OK | 03 FR-B-9, FR-E-9 ; 08 §Médias étape 4 (240p, 360p, 480p) et « Mode économie de données ». La cible Android d'entrée de gamme « à ajouter à 13 » est honnêtement notée comme non faite. |
| MAJ-09 | OK | 15 « E3 **Singles à proximité** (FR-C-8, avec migration PostGIS …) » ; 03 addendum « FR-C-8 **Déplacé en phase E** ». La ligne d'origine FR-C-8 (phase D) reste dans le tableau C : voir BIS-m09. |
| MAJ-10 | OK | 09 §« Règle de concurrence des matchs » (verrou `pg_advisory_xact_lock`, test « exactement un »). Test d'intégration à écrire : noté tel quel. |
| MAJ-11 | OK avec écart | SQL `reports.reported_id … on delete restrict`, `sanctions.user_id … on delete restrict`, `banned_identifiers`, `conversations.hidden_by_a_at / hidden_by_b_at` ; test `restrict` présent dans `run.mjs`. Écarts : 03 « Conversation » liste encore `deleted_by_user` (l.136) ; la purge des médias liés à des messages échoue (BIS-M02). |
| MAJ-12 | PARTIEL | 11 compléments n°10 (ré-authentification adaptée, révocation Apple/TikTok, page web de suppression) ; 10 `DELETE /me` ; 03 FR-A-11. La « page web de suppression » n'existe que dans 11 : ni FR, ni écran, ni route, ni ligne dans 14. 05 S55 reste « confirmation par mot de passe ». Voir BIS-m14. |
| MAJ-13 | OK avec écart | 03 FR-I-10, FR-I-11 ; SQL `appeals` ; 10 `POST /appeals`, `GET /me/sanctions`, événement `sanction.created` ; 04 F20 « F11 signalement : accessible aussi depuis S21 ». 05 S58 « accès » n'a pas S21 (BIS-m10). |
| MAJ-14 | PARTIEL | 10 `POST /auth/age-check`, SQL `banned_identifiers.kind='age_refusal'`, 03 FR-I-12, 11 compléments n°6 existent. Mais le parcours principal contredit : voir BIS-M01. |
| MAJ-16 | OK | SQL `media.purge_after`, `user_consents.kind='verification_biometric'` ; 11 n°2 « suppression après la décision, pas de comparaison automatisée sans AIPD ». Écart de modélisation : BIS-m12. |
| MAJ-17 | OK avec écart | 10 §« Limites de débit (toutes les routes) » ; « attestation d'appareil (Play Integrity, App Attest) ». Incohérences de chiffres résiduelles : BIS-m07. |
| MAJ-18 | OK | 10 « Il n'y a **pas** de canal de présence global » et « `POST /broadcasting/auth` » ; 08 « Pas de canal de présence global : il permettrait d'énumérer les membres ». |
| MAJ-19 | PARTIEL | 08 §« Authentification et sessions » (expiration glissante, un jeton par appareil, `devices.token_id`) ; 10 `DELETE /auth/sessions` ; SQL `devices.token_id`. **03 FR-A-6 dit toujours « jeton d'accès court (Sanctum) »** : contradiction directe. Voir BIS-M05. |
| MAJ-20 | OK | 09 l.22 « publier la migration et utiliser `uuidMorphs` pour `tokenable` (test de migration obligatoire en CI) » ; « À faire plus tard » n°3. |
| MAJ-21 | OK | SQL `staff_users` (2FA, rôle) ; `users` n'a plus de colonne `role` ; `media.moderated_by`, `reports.reviewed_by` etc. pointent vers `staff_users` ; 11 compléments n°7 (matrice des droits). |
| MAJ-22 | OK | SQL `subscriptions.store in ('apple','google','promotional')`, `original_transaction_id` nullable, trois `check` de cohérence ; tests `Premium offert` et `abonnement store sans transaction refuse` passent. |
| MAJ-25 | PARTIEL | 08 : « PUT présignés courts (5 min) … ffmpeg dans un conteneur sans accès réseau » ; mais 10 `POST /media/upload-url` renvoie toujours « media_id, url, **champs** » (modèle POST). Voir BIS-m07. |
| MAJ-27 | OK | 11 Infrastructure n°1 (« Docker contourne `ufw` … chaîne `DOCKER-USER` … scan de ports »). |
| MAJ-30 | PARTIEL | 05 S61 à S67 ; 04 F15 à F20 ; 10 `POST /me/export`, `GET /me/export/{id}`. Écrans encore sans identifiant dans 04 : **S18, S34, S57** (S55 n'y figure que par son libellé). Voir BIS-m10. |
| MAJ-31 | OK | Les 7 tables citées existent dans le SQL : `user_consents`, `notification_prefs`, `banned_identifiers`, `support_tickets`, `data_exports`, `appeals`, `daily_counters`. |

### Mineurs marqués traités (9)

| id | verdict | preuve ou écart |
| --- | --- | --- |
| MIN-01 | PARTIEL | 12 « Premium 1 / 3 / 12 mois (l'original montre 1 et 3 mois en France) ». Mais 03 FR-G-1 « 1, 6 et 12 mois », 05 S30 « plans 1/6/12 mois » et 02 Limites n°4 « Les prix cités viennent de la fiche App Store US » (face à la section « Prix constatés en euros (App Store FR) ») n'ont pas suivi. Voir BIS-M04, BIS-m04. |
| MIN-04 | FAUX en partie | 01 « signalement en trois taps » et 03 note finale « Nombre de taps du signalement : **3** » ; mais 03 l.8 dit toujours « signalé en **deux taps** ». Voir BIS-m03. |
| MIN-05 | OK | SQL l.3 « citext uniquement », `text` + `check`, colonne `password`. |
| MIN-06 | OK | SQL `unique (conversation_id, sender_id, client_id)` + deux `check` ; tests `message doublon` et `meme client_id par l autre participant` passent. |
| MIN-07 | OK | SQL `media_photo_position_unique` (testé) ; commentaire d'upsert sur `devices.push_token`. Mais l'index rend le réordonnancement impossible : BIS-M03. |
| MIN-08 | OK avec écart | Déclencheur `audit_logs_append_only` (testé update et delete) ; 11 compléments n°8. `TRUNCATE` n'est pas bloqué (BIS-m12). |
| MIN-09 | OK | Déclencheur `profiles_lock_birthdate` (testé). |
| MIN-10 | OK | 08 l.67 « Les **lectures** transversales … passent par des requêtes ou vues en lecture dédiées ». |
| MIN-13 | OK | 11 compléments n°9. |

### Majeurs « partiels » : constat

MAJ-15 est annoncé « délais alignés (11) » : **faux** (BIS-M06). MAJ-23, MAJ-24, MAJ-28 : le caractère partiel annoncé est exact ; au passage, 08 l.71 dit encore « webhooks signés » alors que 10 et 12 disent « secret » (BIS-m11). MAJ-29 : encore plus ouvert que le suivi ne le dit (BIS-M07).

### Statuts « ouverts » : un cas à rectifier

MIN-02 est marqué « ouvert : "Inde, Caraïbes" dans 00 à retirer ». Cette mention **n'existe plus** dans 00 (ni ailleurs : `grep Inde|Cara` ne trouve rien). Le point est donc traité ; le suivi sous-déclare (BIS-m02).

## 2. Relecture du SQL (`schema/001_initial.sql`, 546 lignes)

**Exécution** : reproduite avec `node run.mjs` : `PostgreSQL 18.6 (PGlite 0.5.15)`, 36 tables, 24 tests, 0 échec. Les 24 tests de `run.mjs` couvrent : mineur refusé, date de naissance verrouillée, match canonique, ordre inverse, doublon, message doublon, `client_id` croisé, texte vide, idempotence crédits par utilisateur, webhook rejoué, audit append-only (update et delete), `restrict` sur utilisateur signalé, Premium promotionnel, abonnement de store sans transaction, unicité de position photo. Ils ne testent pas : suppression de média, réordonnancement, `TRUNCATE`, cascades de suppression de compte, aucun chemin Laravel.

**Syntaxe et ordre de création** : correcte. `staff_users` précède `media`, `verification_requests`, `subscriptions`, `credit_ledger`, `reports`, `sanctions`, `appeals`, `support_tickets`, `audit_logs` qui le référencent ; `users` précède tout le reste ; `matches` précède `conversations` ; `media` précède `messages`, `stories`, `video_invites`, `verification_requests` ; `reports` précède `sanctions` ; `sanctions` précède `appeals`. Les fonctions de déclencheur sont créées avant leur `create trigger`. Constructions compatibles PostgreSQL 16 (aucune syntaxe propre à 17 ou 18 repérée à la lecture ; non exécuté en 16).

**Cohérence avec 08, 09, 10** : noms de tables identiques (script). Routes de 10 adossées à une table ou colonne existante, y compris `PUT /me/privacy` (`profiles.is_visible, hide_distance, hide_last_seen`), `POST /conversations/{id}/hide` (`hidden_by_*`), `POST /stories/{id}/react` (`story_views.reaction`), `POST /gifts/send` (`gift_sends`), `GET /billing/transactions` (`purchases`). Exceptions : l'âge saisi à l'inscription n'a aucune colonne d'accueil avant la création du profil (BIS-M01) ; l'état « occupé » de FR-E-3 n'a pas de valeur dans `call_sessions.status` (BIS-m09).

**Défauts trouvés par exécution** (scripts `extra.mjs`, `extra2.mjs`) :

| essai | résultat |
| --- | --- |
| `delete from media where id = <média d'un message image>` | **ERREUR** `new row for relation "messages" violates check constraint "messages_check1"` |
| échange des positions de deux photos en un seul `update` | **ERREUR** `duplicate key value violates unique constraint "media_photo_position_unique"` |
| 7e photo `position = 6` | refusée (`media_position_check`) : comportement voulu |
| suppression d'un média selfie référencé par `verification_requests` | la ligne `verification_requests` est supprimée en cascade (0 ligne restante) |
| `truncate audit_logs` | **accepté** (le déclencheur est `for each row` seulement) |
| `daily_counters.kind = 'super_likes'` | refusé (kind absent, aucun quota de super-like défini) |
| utilisateur sans e-mail ni téléphone ni identité sociale | accepté (aucun `check`) |
| colonnes de clé étrangère sans index de support | 19 : `messages.media_id`, `stories.media_id`, `video_invites.media_id`, `verification_requests.selfie_media_id`, `conversations.match_id`, `conversations.initiated_by`, `gift_sends.gift_id`, `gift_sends.conversation_id`, `call_sessions.caller_id`, `appeals.user_id`, `sanctions.report_id`, et les références vers `staff_users` |

## 3. Recomptes par commande

| objet | commande | résultat | chiffre annoncé | verdict |
| --- | --- | --- | --- | --- |
| Écrans de 05 | `grep -c '^| S[0-9]' 05` | **49** ; A 29, B 9, C 6, D 4, E 1 | 05 « Totaux » : 49 (A 29, B 9, C 6, D 4, E 1) | exact |
| Routes de 10 | `grep -cE '^\| (GET\|POST\|PUT\|PATCH\|DELETE)' 10` | 73 lignes ; `GET/PUT /me/notifications` en vaut 2, donc 74 ; + webhook + `POST /broadcasting/auth` = **76** ; aucun doublon | 10 « Routes REST : 76 (74 listées …) » | exact |
| Tables du SQL | `grep -c '^create table'` | **36** ; 36 dans le tableau de 09 ; 36 dans le tableau de 08 ; 36 créées à l'exécution | 00, 08, 09, phase0-suivi : 36 | exact |
| Tests SQL | exécution de `run.mjs` | 24, 0 échec | 00, 09, suivi : 24 | exact |
| `features.csv` | `wc -l` | 46 lignes = 45 fonctions ; `must` 21, `should` 13, `could` 11 dont 4 `skip` (soit 7 `could` actifs) | aucun document de conception ne cite ce total ; `recon.md` « Must : 20, should : 10, could : 3, skip : 4 » | `recon.md` périmé (BIS-m01) |
| FR de 03 | script sur `\| FR-X-n \|` | 90 identifiants uniques (76 d'origine + 14 ajoutés) ; FR-C-8 apparaît deux fois | 03 : pas de total ; phase0.md disait 76 | voir BIS-M07 |
| Décompte du suivi | `grep` des statuts par id | bloquants 4/0/0 ; majeurs traité 23, partiel 5, ouvert 3 (=31) ; mineurs traité 9, partiel 2, ouvert 9 (=20) | tableau « Décompte » du suivi | **arithmétique exacte** ; mais le contenu est inexact pour MAJ-03, MAJ-15, MIN-01, MIN-04 (faussement « traité ») et MIN-02 (faussement « ouvert ») |
| `recon.md` | lecture | 20 écrans, 8 flux ; « entités 12 » (13 décrites) | `recon.md` « Size » | MIN-03 correctement ouvert |

## 4. Constats, triés par gravité

### Bloquant

| id | gravité | fichier | problème | preuve | correction |
| --- | --- | --- | --- | --- | --- |
| BIS-B01 | bloquant | 09, suivi, 00 | Condition d'entrée de G1 non remplie : le SQL n'a jamais été exécuté sur PostgreSQL 16 natif ni avec la migration Laravel (Sanctum `uuidMorphs`). Le seul moteur utilisé est PGlite (PostgreSQL 18.6 compilé en WASM). Le suivi le reconnaît lui-même, mais G1 ne peut pas être déclaré avec cette condition ouverte, d'autant que deux défauts SQL ont échappé aux 24 tests (BIS-M02, BIS-M03). | 09 « Moteur utilisé : PGlite 0.5.15 (PostgreSQL 18.6 …), pas PostgreSQL 16 natif » ; « À refaire : exécution sur PostgreSQL 16 natif en CI … avant le gate G1 définitif » ; suivi « Pour franchir G1 » n°2 ; phase0.md « Conditions » n°2. Reproduit : `node run.mjs` affiche `PostgreSQL 18.6`. Aucun `psql`, `postgres` ni `docker` sur le poste de relecture. | Ajouter un job CI avec `postgres:16`, exécuter `001_initial.sql` puis les tests (`run.mjs` converti en Pest ou SQL), et ajouter les cas de BIS-M02 et BIS-M03. Joindre la sortie à 09. |

### Majeurs

| id | gravité | fichier | problème | preuve | correction |
| --- | --- | --- | --- | --- | --- |
| BIS-M01 | majeur | 04, 05, 10, 09 | Le contrôle d'âge est spécifié de trois façons incompatibles. (a) F01 et 05 placent la naissance (S04) **après** la création du compte (S02) et la vérification e-mail (S03), alors que FR-I-12, 11 n°6 et F17 exigent le contrôle **avant**. (b) F17 enchaîne `S01 -> S63 -> S04` sans passer par S02 : le moment de création du compte n'est plus défini. (c) `POST /auth/oauth/{provider}` ne reçoit ni date de naissance, ni preuve de contrôle d'âge, ni consentement : un compte Google/Apple/TikTok se crée sans contrôle. (d) `POST /auth/age-check` répond `204` sans jeton, et `POST /auth/register` redemande la date : rien ne relie la date contrôlée à la date finalement stockée dans `profiles.birthdate` (saisie plus tard par `PUT /me/profile`) ; `users` n'a pas de colonne de naissance. Un mineur peut refuser, puis recommencer avec une autre date sur un autre chemin. | 04 F01 `S01 Accueil -> S02 Inscription … -> S03 Vérif. email -> S04 Profil de base` ; 04 F17 `S01 -> S63 (consentements) -> S04 (date de naissance) -> si < 18 ans : S64` ; 05 S04 accès « onboarding », contenu « nom, naissance, genre … » ; 10 `POST /auth/oauth/{provider}` entrée « code ou jeton d'identité » ; 10 `POST /auth/age-check` sortie « 204 ou 403 » ; SQL : `birthdate` seulement dans `profiles`. | Une seule séquence : S01, S63, saisie de la date, `age-check` qui renvoie un jeton signé court, puis S02 (e-mail ou OAuth) qui exige ce jeton ; le serveur stocke la date au compte (colonne ou table liée) et refuse toute date différente ensuite. Mettre à jour F01, 05 (S02, S04), 10 (register et oauth), 09 et ajouter un test (refus puis nouvelle tentative, chemin OAuth). |
| BIS-M02 | majeur | SQL, 09, 10 | Impossible de supprimer un média rattaché à un message image, vidéo ou vocal : la clé étrangère `media_id … on delete set null` met `media_id` à NULL, ce qui viole `check (type not in ('image','video','voice') or media_id is not null or deleted_at is not null)`. Touche `DELETE /media/{id}`, la purge du selfie (`purge_after`), la purge des médias à l'anonymisation d'un compte et le nettoyage des objets orphelins. | SQL l.256 et l.264. Exécution (`extra.mjs`) : `delete from media where id=…` → `new row for relation "messages" violates check constraint "messages_check1"`. | Ne jamais supprimer la ligne `media` : passer `status='purged'` et supprimer l'objet R2 ; ou remplacer par un déclencheur qui pose `messages.deleted_at` avant la suppression ; ou assouplir le `check` (`or media_id is null`). Ajouter le test. |
| BIS-M03 | majeur | SQL, 03, 10 | `PUT /me/media/order` (FR-B-3 « ordre modifiable ») est impossible sur le schéma : l'index unique partiel `(user_id, position)` n'est pas différable, et `position` est borné à 0..5 et `not null`. Avec 6 photos, aucune position libre ne permet un échange ; même un échange de deux photos échoue dans un seul `update`. | SQL l.167 `check (position between 0 and 5)` et l.176-177 `create unique index media_photo_position_unique …`. Exécution (`extra2.mjs`) : `update media set position = 1 - position …` → `duplicate key value violates unique constraint "media_photo_position_unique"`. | Élargir temporairement la borne (0..11) et réordonner en deux `update` dans une transaction (décalage de +6 puis position finale), ou contrainte d'exclusion différable (extension `btree_gist`), ou stocker l'ordre dans un tableau `uuid[]` sur `profiles`. Ajouter le test. |
| BIS-M04 | majeur | 03, 05, 15, 09 vs DEC E4 | DEC (qui « priment ») fixe « un seul abonnement Premium (1 / 3 / 12 mois) et un pack de crédits conversation ». 12 s'est aligné, mais 03 FR-G-1 dit encore « 1, 6 et 12 mois » et 05 S30 « plans 1/6/12 mois » ; 03 FR-G-2 et 15 B1 (`FR-G-1,2,4..7`) gardent le pack « Propositions » que 12 retire du lancement tant qu'il n'est pas spécifié ; le SQL garde `credit_type 'proposal'` et `reason 'spend_proposal'`. Un développeur lisant 03 ou 05 construit le mauvais catalogue. | DEC E4 ; 12 « Premium 1 / 3 / 12 mois (l'original montre 1 et 3 mois en France) » et « Pack Propositions … retiré du lancement » ; 03 l.95-96 ; 05 l.33 ; 15 B1. | Aligner 03 FR-G-1 et 05 S30 sur 1/3/12 ; scinder FR-G-2 en « Conversation » (B) et « Propositions » (non planifié) ; retirer `FR-G-2` de B1 ou le restreindre au pack Conversation. |
| BIS-M05 | majeur | 03, 08, 11 | Le modèle de session se contredit. 03 FR-A-6 exige un « jeton d'accès court (Sanctum) » ; 08 retient un jeton Sanctum à **expiration glissante de 30 jours** sans paire access/refresh ; 11 dit « durée limitée … rotation à la connexion ». Les trois ne peuvent pas être tous vrais et l'ADR 006 n'est pas écrite. Le critère de test dépend de la réponse. | 03 l.20 ; 08 l.113 « Pas de paire access/refresh écrite à la main en V1 » ; 11 Authentification n°3. | Réécrire FR-A-6 selon 08 (ou l'inverse) et écrire l'ADR 006 avant G1 ; harmoniser aussi la limite de connexion (BIS-m07). |
| BIS-M06 | majeur | 11 | MAJ-15 est annoncé « délais alignés (11) » : faux. 11 contient deux délais différents pour le même cas critique (mineur suspecté) : « revue sous 24 h » (§Protection des mineurs n°2) et « 2 h pour un mineur suspecté » (§Contenu et modération n°5 et complément n°1, qui prétend « un seul délai par catégorie dans tous les documents »). | 11 l.47 « suspension préventive du compte signalé, revue sous 24 h » ; l.56 « 24 h pour un signalement standard, 2 h pour un mineur suspecté ou une menace » ; l.87. | Remplacer « 24 h » par « 2 h » en l.47 ; ajouter un test S6 sur le délai. |
| BIS-M07 | majeur | 15, 03, 05 | Le backlog ne couvre pas les exigences de 03 et garde des erreurs relevées en MAJ-29. Identifiants de 03 sans épopée explicite : FR-D-5, FR-D-10, FR-D-11, FR-Z-1..3, FR-A-10, FR-A-11, FR-B-9, FR-C-9 (doublon de FR-C-7), FR-E-1, E-2, E-4, E-7, E-10. Erreurs restantes : A5 (S01-S07, parcours « jusqu'à la première découverte ») ne dépend pas de A6-A8 ; A3 « FR-A-1..9 » englobe FR-A-4 (phase B, aussi B5) ; A11 « FR-I » englobe FR-I-3, I-4, I-6 (phase B) ; FR-I-5 est phase A dans 03 et dans B4 de 15 ; A13 « S50–S60 » englobe S56 (phase B) ; A17 (phase A) inclut « saisie du code SMS » (S62, phase B, et FR-A-4 phase B) alors que FR-A-10 est phase A. Les épopées A0, A16, A17, B10 n'ont ni dépendance, ni taille, ni preuve de fin (exigence de l'en-tête de 15). Le chemin critique omet A15 (staging, G5), A0, A16, A17, et A14 ne dépend que de A1–A13. Aucune matrice FR → épopée → test (promise par 13). | Script `/tmp/fr.mjs` ; 15 lignes A3, A5, A11, A13, A17 ; 03 l.20-28 (FR-A-4 « B »), FR-I-5 « A » ; 05 S56 et S62 « B ». | Produire la matrice FR → épopée → écran → test (en annexe de 15) ; corriger les plages ; ajouter les champs manquants aux épopées A0, A16, A17, B10 ; compléter le chemin critique. Condition du premier rapport : traiter ou accepter par écrit. |
| BIS-M08 | majeur | 08, ADR, 06, 14 | MAJ-03 est marqué « traité (00, 08, 15, ADR, features.csv) ; 06 : langues décidées ». Quatre documents ont encore des statuts périmés ou contradictoires : 08 l.3 « statut : proposé, à valider » (alors que son tableau ADR dit « 001 accepté ») ; ADR « Points ouverts, à valider par le propriétaire » (budget, LiveKit Cloud, comptes, pays et langues : tous décidés par DEC) et tableau de dimensionnement « V1 (sans appels) » ; 06 « À valider : 2. Langues de lancement » ; 14 §Appels puce 3 « Décision à prendre via ADR 004 après un test de coût sur le trafic réel » face à la puce 1 qui dit que ce test « n'est pas possible avant le lancement » (le défaut relevé en MAJ-06), et 14 §Environnements « staging : petit VPS ou **même VPS** » face au complément « pas sur le VPS de production ». | 08 l.3 ; ADR l.40 et l.55-59 ; 06 l.73 ; 14 l.10 et l.36. | Passer la revue de statuts annoncée : fermer les points ouverts de l'ADR, mettre à jour 08, 06, 14, corriger la puce 3 de 14. |
| BIS-M09 | majeur | 02, features.csv, recon.md | Contradictions sur l'original persistantes (MAJ-02 déclaré traité). La certification est « confirmée » dans 02 et 01, mais `features.csv` l.25 garde « processus inconnu » et `recon.md` l.164 « le processus … n'est pas documenté publiquement ». 02 « Limites » n°3 nie l'étude des avis alors que la section « Points faibles relevés dans les avis » en tire trois conclusions sans citer d'avis, de date ni de nombre. 02 « À faire en priorité : lire les sources 2, 3 et 4 » est périmé (2 et 4 lues). 02 Limites n°4 « prix … fiche App Store US » contredit la section « Prix constatés en euros (App Store FR) ». | Passages cités. | Aligner les quatre passages ; sourcer les trois avis (date, nombre) ou retirer la section ; réécrire les Limites n°3 et n°4. |

### Mineurs

| id | gravité | fichier | problème | preuve | correction |
| --- | --- | --- | --- | --- | --- |
| BIS-m01 | mineur | recon.md, features.csv | La matrice de `recon.md` n'a pas suivi l'ajout de 8 lignes à `features.csv` : annoncée 20 / 10 / 3 / 4, elle est maintenant 21 / 13 / 7 / 4. `features.csv` contient aussi deux lignes quasi doublons (« Appel vidéo dans l'app » et « Appels voix et vidéo depuis le chat », toutes deux `must`). | `awk` sur la colonne 3 : must 21, should 13, could 11 (dont 4 skip) ; `recon.md` « Voir `features.csv`. Must : 20, should : 10, could : 3, skip : 4 ». | Mettre à jour `recon.md` (ou retirer le chiffre) et fusionner les lignes d'appel. |
| BIS-m02 | mineur | suivi, 00 | (a) MIN-02 est « ouvert » alors que « Inde, Caraïbes » a disparu de 00 : le suivi sous-déclare. (b) 00 affirme « 4,0 sur l'App Store FR » : aucune note FR n'est dans 02 (le « 4,0/5 » de 02 l.78 vient du site pour Google Play). | `grep -n "Inde\|Cara"` : aucune occurrence ; 02 l.19 et l.78. | Passer MIN-02 à « traité » (décompte : mineurs traités 10, ouverts 8) ; corriger ou sourcer la note FR dans 00. |
| BIS-m03 | mineur | 03 | MIN-04 « traité » : la règle transverse dit encore « signalé en deux taps » face à « 3 » partout ailleurs. | 03 l.8 ; 01 l.16 ; 03 note finale ; 04 F11. | Remplacer par « trois taps ». |
| BIS-m04 | mineur | 02 | « À faire en priorité » et Limites n°4 périmés (déjà couverts dans BIS-M09 pour la partie preuve ; ici le prix US/FR). Distinct de BIS-M04 qui concerne 03 et 05. | 02 l.34 et l.114. | Voir BIS-M09. |
| BIS-m05 | mineur | 13 | La table des gates garde « G6 : conformité stores … build soumis » sans les appels. 15 et 00 définissent G6 comme « stores + appels » ; 13 est le document qui définit les gates. | 13 l.85 ; 15 §Gate de lancement. | Reformuler G6 dans 13 et ajouter le parcours 9 (appel) comme preuve de G6. |
| BIS-m06 | mineur | DEC | La section « Conséquences sur le backlog » dit « Phase C … à arbitrer » alors que la décision E3 (même fichier) la place après le lancement et que 00, 05 et 15 l'appliquent. Elle dit aussi « Phase D … commence après A et B » alors que D0 démarre dès A14 et que D1..D5 suivent B1 seulement. | DEC l.66 vs E3 ; 15 chemin critique. | Mettre cette section en cohérence avec E3 et 15. |
| BIS-m07 | mineur | 10, 03, 11 | Incohérences internes de 10 : (a) ligne `POST /me/consents` décalée (« kind, version, granted » dans la colonne « limite », « 204 » dans « entrée ») ; (b) inscription « 5/h/IP » dans le tableau et « 5/h par appareil, 20/h par IP » dans la table des limites ; (c) `POST /media/upload-url` renvoie « url, champs » (POST) alors que 08 impose des PUT présignés ; (d) limite de connexion en trois variantes : 03 FR-A-9 « par IP/email », 11 « (IP, email) », 10 « (email, appareil) ». | 10 l.35, l.21, l.49, l.62 ; 03 l.28 ; 11 Authentification n°4. | Corriger la ligne, choisir un seul critère de limite, remplacer « champs » par « url, en-têtes requis ». |
| BIS-m08 | mineur | 14, 08 | `ffmpeg` « inclus dans l'image `worker` » (14 l.24) est incompatible avec le conteneur « sans réseau » exigé (14 l.109, 08) : le worker doit joindre R2, Redis et PostgreSQL. | 14 l.24 et l.109 ; 08 §Médias. | Prévoir un service `transcode` séparé, sans réseau, et lui passer les fichiers par volume. |
| BIS-m09 | mineur | 10, 03, SQL | (a) `POST /calls` : « participant » ; la règle « appels pour les matchs uniquement » (DEC E2, FR-E-9) n'est pas dans la route et `conversations.match_id` est nullable. (b) FR-E-3 prévoit l'état « occupé » : `call_sessions.status` n'a pas cette valeur. (c) 03 : FR-C-8 deux fois (phase D et E), FR-C-7 et FR-C-9 identiques, état `deleted_by_user` au lieu de `hidden_by_*`, état de média sans `purged`, colonnes « origine » H pour FR-F-1 et FR-G-3 alors que 02 dit C. | 10 l.106 ; 03 l.49, l.48, l.173, l.136 ; SQL l.275-276. | Ajouter la règle à `POST /calls` (403 si la conversation n'est pas issue d'un match) et la valeur `busy` ; nettoyer 03. |
| BIS-m10 | mineur | 04, 05 | Écrans de 05 sans identifiant dans 04 : S18, S34, S57 (et S55 seulement par son libellé). S58 n'a pas S21 dans « accès » alors que 11 n°4 et F20 l'exigent. 05 S55 et 04 F13 disent toujours « confirmer mot de passe » (déjà corrigé dans F20 et 10). | Boucle sur les identifiants de 05 contre 04 ; 05 l.45 et l.48. | Ajouter S18 à F06, S34 à F09, S57 à F01/F13 ; compléter « accès » de S58 ; réécrire S55. |
| BIS-m11 | mineur | 08, 12 | 08 l.71 « webhooks signés » alors que 10 et 12 disent « en-tête secret » ; 08 l.80 « Reverb (canaux privés et de présence) » alors que 10 supprime tout canal de présence global ; 12 attribue au Premium le « message avant match (FR-D-11) » alors que 03 FR-D-11 est un crédit « Conversation ». | 08 l.71, l.80 ; 12 l.17 ; 03 FR-D-11. | Aligner les formulations et trancher : message avant match = Premium ou crédit. |
| BIS-m12 | mineur | SQL | (a) Purger le média selfie par suppression de ligne supprime en cascade `verification_requests`, donc le résultat que 09 promet de conserver. (b) `truncate audit_logs` passe, le journal « append-only » ne l'est pas contre un propriétaire de table. (c) `password_reset` existe dans `verification_codes.channel` **et** `password_reset_tokens` de Laravel (09 l.40). | Exécution `extra.mjs` ; 09 l.40 et l.53. | Garder la ligne et passer `media.status='purged'` ; ajouter un déclencheur `before truncate` ; choisir un seul mécanisme de réinitialisation. |
| BIS-m13 | mineur | SQL | 19 colonnes de clé étrangère sans index (liste en §2), dont `messages.media_id` : chaque suppression de média parcourt `messages` ; absence de quota de super-like dans `daily_counters.kind` ; aucun `check` empêchant un `users` sans identifiant de connexion. | Requête sur `pg_constraint`/`pg_index` dans `extra2.mjs`. | Ajouter les index sur `media_id` (partiels `where media_id is not null`) et sur `conversations.match_id` ; décider du quota de super-like. |
| BIS-m14 | mineur | 11, 14, 05, 10 | La « page web de demande de suppression » (exigence des stores, à vérifier) n'est qu'une phrase de 11 : le suivi la cite comme faite en « 11, 10, 03 ». Aucun FR, écran web, route ni ligne de la liste de contrôle de 14 ne la porte. | 11 compléments n°10 ; 14 §Publication « Suppression de compte : accessible dans l'app ». | Ajouter une ligne FR (A) et une ligne à la liste G6 de 14, avec la route ou la page. |
| BIS-m15 | mineur | 14 | Plusieurs points de 14 restent ouverts mais sont présentés comme traités : staging sur le même VPS (BIS-M08) et ligne « Pistes : TestFlight / test interne Google Play avant production » qui ignore le test fermé ajouté plus bas. | 14 l.10 et §Publication, ligne « Pistes ». | Mettre la ligne « Pistes » en cohérence avec le complément. |

## 5. Nouvelles incohérences introduites par les corrections (réponse au point 4)

| thème | constat | id |
| --- | --- | --- |
| Phases | A17 (phase A) inclut S62 (phase B) ; FR-A-10 (phase A) inclut « saisie du code SMS » alors que FR-A-4 est phase B ; FR-C-8 listé en D et E ; A16 inclut « support » (S56 phase B) | BIS-M07, BIS-m09 |
| G6 | 00, 15, DEC, 14 : « stores + appels » ; 13 : stores seulement | BIS-m05 |
| S61-S67 vs flux | F01 non mise à jour (compte avant naissance) ; F17 saute S02 ; OAuth sans contrôle d'âge ; S62 apparaît dans F16 (phase B) et A17 (phase A) | BIS-M01, BIS-M07 |
| FR de 03 vs 15 | 14 FR ajoutés à 03 : 6 sans épopée (FR-Z-1..3, FR-A-10, FR-A-11, FR-B-9, FR-C-9, FR-E-10) ; épopées ajoutées sans identifiants de FR | BIS-M07 |
| DEC vs 00/15 | 00 et 15 suivent DEC D1 à D7 et E1 à E5, sauf : 03 FR-G-1 (1/6/12) et FR-G-2 (Propositions) contre E4 ; DEC « Conséquences » contre E3 | BIS-M04, BIS-m06 |
| Chiffres | Tous les compteurs annoncés sont exacts (§3) ; seul `recon.md` est périmé | BIS-m01 |

## 6. Verdict

**Gate G1 (conception : specs, schéma, API cohérents et relus, aucun point bloquant) : NON franchi.**

Pourquoi :
1. **Un bloquant subsiste** (BIS-B01) : la condition d'entrée « SQL exécuté sur PostgreSQL 16 natif, migration Laravel en CI, sortie jointe » est ouverte, et deux défauts fonctionnels du SQL (BIS-M02, BIS-M03) n'ont été trouvés que parce que j'ai ajouté des tests : la suite actuelle ne protège pas ces cas.
2. **Les conditions n°3 du premier rapport** (traiter ou accepter par écrit les majeurs touchant 03, 09, 10) ne sont pas remplies : le contrôle d'âge est contradictoire entre 04, 05 et 10 (BIS-M01), 03 contredit DEC sur le catalogue payant (BIS-M04) et sur les sessions (BIS-M05), et la couverture FR → épopée reste incomplète (BIS-M07). Aucune acceptation écrite avec responsable et échéance n'existe pour MAJ-05, 06, 15, 26 (le suivi la réclame lui-même).
3. **Le suivi n'est pas fiable sur 11 lignes** : MAJ-03, MIN-01, MIN-04 (et MAJ-15 « délais alignés ») sont déclarés corrigés alors que le document nommé contredit encore la correction ; MAJ-01, 02, 12, 14, 19, 25, 30 sont corrigés en partie seulement ; MIN-02 est déclaré « ouvert » alors qu'il est corrigé.

Ce qui est acquis : BLQ-01 à BLQ-04 sont levés dans les documents ; le SQL s'exécute (36 tables, 24 tests) ; les noms de tables et de colonnes de 08, 09 et 10 sont cohérents avec le SQL ; tous les compteurs (49 écrans, 76 routes, 36 tables, 24 tests, décompte du suivi) sont exacts.

Conditions pour franchir G1 (troisième passe, limitée à ces points) :
1. Exécuter le SQL corrigé sur PostgreSQL 16 natif en CI avec les tests de `run.mjs` plus ceux de BIS-M02 et BIS-M03, et joindre la sortie (BIS-B01).
2. Corriger BIS-M01 (séquence d'âge unique, jeton d'`age-check`, chemin OAuth), BIS-M04, BIS-M05, BIS-M06, BIS-M08 et BIS-M09.
3. Livrer la matrice FR → épopée → test et compléter A0/A16/A17/B10 (BIS-M07), ou accepter le reste par écrit avec responsable et échéance.
4. Rectifier le suivi (statuts de MAJ-02, 03, 12, 15 ; MIN-01, 02, 04) et son décompte.
5. Les mineurs BIS-m01 à BIS-m15 peuvent être traités après G1 avec échéance dans 15, sauf BIS-m05 et BIS-m14 qui touchent G6.
