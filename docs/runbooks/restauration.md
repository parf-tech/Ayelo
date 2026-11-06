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
