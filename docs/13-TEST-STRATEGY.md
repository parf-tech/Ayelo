# 13 : Stratégie de test et gates de livraison

Règle absolue : **aucun travail n'est déclaré terminé sans preuve vérifiable** (sortie de test, journal, capture, rapport). « Ça devrait marcher » n'est pas une preuve.

## Pyramide de tests

| niveau | outil | cible | propriétaire |
| --- | --- | --- | --- |
| Unitaire backend | Pest / PHPUnit | services, règles métier (matching, crédits, idempotence) | Backend |
| Intégration / API | Pest + base PostgreSQL de test | routes, politiques d'autorisation, webhooks | QA |
| Contrat | OpenAPI + tests de conformité | le mobile et l'API parlent le même contrat | QA / Architecte |
| Unitaire mobile | Jest + Testing Library | composants, hooks, stores | Mobile / UI |
| E2E mobile | Maestro (émulateur Android, simulateur iOS) | parcours critiques | QA |
| Temps réel | tests Pest + client WebSocket | diffusion de messages, autorisations de canaux | Realtime |
| Appels | tests manuels guidés + scénarios réseau dégradé | audio/vidéo, reconnexion | Realtime / QA |
| Sécurité | tests d'autorisation, `composer audit`, `npm audit`, `gitleaks`, revue | | Security |
| Performance | k6 sur l'API de découverte et la messagerie | | DevOps / QA |
| Accessibilité | revue manuelle + audits automatisés | | UI/UX |

## Parcours critiques (E2E Maestro)

1. Inscription → onboarding → première découverte.
2. Like réciproque → match → premier message.
3. Envoi de message hors ligne puis reconnexion (pas de doublon).
4. Bloquer un utilisateur → il disparaît partout.
5. Signaler un profil.
6. Achat de Premium en environnement de test des stores (sandbox) → accès débloqué.
7. Restaurer les achats.
8. Suppression de compte.
9. (phase D) Appel vidéo entre deux appareils.

## Tests obligatoires par thème

| thème | exemples de cas |
| --- | --- |
| Autorisation | A ne lit pas la conversation de B ; un modérateur n'a pas les droits admin ; un utilisateur bloqué ne peut pas écrire |
| Idempotence | message renvoyé ; webhook rejoué ; cadeau en double |
| Concurrence | deux likes simultanés = un seul match ; deux dépenses du dernier crédit |
| Limites | 429 après les essais de connexion ; quota de likes |
| Âge | inscription à 17 ans refusée ; date de naissance non modifiable |
| Médias | média non approuvé invisible ; type MIME falsifié refusé |
| Suppression | données effacées après 30 jours, profil masqué immédiatement |
| Paiements | remboursement reprend les crédits ; solde jamais négatif |
| Audit | action d'administration écrite dans `audit_logs` ; modification refusée |

## Données de test

Jeux de données générés par des factories (jamais de données réelles). Comptes de test pour les stores en sandbox.

## Intégration continue (GitHub Actions)

1. Backend : lint (Pint), analyse statique (Larastan), tests Pest sur PostgreSQL et Redis de service.
2. Mobile : lint, `tsc --noEmit`, Jest.
3. Sécurité : `gitleaks`, `composer audit`, `npm audit`.
4. Contrat : validation OpenAPI.
5. Build mobile EAS (sur branche principale et étiquettes).
6. E2E Maestro nocturne sur émulateur.

Un merge n'est possible que si tout est vert.

## Seuils de qualité

| mesure | seuil |
| --- | --- |
| Couverture backend (services critiques : billing, matching, auth, safety) | ≥ 85 % |
| Couverture globale backend | ≥ 70 % |
| Couverture mobile (logique et composants partagés) | ≥ 60 % |
| Parcours critiques E2E | 100 % verts |
| Sessions sans crash | ≥ 99,5 % |
| Latence API p95 | < 300 ms (hors médias) |
| Latence message de bout en bout p95 | < 1 s |

## Gates de livraison

Chaque phase passe les gates dans l'ordre. L'échec d'un gate bloque la phase.

| gate | question | preuve exigée | validé par |
| --- | --- | --- | --- |
| G0 : Cadrage | la stack et le périmètre sont-ils validés ? | ADR 001 acceptée par le propriétaire | CTO + propriétaire |
| G1 : Conception | specs, schéma, API cohérents et relus ? | documents 03, 09, 10 relus, aucun point bloquant | Independent Reviewer |
| G2 : Module | le module répond-il à ses exigences FR ? | tests verts, couverture atteinte, démo | QA |
| G3 : Sécurité | exigences S1–S9 satisfaites ? | rapports d'audit et de tests | Security + Reviewer |
| G4 : Intégration | les parcours E2E passent-ils ? | rapport Maestro, captures | QA |
| G5 : Pré-production | déploiement, sauvegarde et restauration prouvés ? | procès-verbal, supervision active | DevOps |
| G6 : Stores + appels | conformité stores (UGC, achats, suppression, confidentialité) et appels validés ? | liste de contrôle remplie, parcours E2E 9 (appel entre deux appareils) vert, prototype D0 en go, build soumis | Release Manager |
| G7 : Lancement | décision finale | tous les gates précédents + sauvegarde restaurée + plan de retour arrière | CTO + propriétaire |

## Définition de « terminé »

Une tâche est terminée seulement si :
1. Le code est relu par un autre agent que son auteur.
2. Les tests écrits **et exécutés** sont verts (sortie jointe).
3. La documentation concernée est à jour.
4. Aucun secret n'a été ajouté.
5. Le périmètre (fichiers) respecte la propriété définie dans `08-SOFTWARE-ARCHITECTURE.md`.

## Audit indépendant

L'Independent Reviewer vérifie, sans avoir écrit le livrable : cohérence documents ↔ code, couverture des exigences (matrice FR → test), décisions ADR justifiées, affirmations non prouvées. Il rend un rapport par phase ; les points bloquants arrêtent la phase.
