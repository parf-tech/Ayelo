# Procédure : restauration de la base de données

**Statut** : écrite, **jamais exécutée**. Le gate G5 exige une restauration réelle, chronométrée, sur une base vierge, avant le lancement.

## Quand
Perte de la base, corruption, erreur humaine. Objectifs de départ (à durcir) : perte de données maximale 24 h, remise en service sous 4 h.

## Étapes
1. **Arrêter l'écriture** : `docker compose -f infra/docker-compose.prod.yml stop app worker scheduler reverb`.
2. **Choisir la sauvegarde** : lister `s3://<BACKUP_BUCKET>/postgres/` ; prendre la plus récente saine.
3. **Télécharger** (`aws s3 cp ... --endpoint-url <BACKUP_ENDPOINT>`) et vérifier la taille.
4. **Créer une base vierge** (jamais restaurer par-dessus une base en service) : `createdb -h <hôte> -U <utilisateur> app_restore`.
5. **Restaurer** : `infra/backup/restore.sh <fichier.sql.gz.gpg> <hôte> app_restore <utilisateur>` (nécessite la clé privée GPG, conservée hors du serveur).
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

**Statut : procédure écrite, NON exécutée.** Aucune restauration n'a été réalisée à ce jour. Le procès-verbal ci-dessous est vierge : ne le remplir qu'après un exercice réel, avec les valeurs mesurées. Un exercice non consigné compte comme non fait.

## Principe
L'exercice restaure la dernière sauvegarde chiffrée dans une **base jetable, sur une instance PostgreSQL séparée de la production** (jamais la base en service), puis vérifie les données et chronomètre chaque phase. Il valide à la fois la sauvegarde, la clé GPG et le script `infra/backup/restore.sh`.

## Prérequis (à cocher avant de commencer)
- [ ] Une machine d'essai avec `postgresql-client-16`, `gnupg`, `awscli` et `gzip`, ou un conteneur `postgres:16` jetable (par exemple `docker run --rm -d --name pg-restore -e POSTGRES_PASSWORD=<mot-de-passe-jetable> -p 127.0.0.1:55432:5432 postgres:16`). Le port n'est lié qu'à `127.0.0.1`.
- [ ] La clé privée GPG de déchiffrement (détenue hors du serveur, voir « Clés ») importée sur cette machine : `gpg --import <cle-privee.asc>`. Ne jamais la copier sur le serveur de production.
- [ ] Les identifiants du bucket de sauvegarde en lecture (`BACKUP_BUCKET`, `BACKUP_ENDPOINT`, clés d'accès), fournis par le propriétaire du coffre de secrets, exportés dans l'environnement du terminal et non écrits dans un fichier du dépôt.
- [ ] Un chronomètre ou l'heure système relevée à chaque étape.

## Déroulé pas à pas
Noter l'heure de début (T0) puis l'heure de fin de chaque étape dans le procès-verbal.

1. **Lister les sauvegardes** :
   `AWS_ACCESS_KEY_ID=<cle> AWS_SECRET_ACCESS_KEY=<secret> aws s3 ls s3://<BACKUP_BUCKET>/postgres/ --endpoint-url <BACKUP_ENDPOINT>`
   Contrôler qu'il existe une sauvegarde par jour, sans trou, et noter le nom de la plus récente (`AAAAMMJJTHHMMSSZ.sql.gz.gpg`) ainsi que sa taille. Une taille très inférieure à celle de la veille est une anomalie à consigner.
2. **Télécharger** :
   `aws s3 cp s3://<BACKUP_BUCKET>/postgres/<fichier>.sql.gz.gpg ./ --endpoint-url <BACKUP_ENDPOINT>`
   Comparer la taille locale à celle de l'étape 1.
3. **Vérifier le chiffrement sans restaurer** : `gpg --list-packets <fichier>.sql.gz.gpg | head` doit citer l'identifiant de la clé du destinataire (`BACKUP_GPG_RECIPIENT`). Si la clé privée est introuvable, l'exercice échoue ici : le consigner comme anomalie critique.
4. **Créer la base vierge** :
   `createdb -h 127.0.0.1 -p 55432 -U postgres app_restore`
5. **Restaurer** (mesurer la durée de cette étape, c'est le cœur du RTO) :
   `time infra/backup/restore.sh <fichier>.sql.gz.gpg 127.0.0.1 app_restore postgres`
   (si le port n'est pas 5432, exporter `PGPORT=55432`.) Le script s'arrête à la première erreur SQL (`ON_ERROR_STOP=1`) : toute erreur est à consigner telle quelle.
6. **Vérifier l'intégrité** (copier les résultats dans le procès-verbal) :
   - nombre de tables : `psql -h 127.0.0.1 -p 55432 -U postgres -d app_restore -Atc "select count(*) from information_schema.tables where table_schema='public'"` (attendu : 36 tables métier plus les tables Laravel) ;
   - `select count(*) from users;`, `select max(created_at) from messages;`, `select max(created_at) from purchases;` : comparer avec la production (même ordre de grandeur, dernière date cohérente avec l'heure de la sauvegarde) ;
   - absence de ligne orpheline : `select count(*) from messages m left join conversations c on c.id = m.conversation_id where c.id is null;` (attendu : 0) ;
   - versions de migrations : `php artisan migrate:status` avec `DB_HOST=127.0.0.1 DB_PORT=55432 DB_DATABASE=app_restore` (toutes « Ran »).
7. **Test applicatif** : lancer l'API en local ou en préproduction contre `app_restore` et appeler `GET /api/v1/health` (attendu : 200), puis se connecter avec un compte de test.
8. **Vérifier l'obligation RGPD** : comparer les comptes passés à `deleted` / `deleting` dans la production après la date de la sauvegarde avec la base restaurée, et noter combien devraient être rejoués (étape 7 de la procédure de reprise ci-dessus). Pour l'exercice, il suffit de chiffrer l'écart.
9. **Nettoyer** : `dropdb -h 127.0.0.1 -p 55432 -U postgres app_restore`, arrêter le conteneur, **supprimer le fichier `.sql.gz.gpg` téléchargé et retirer la clé privée de la machine d'essai** (`gpg --delete-secret-keys <empreinte>`).
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
| Nombre de tables | ______ (attendu : 36 + Laravel) |
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
