# Spécification 001 : Comptes et authentification

**Statut** : livré côté serveur (2026-11-05) | **Phase** : A | **Exigences** : FR-A-1 à A-12, FR-I-12, FR-I-14 | **Origine** : choix produit (inscription, connexion) ; TikTok **confirmé** dans l'original mais hors périmètre (voir 012)

## Parcours utilisateur

### US1 – Créer un compte après contrôle d'âge (P1)
Une personne indique ses consentements puis sa date de naissance. Si elle est majeure, elle reçoit un jeton valable 10 minutes, lié à son appareil, et peut créer son compte. Si elle est mineure, elle reçoit un refus neutre, mémorisé 90 jours pour l'appareil.
**Test indépendant** : appeler `age-check` puis `register`.
**Scénarios** : 1) majeur → jeton → compte créé avec la date du jeton ; 2) mineur → 403 neutre, un nouvel essai avec une autre date sur le même appareil est refusé ; 3) 18 ans aujourd'hui accepté, demain refusé ; 4) jeton falsifié, expiré ou émis pour un autre appareil → refus ; 5) consentements obligatoires (conditions, confidentialité, données sensibles) sinon refus.

### US2 – Se connecter et se déconnecter (P1)
Un compte existant se connecte sans repasser par les consentements ni l'âge. Les erreurs ne révèlent pas si l'e-mail existe. 5 tentatives par 15 minutes et par (e-mail, appareil). Compte suspendu : refus.

### US3 – Vérifier l'e-mail et récupérer son compte (P2)
Lien à usage unique : e-mail 24 h, mot de passe 1 h, 5 essais, nouveau lien = ancien invalidé. Réinitialisation = toutes les sessions fermées.

### US4 – Gérer ses sessions (P2)
Liste des appareils, fermeture d'une session ou de toutes ; impossible d'agir sur la session d'autrui.

### US5 – Se connecter avec Google ou Apple (P2)
Identité vérifiée par signature RS256 (JWKS), émetteur et audience. Nouveau compte : jeton d'âge et consentements obligatoires, sinon `registration_required`. Aucun rattachement automatique à un compte existant (`account_exists`).

## Cas limites
Adresse non vérifiée par le fournisseur ; appareil au refus d'âge mémorisé ; X-Device-Id absent ; compte supprimé ou banni.

## Exigences
FR-A-1 inscription, A-2 Google/Apple, A-3 e-mail, A-5 mot de passe oublié, A-6 sessions, A-7 déconnexion, A-9 limites de débit, A-10 écrans, A-11 suppression (voir 006), A-12 connexion sans âge ; FR-I-12 âge avant compte ; FR-I-14 consentements. **Hors périmètre ici** : FR-A-4 téléphone (SMS), TikTok → 012.

## Critères de réussite
Aucun compte mineur ne peut être créé par l'API ; aucune énumération de comptes ; mots de passe en Argon2id.

## Décisions ouvertes
- Expiration des jetons : fixe 30 jours (ADR 006) ; expiration glissante non décidée.
