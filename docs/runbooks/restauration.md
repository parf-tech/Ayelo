# Procédure : restauration de la base de données

**Statut** : exécutée pour la première fois le 2026-11-25 (réussie avec réserves, voir « Exercices réalisés » en fin de document). Le gate G5 exige une restauration réelle, chronométrée, sur une base vierge, avant le lancement.

**Rien n'a été exécuté, ni les sauvegardes, ni les restaurations, ni les scripts** : le poste de développement n'a ni Docker, ni `pg_dump`, ni `pg_restore`, ni `shellcheck`. Seule la syntaxe bash (`bash -n`) et les refus d'arguments de `restore.sh` (nom de base protégé ou invalide) ont été essayés. Le service `backup` du compose n'a jamais démarré.

## Sauvegarde automatique (écrite, non exécutée)
- **Scripts** : `infra/scripts/backup.sh` (pg_dump au format custom, horodaté `<base>_AAAAMMJJTHHMMSSZ.dump`, relecture de l'archive, fichier `.sha256`, rétention quotidienne + mensuelle, local et bucket, envoi facultatif au bucket par `aws s3 cp --endpoint-url`, code de sortie non nul au moindre échec) et `infra/scripts/restore.sh` (voir plus bas). L'ancien dossier `infra/backup/` (cron, SQL en clair compressé) est **supprimé** (remplacé par `infra/scripts/`) et n'est plus lancé par le compose.
- **Service** : `backup` dans `infra/docker-compose.prod.yml`, image construite depuis `infra/scripts/Dockerfile` (`postgres:16-bookworm` + `awscli` + `gnupg`), réseau `internal` seulement, **aucun port publié**, une sauvegarde par jour à `BACKUP_TIME_UTC` (défaut 02:15 UTC). Les secrets arrivent par les variables d'environnement lues dans `infra/.env.prod` ; le service ne reçoit pas le reste de ce fichier ; rien n'est copié dans l'image.
- **Variables** : `DB_*` (obligatoires), `BACKUP_BUCKET`, `BACKUP_ENDPOINT`, `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY` (envoi ; si `BACKUP_BUCKET` est vide, la copie reste sur le volume `backups`, donc **sur le même serveur**), `BACKUP_RETENTION_DAYS` (défaut 14), `BACKUP_MONTHLY_RETENTION_MONTHS` (défaut 6), `BACKUP_ALERT_WEBHOOK_URL` (vide = pas d'alerte), `BACKUP_TIME_UTC`, `BACKUP_GPG_RECIPIENT` (chiffrement facultatif). Toutes figurent dans `infra/.env.prod.example`. `BACKUP_CRON` n'est plus lu (le planificateur est une boucle d'attente).
- **Rétention** (`infra/scripts/retention.sh`, même règle pour le volume local et pour le bucket) : une archive est gardée si elle a moins de `BACKUP_RETENTION_DAYS` jours (date lue dans le **nom** du fichier), ou si c'est la **première archive de son mois** et que ce mois est le mois courant ou l'un des `BACKUP_MONTHLY_RETENTION_MONTHS` précédents (0 = pas de mensuelle). Le `.sha256` suit son archive. Les fichiers au nom inattendu ne sont jamais touchés. Garde-fou : si la règle supprimerait presque tout (horloge déréglée), rien n'est supprimé. Dans le bucket, la clé d'envoi n'a idéalement pas le droit de supprimer : la suppression échoue alors avec un avertissement, et une règle de cycle de vie du bucket doit prendre le relais (à configurer). Essai : `bash infra/scripts/tests/retention_test.sh` (faux fichiers, sans PostgreSQL ni réseau).
- **Alerte d'échec** : à tout échec, si `BACKUP_ALERT_WEBHOOK_URL` est renseignée, `backup.sh` envoie un `POST` JSON `{"host","timestamp","step"}` (nom d'hôte, heure UTC, étape en échec ; ni secret, ni chemin, ni message d'erreur). L'URL passe par l'entrée standard de `curl` (absente des processus et des journaux) ; elle doit commencer par `http://` ou `https://`. Un échec de l'alerte est journalisé et ne change jamais le code de sortie d'origine. Témoins dans le volume : `/backups/.last_success` (écrit en fin de sauvegarde complète) et `/backups/.last_failure` (étape, effacé au succès suivant).
- **Sonde de santé** : le conteneur `backup` devient `unhealthy` si `/backups/.last_success` a plus de 36 h (premier jour exclu). Seules les alertes (webhook, e-mail) préviennent quelqu'un : surveiller aussi l'état du conteneur (`docker compose ps`).
- **Limites connues** :
  - Rétention du bucket : appliquée par le script seulement si la clé a le droit de supprimer ; sinon règle de cycle de vie du bucket, **non configurée**. Vérifier que la durée annoncée dans `docs/legal/` (14 jours + mensuelles) correspond à `BACKUP_MONTHLY_RETENTION_MONTHS`.
  - Chiffrement : sans `BACKUP_GPG_RECIPIENT` et sans clé publique importée dans l'image (`BACKUP_GPG_PUBLIC_KEY_FILE`, non câblé dans le compose), les archives sont en clair sur le volume et dans le bucket (chiffrement au repos du fournisseur seulement). À décider par le propriétaire ; les archives contiennent toutes les données personnelles.
  - Alerte : sans `BACKUP_ALERT_EMAIL` ni `BACKUP_ALERT_WEBHOOK_URL`, rien ne prévient personne (la sonde seule passe en `unhealthy`) ; une panne totale du conteneur ou de la boucle n'envoie pas d'alerte. E-mail : renseigner `BACKUP_ALERT_EMAIL` dans `infra/.env.prod`, déployer, puis vérifier la réception avec `docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec backup /scripts/backup.sh --test-alert` (sortie 0 et e-mail reçu). **En production depuis le 2026-11-26** : `BACKUP_ALERT_EMAIL` renseignée, essai accepté par le serveur d'envoi (réception à confirmer). L'envoi passe par le même fournisseur que l'application : s'il est en panne, l'alerte ne part pas. Le bucket de sauvegarde doit être distinct du bucket des médias, avec une clé à droits limités.
  - Dépendances d'installation (`awscli` de Debian bookworm) : disponibilité non vérifiée, build jamais lancé.

## Restauration avec le script (jetable, jamais en production)
`infra/scripts/restore.sh <fichier.dump[.gpg]> <base>_restore` vérifie le `.sha256` voisin, **refuse** les noms `app`, `postgres`, `template0/1`, `DB_DATABASE`, `PRODUCTION_DB_NAME` et tout nom qui ne finit pas par `_restore`, `_scratch` ou `_test`, refuse une base déjà existante, restaure avec `pg_restore --exit-on-error`, puis **affiche les comptages** (utilisateurs, profils, messages, conversations, achats, signalements, sanctions, journal d'audit, etc., nombre de tables, migrations, dernier message et dernier achat, durée) à reporter dans le procès-verbal ci-dessous. Elle ne supprime pas la base : la commande `dropdb` est affichée à la fin. Les extensions du schéma (`citext`) demandent un rôle autorisé à les créer.

## Quand
Perte de la base, corruption, erreur humaine. Objectifs de départ (à durcir) : perte de données maximale 24 h, remise en service sous 4 h.

## Étapes
1. **Arrêter l'écriture** : `docker compose -f infra/docker-compose.prod.yml stop app worker scheduler reverb`.
2. **Choisir la sauvegarde** : lister `s3://<BACKUP_BUCKET>/postgres/` ; prendre la plus récente saine.
3. **Télécharger** (`aws s3 cp ... --endpoint-url <BACKUP_ENDPOINT>`) et vérifier la taille.
4. **Base vierge** : le script la crée lui-même et refuse une base existante (jamais restaurer par-dessus une base en service).
5. **Restaurer** : `PGHOST=<hôte> PGUSER=<utilisateur> infra/scripts/restore.sh <fichier>.dump app_restore` (pour un fichier `.gpg`, la clé privée GPG, conservée hors du serveur, est nécessaire). Ensuite, vérifier et basculer (étape 8) vers cette base.
6. **Vérifier** : nombre de tables (36 + tables Laravel), comptage des utilisateurs, dernier message, dernier achat ; `php artisan migrate:status`.
7. **Rejouer les suppressions de comptes** déjà traitées depuis la sauvegarde : lister les utilisateurs passés en `deleted` ou `deleting` **après** la date de la sauvegarde (via un journal d'audit ou la table `users` de la base actuelle avant perte) et relancer `php artisan accounts:purge` ; sans cela, des données supprimées réapparaîtraient (obligation RGPD).
8. **Basculer** : renommer les bases ou changer `DB_DATABASE`, redémarrer les services, tester la santé (`GET /api/v1/health`).
9. **Consigner** : date, sauvegarde utilisée, durée, perte de données, anomalies.

## Test mensuel
Une fois par mois : restaurer la sauvegarde de la veille dans une base de test, exécuter `php artisan migrate:status` et les tests de fumée, consigner la durée. Une sauvegarde jamais restaurée n'est pas une sauvegarde.

## Clés
La clé privée GPG de déchiffrement est conservée par au moins deux personnes, hors du serveur. Perdre cette clé rend toutes les sauvegardes inutilisables.

---

# Exercice de restauration PostgreSQL (gate G5, exigence S8)

**Statut : exercice réalisé le 2026-11-25.** Le modèle ci-dessous reste vierge : une copie remplie est établie à chaque exercice, signée et conservée hors du dépôt. Un exercice non consigné compte comme non fait.

## Principe
L'exercice restaure la dernière sauvegarde dans une **base jetable, sur une instance PostgreSQL séparée de la production** (jamais la base en service), puis vérifie les données et chronomètre chaque phase. Il valide à la fois la sauvegarde, la somme de contrôle, la clé GPG (si le chiffrement est activé) et le script `infra/scripts/restore.sh`.

## Prérequis (à cocher avant de commencer)
- [ ] Une machine d'essai avec `postgresql-client-16`, `gnupg` et `awscli`, ou un conteneur `postgres:16` jetable (par exemple `docker run --rm -d --name pg-restore -e POSTGRES_PASSWORD=<mot-de-passe-jetable> -p 127.0.0.1:55432:5432 postgres:16`). Le port n'est lié qu'à `127.0.0.1`.
- [ ] La clé privée GPG de déchiffrement (détenue hors du serveur, voir « Clés ») importée sur cette machine : `gpg --import <cle-privee.asc>`. Ne jamais la copier sur le serveur de production.
- [ ] Les identifiants du bucket de sauvegarde en lecture (`BACKUP_BUCKET`, `BACKUP_ENDPOINT`, clés d'accès), fournis par le propriétaire du coffre de secrets, exportés dans l'environnement du terminal et non écrits dans un fichier du dépôt.
- [ ] Un chronomètre ou l'heure système relevée à chaque étape.

## Déroulé pas à pas
Noter l'heure de début (T0) puis l'heure de fin de chaque étape dans le procès-verbal.

1. **Lister les sauvegardes** :
   `AWS_ACCESS_KEY_ID=<cle> AWS_SECRET_ACCESS_KEY=<secret> aws s3 ls s3://<BACKUP_BUCKET>/postgres/ --endpoint-url <BACKUP_ENDPOINT>`
   Contrôler qu'il existe une sauvegarde par jour, sans trou, et noter le nom de la plus récente (`<base>_AAAAMMJJTHHMMSSZ.dump`, avec `.gpg` si chiffrée) et vérifier la présence du `.sha256` voisin ainsi que sa taille. Une taille très inférieure à celle de la veille est une anomalie à consigner.
2. **Télécharger** :
   `aws s3 cp s3://<BACKUP_BUCKET>/postgres/<fichier> ./ --endpoint-url <BACKUP_ENDPOINT>` et la même commande pour `<fichier>.sha256` (le script de restauration vérifie la somme tout seul)
   Comparer la taille locale à celle de l'étape 1.
3. **Vérifier le chiffrement sans restaurer** (seulement si la sauvegarde est chiffrée) : `gpg --list-packets <fichier>.dump.gpg | head` doit citer l'identifiant de la clé du destinataire (`BACKUP_GPG_RECIPIENT`). Si la clé privée est introuvable, l'exercice échoue ici : le consigner comme anomalie critique.
4. **Base vierge** : rien à faire, `restore.sh` la crée (`app_restore`) et refuse de continuer si elle existe déjà.
5. **Restaurer** (mesurer la durée de cette étape, c'est le cœur du RTO) :
   `time PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres infra/scripts/restore.sh <fichier>.dump app_restore`
   Le script s'arrête à la première erreur SQL (`pg_restore --exit-on-error`) et affiche les comptages de tables pour le procès-verbal : toute erreur est à consigner telle quelle.
6. **Vérifier l'intégrité** (copier les résultats dans le procès-verbal) :
   - nombre de tables : `psql -h 127.0.0.1 -p 55432 -U postgres -d app_restore -Atc "select count(*) from information_schema.tables where table_schema='public'"` (attendu : le même nombre qu'en production, 46 au 2026-11-25) ;
   - `select count(*) from users;`, `select max(created_at) from messages;`, `select max(created_at) from purchases;` : comparer avec la production (même ordre de grandeur, dernière date cohérente avec l'heure de la sauvegarde) ;
   - absence de ligne orpheline : `select count(*) from messages m left join conversations c on c.id = m.conversation_id where c.id is null;` (attendu : 0) ;
   - versions de migrations : `php artisan migrate:status` avec `DB_HOST=127.0.0.1 DB_PORT=55432 DB_DATABASE=app_restore` (toutes « Ran »).
7. **Test applicatif** : lancer l'API en local ou en préproduction contre `app_restore` et appeler `GET /api/v1/health` (attendu : 200), puis se connecter avec un compte de test.
8. **Vérifier l'obligation RGPD** : comparer les comptes passés à `deleted` / `deleting` dans la production après la date de la sauvegarde avec la base restaurée, et noter combien devraient être rejoués (étape 7 de la procédure de reprise ci-dessus). Pour l'exercice, il suffit de chiffrer l'écart.
9. **Nettoyer** : `dropdb -h 127.0.0.1 -p 55432 -U postgres app_restore`, arrêter le conteneur, **supprimer les fichiers `.dump[.gpg]` et `.sha256` téléchargés et retirer la clé privée de la machine d'essai** (`gpg --delete-secret-keys <empreinte>`).
10. **Remplir et archiver le procès-verbal** (modèle ci-dessous), le faire signer par deux personnes, le stocker hors du dépôt public (le dépôt ne reçoit que la version sans donnée personnelle ni identifiant).

## Critères de réussite (à valider par le propriétaire)
- Restauration terminée sans erreur SQL.
- Durée totale (T0 à fin de l'étape 7) inférieure à l'objectif de remise en service de 4 h ; perte de données (écart entre l'heure de la sauvegarde et l'incident simulé) inférieure à 24 h. Ces objectifs sont provisoires.
- Aucune ligne orpheline ; migrations toutes appliquées ; santé de l'API à 200.
- Clé GPG détenue par au moins deux personnes, confirmée oralement pendant l'exercice.

## Procès-verbal d'exercice de restauration (modèle vierge, à remplir)

| champ | valeur |
| --- | --- |
| Date et heure de début (T0, UTC) | ______ |
| Opérateur 1 (nom, rôle) | ______ |
| Opérateur 2 / témoin (nom, rôle) | ______ |
| Environnement de restauration (machine, version PostgreSQL) | ______ |
| Sauvegarde utilisée (nom du fichier) | ______ |
| Heure de la sauvegarde (UTC) | ______ |
| Taille de la sauvegarde (octets) | ______ |
| Sauvegardes de la semaine : trou ou anomalie de taille ? | oui / non : ______ |
| Clé GPG disponible et valide ? | oui / non |
| Durée du téléchargement (étape 2) | ______ |
| Durée de la restauration (étape 5) | ______ |
| Durée totale T0 à fin de l'étape 7 | ______ |
| Erreurs SQL rencontrées | ______ |
| Nombre de tables | ______ (attendu : comme en production) |
| Utilisateurs (restauré / production) | ______ / ______ |
| Dernier message (date restaurée) | ______ |
| Dernier achat (date restaurée) | ______ |
| Lignes orphelines | ______ (attendu : 0) |
| `migrate:status` : toutes « Ran » ? | oui / non |
| `GET /api/v1/health` | code ______ |
| Comptes à rejouer (suppressions postérieures) | ______ |
| Perte de données estimée (RPO mesuré) | ______ |
| Remise en service estimée (RTO mesuré) | ______ |
| Nettoyage fait (base, fichier, clé privée) | oui / non |
| Anomalies et actions correctives (propriétaire, échéance) | ______ |
| Verdict | RÉUSSI / ÉCHEC / RÉUSSI AVEC RÉSERVES |
| Signatures (deux personnes) et date | ______ |

Après le premier exercice réel : mettre à jour le statut en tête de ce document, `docs/16-STATUS.md` (gate G5), `specs/011-launch-readiness/tasks.md` (T003, T027) et la ligne « Procès-verbal de restauration » de `docs/reviews/code-security-2-suivi.md` (par la personne qui en a la charge).

## Exercices réalisés

### 2026-11-25 : réussi avec réserves

- Méthode : dernière sauvegarde téléchargée depuis le stockage distant, somme SHA-256 conforme ; déchiffrement sur le poste détenteur de la clé, en flux, directement dans la mémoire d'un PostgreSQL **jetable** du serveur (réseau Docker interne, données en `tmpfs`), puis `restore.sh` exécuté dans ce conteneur ; comptages comparés à la production en lecture seule ; conteneur applicatif jetable contre la base restaurée ; tout détruit ensuite.
- Résultat : aucune erreur SQL ; 46 tables et 9 migrations, identiques à la production (même empreinte), 0 migration en attente ; `/api/v1/health` 200 ; aucune ligne orpheline ; 64 s de T0 à la fin du test applicatif (téléchargement 11 s, `restore.sh` 7 s).
- Réserves : base de production sans aucun membre, donc durée et charge non représentatives ; connexion d'un compte de test et bascule non jouées ; clé privée sur un seul poste, sans phrase secrète ; aucune alerte d'échec de sauvegarde ; procès-verbal à signer par deux personnes.
