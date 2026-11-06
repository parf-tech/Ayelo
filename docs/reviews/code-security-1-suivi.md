# Suivi des constats de `code-security-1.md`

Date : 2026-11-06. Preuve des corrections : `backend/tests/Feature/SecurityHardeningTest.php` (un test par constat), suite complète **158 tests, 831 assertions, 0 échec** sur PostgreSQL 16 (exécutée par le CTO dans un worktree isolé de l'état commité plus ses changements, sans les fichiers partiels de l'agent d'administration).
Statuts : **corrigé** (test cité) | **atténué** (réduit, risque résiduel écrit) | **ouvert** (responsable indiqué).

## Constats hauts

| id | statut | correction | test |
| --- | --- | --- | --- |
| F-01 | corrigé | limiteurs par e-mail normalisé + appareil (uuid valide seulement) + IP, le plus strict gagne ; en-tête non uuid = repli sur l'IP ; limite générale `api` 120/min par compte ou IP | `F-01 : changer X-Device-Id…`, `la casse de l'e-mail…`, `en-tête non uuid…` |
| F-02 | atténué | refus d'âge mémorisé par appareil (90 j) **et** par IP (2 h) ; reste contournable par changement d'IP : le contrôle d'âge est déclaratif (limite documentée) ; attestation d'appareil non faite (spec 001 T012) | `F-02 : un mineur refusé…` |
| F-03 | corrigé | middleware `EnsureAccountActive` sur le groupe API : un compte non actif ne garde que `me`, `sanctions`, `appeals`, `export`, `logout` ; réactivation = même jeton | `F-03 : …` (2 tests) |
| F-04 | corrigé (code) | `TRUSTED_PROXIES` (CIDR) ; vide = aucun proxy cru ; **déploiement à régler** : renseigner le réseau de Caddy et ne pas publier le port applicatif | `F-04 : l'en-tête X-Forwarded-For…` |
| F-05 | corrigé (images) | les octets sont relus à la fin de l'envoi : signature réelle = type déclaré, dimensions plafonnées, ré-encodage **sans EXIF/GPS** vers une **nouvelle clé** (l'ancienne est supprimée) ; dépôts abandonnés purgés après 24 h ; **vidéo et audio fermés** (aucun traitement équivalent) | `F-05 : …` (6 tests) |
| F-06 | corrigé | l'anonymisation supprime exports (objet compris), tickets, contestations, appels, vues de stories, cadeaux, risques (si non sanctionné), IP des consentements, charges RevenueCat ; exports expirés purgés chaque jour | `F-06 : …` (2 tests) |
| F-07 | corrigé | l'appelé n'obtient un jeton qu'après avoir décroché | `F-07 : …` |
| F-08 | corrigé | l'événement n'est « traité » que dans la transaction de ses effets ; un échec laisse `processed_at` vide et le rejeu est retraité ; événement d'utilisateur inconnu conservé et appliqué plus tard | `F-08 : …` (2 tests) |
| F-09 | atténué | suspension automatique seulement si le signaleur a une conversation avec la cible ou si un second signaleur distinct s'ajoute ; sinon file prioritaire sans suspension ; 3 signalements « mineur » par jour. **Compromis produit à confirmer par le propriétaire** ; la modération humaine reste non budgétée | `F-09 : …` (2 tests) |

## Constats moyens et bas traités au passage

| id | statut | note |
| --- | --- | --- |
| F-10 | corrigé | matchs : comptes suspendus ou supprimés masqués — `F-10` |
| F-12 | corrigé en partie | limite générale par compte ; le plafond de moissonnage de la découverte reste ouvert |
| F-15 | corrigé | le message supprimé est masqué mais conservé jusqu'à l'anonymisation — `F-15` |
| F-16 | corrigé | e-mails bannis refusés à l'inscription (e-mail et OAuth) — `F-16` |
| F-22 | corrigé | purge des dépôts abandonnés |
| F-23 | corrigé | types de message limités à texte et image |

## Restent ouverts

| id | responsable | note |
| --- | --- | --- |
| F-11 énumération de comptes (e-mail déjà pris, temps de réponse) | Backend | à arbitrer : réponse identique à l'inscription vs ergonomie |
| F-13 webhook : bac à sable accepté, ordre des événements ignoré | Backend | à régler avec la documentation RevenueCat (ADR 002) |
| F-14 appels : sonnerie abusive, salle non fermée côté LiveKit | Realtime | après D0 |
| F-17 valeurs par défaut (cache, en-têtes de sécurité, Reverb) | DevOps | à traiter dans l'infrastructure de production (spec 011 T003) |
| F-18 verrouillage progressif, rotation de jeton | Backend | non décidé |
| F-19 à F-21, F-24 à F-30 (bas) | Backend | à traiter par lots ; voir `code-security-1.md` |
| Plafond de moissonnage de la découverte | Backend | quota de profils vus par jour à définir |

## Gate G3

**Toujours non franchi** : tests rejoués après correction (fait), mais restent `npm audit` du mobile, gitleaks de l'historique complet sur le commit final, une **seconde revue indépendante** du code corrigé, la matrice juridique et l'attestation d'appareil. Les constats hauts du rapport sont tous traités (7 corrigés, 2 atténués avec risque résiduel écrit).
