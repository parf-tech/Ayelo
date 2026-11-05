# 14 : Déploiement

Cible budget serré : un VPS pour l'application, R2 pour les médias, LiveKit à part au moment des appels. Rien n'est encore déployé.

## Environnements

| environnement | usage | hébergement |
| --- | --- | --- |
| local | développement | Docker Compose sur le poste |
| staging | tests avec les stores en sandbox, E2E | petit serveur séparé, ou arrêté hors des périodes de test (pas sur le VPS de production) |
| production | utilisateurs | VPS 8 Go / 4 vCPU (à confirmer) |

## Services (Docker Compose)

| service | image / rôle |
| --- | --- |
| `app` | Laravel (PHP-FPM), API |
| `reverb` | Laravel Reverb (WebSocket), supervisé |
| `worker` | Horizon / `queue:work` (médias, notifications, webhooks) |
| `scheduler` | `schedule:run` chaque minute |
| `postgres` | PostgreSQL 16 (image standard ; l'image `postgis/postgis` seulement quand la migration de proximité arrive, phase E) |
| `redis` | Redis (files, cache, limitation de débit) |
| `caddy` | reverse proxy, TLS automatique, HTTP/2 |
| `transcode` | conteneur séparé avec `ffmpeg`, **sans accès réseau**, limites CPU / mémoire / durée ; le `worker` lui passe les fichiers par volume |

Sous-domaines : `api.<domaine>`, `ws.<domaine>`, `admin.<domaine>` (Filament, accès restreint).

## Stockage

Cloudflare R2 : buckets privés `media-prod`, `media-staging`, `backups`. Accès par URL signées.

## Appels (phase D)

- Les appels sont **inclus au lancement** (décision propriétaire). Option 1 (retenue au départ) : LiveKit Cloud, avec un modèle de coût en minutes d'appel par utilisateur actif (le « test sur trafic réel » n'est pas possible avant le lancement).
- Option 2 : serveur LiveKit dédié (ports UDP 50000–60000 et 443/TCP, TURN/TLS, domaine `rtc.<domaine>`).
- Décision à prendre via ADR 004 à partir d'un modèle de coût (minutes d'appel par utilisateur actif), pas d'un test sur trafic réel.

## Intégration et livraison continues

```
push -> GitHub Actions : lint + tests + audits -> (branche principale) build image Docker
 -> déploiement staging automatique -> E2E nocturnes
 -> étiquette vX.Y.Z -> déploiement production manuel (approbation)
Mobile : EAS Build -> TestFlight / pistes de test Google Play -> soumission aux stores
```

Retour arrière : images Docker versionnées ; migrations réversibles ou « expand/contract » ; commande de retour documentée.

## Observabilité

| besoin | outil |
| --- | --- |
| Erreurs app et backend | Sentry |
| Journaux | JSON vers fichiers tournants, centralisation optionnelle |
| Métriques serveur | Netdata ou Prometheus + Grafana |
| Disponibilité | Uptime Kuma (API, WebSocket, admin) |
| Alertes | email / Telegram pour : taux d'erreur, longueur des files, espace disque, sauvegarde échouée, webhook en échec |

## Sauvegardes et reprise

| élément | fréquence | rétention | test |
| --- | --- | --- | --- |
| `pg_dump` chiffré vers R2 | quotidienne | 14 jours + 3 mensuelles | restauration mensuelle documentée |
| WAL / sauvegarde continue | à étudier (si budget) | | |
| Configuration (`infra/`, secrets chiffrés) | à chaque changement | versionnée | |

Objectifs : perte de données maximale 24 h (RPO), remise en service sous 4 h (RTO). À durcir après le lancement.

## Sécurité de l'hôte

Clé SSH uniquement, `ufw` (22 restreint, 80, 443), fail2ban, mises à jour automatiques, utilisateur non root pour Docker, secrets via fichiers `.env` hors dépôt (ou `docker secret`).

## Liste de contrôle de mise en production

1. DNS et TLS valides.
2. Variables d'environnement complètes et sans secret de test.
3. Migrations exécutées ; jeux de données de démo absents.
4. Webhook RevenueCat configuré et testé (événement de test reçu une seule fois).
5. Notifications push testées sur iOS et Android.
6. Sauvegarde exécutée et restaurée sur une base vierge.
7. Supervision et alertes actives.
8. Politique de confidentialité, CGU et mentions publiées.
9. Plan de retour arrière écrit.

## Publication sur les stores (Release Manager)

| étape | détail |
| --- | --- |
| Comptes | Apple Developer (99 $/an), Google Play (25 $ une fois) |
| Fiches | titre, description, captures, mots clés, catégorie, classification d'âge (18+) |
| Confidentialité | étiquettes de données Apple, section « sécurité des données » Google |
| UGC (Apple 1.2) | filtrage, signalement, blocage, modération 24 h, coordonnées du support |
| Achats | produits créés et approuvés, abonnements décrits, « Restaurer » |
| Suppression de compte | accessible dans l'app **et page web de demande de suppression** (URL à déclarer dans la fiche Google Play, à vérifier) |
| Pistes | TestFlight ; Google Play : test interne puis **test fermé** (obligatoire pour un compte personnel neuf, durée et nombre de testeurs à vérifier) avant production |
| Revue | prévoir des délais de revue et des allers-retours |

## Coûts à valider (chiffres non vérifiés, bloquant avant tout achat)

VPS, R2, Sentry, email/SMS, modération d'images, LiveKit, comptes développeur. Un tableau de budget sera produit avec les tarifs officiels du jour **avant** tout achat.

## Tableau de coûts mensuels : à produire (tâche P0-8)

Le budget cible est de 30 à 80 € par mois, mais **il n'est pas démontré**. Postes à chiffrer, chacun avec l'URL de la grille tarifaire officielle et la date de lecture : VPS de 8 Go, Cloudflare R2, LiveKit Cloud (palier gratuit et palier payant, minutes d'appel), Sentry, e-mail transactionnel, SMS vers chaque pays visé, modération automatique d'images, EAS Build, runners macOS pour les tests iOS, RevenueCat (pourcentage du chiffre d'affaires), nom de domaine. Deux scénarios (bas et haut) avec hypothèse de trafic explicite. La **modération humaine** est budgétée à part. Si le total haut dépasse 80 €, le propriétaire arbitre : réduire le périmètre des appels, ou relever le budget.

## Compléments issus de la relecture indépendante

- Staging : sur un petit serveur séparé ou arrêté hors des tests, pas sur le VPS de production.
- `ffmpeg` : conteneur sans réseau, limites CPU, mémoire et durée.
- Supervision : au moins une sonde externe (Uptime Kuma hébergé ailleurs), pas seulement sur le VPS de production.
- Sauvegarde : `pg_dump` plus fréquent ou archivage WAL vers R2 pour réduire le RPO de 24 h ; la restauration doit rejouer les suppressions de comptes déjà traitées.
- Google Play : un compte personnel neuf impose probablement une phase de test fermé avant production (durée et nombre de testeurs à vérifier sur la documentation officielle) ; prévoir ce délai.
- Apple : l'écran d'abonnement doit afficher le prix, la durée, le renouvellement automatique et des liens vers les CGU et la politique de confidentialité (à vérifier dans les règles Apple en vigueur).
- UE : la déclaration de statut de professionnel (DSA) dans les stores est à vérifier selon l'entité éditrice.
- Entité juridique : à décider **avant** d'ouvrir les comptes développeur.
