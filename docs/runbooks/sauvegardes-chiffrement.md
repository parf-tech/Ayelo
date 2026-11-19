# Sauvegardes : chiffrement obligatoire et clé GPG

Contexte : revue CTO n°1, section 3.2. Avant : sans `BACKUP_GPG_RECIPIENT`, les archives (toutes les données personnelles) partaient en clair dans le bucket et rien n'imposait le chiffrement ; activer le chiffrement faisait échouer la sauvegarde car la clé publique n'était pas câblée.

## Ce qui est imposé maintenant

1. `infra/docker-compose.prod.yml` : `BACKUP_GPG_RECIPIENT` et `BACKUP_GPG_PUBLIC_KEY_PATH` sont obligatoires (`${VAR:?message}`). S'ils sont vides, TOUTE commande `docker compose` du fichier échoue avec un message explicite : le service ne démarre pas, il ne sauvegarde pas en clair.
2. `infra/scripts/backup.sh` : un `BACKUP_GPG_RECIPIENT` vide fait échouer la sauvegarde à l'étape `preflight` (échappatoire `BACKUP_ALLOW_UNENCRYPTED=1` réservée à un essai local jetable, jamais en production). Quand le destinataire est renseigné, le script chiffre avec `gpg --encrypt --recipient`, supprime l'archive en clair, calcule le SHA-256 du fichier chiffré, et n'envoie que le `.gpg`. Il ne peut pas envoyer en clair si le chiffrement échoue (`fail`).
3. La clé publique est montée en lecture seule dans le conteneur `backup` (`/keys/backup-public.asc`) et importée à chaque exécution (`BACKUP_GPG_PUBLIC_KEY_FILE`). Le montage a `create_host_path: false` : fichier absent = échec de compose, pas un dossier vide créé.

## Mettre en place (une fois, hors du serveur)

Sur le poste du responsable (pas sur le VPS) :

```
gpg --quick-generate-key "Ayelo backups <backups@example.invalid>" default default 3y   # ed25519 + sous-clé de chiffrement cv25519 ; "ed25519 encr" échoue (« Wrong key usage »), "rsa4096 encr" convient aussi
gpg --armor --export "Ayelo backups <backups@example.invalid>" > backup-public.asc
# sauvegarde de la clé privée : gestionnaire de mots de passe + copie papier/clé USB dans un coffre
gpg --armor --export-secret-keys "Ayelo backups <backups@example.invalid>" > backup-private.asc   # NE JAMAIS copier sur le serveur
```

Sur le serveur : copier UNIQUEMENT `backup-public.asc` (par exemple `/opt/ayelo/backup-public.asc`, droits 644), puis dans `infra/.env.prod` :

```
BACKUP_GPG_RECIPIENT=backups@example.invalid          # l'identifiant de la clé (adresse ou empreinte)
BACKUP_GPG_PUBLIC_KEY_PATH=/opt/ayelo/backup-public.asc
```

Remplacer `example.invalid` par l'adresse réelle ; aucune valeur réelle n'est dans le dépôt.

## Restaurer

Le déchiffrement exige la clé privée, qui n'est pas sur le serveur : copier l'archive `.dump.gpg` (et son `.sha256`) sur un poste ou un serveur jetable qui possède la clé privée, vérifier `sha256sum -c`, puis lancer `infra/scripts/restore.sh <fichier.dump.gpg> <base_jetable>` (il déchiffre avec `gpg --decrypt`). Procédure complète et preuve de restauration : `restauration.md`. Une sauvegarde chiffrée dont la clé privée est perdue est une sauvegarde perdue : tester le déchiffrement d'une archive réelle avant le lancement, et conserver deux copies de la clé privée en lieux distincts.

## Rotation de la clé

Générer une nouvelle paire, remplacer `backup-public.asc` et `BACKUP_GPG_RECIPIENT`, redémarrer le service `backup`. Garder l'ancienne clé privée tant qu'il existe des archives chiffrées avec elle (rétention : 14 jours quotidiens + 6 mois mensuels par défaut).

## Reste à faire (non réglé par ce changement)

Sauvegarde logique quotidienne seulement (RPO 24 h, pas d'archivage WAL), copie locale sur le même serveur, bucket et médias R2 non versionnés, restauration jamais exécutée. Voir `docs/reviews/cto-1-suivi.md`.
