# 11 : Exigences de sécurité et de confiance

Propriétaire : Security Engineer. Relu par : Independent Reviewer. Ce document est un cahier des charges : rien n'est encore implémenté ni audité.

## Modèle de menaces (résumé)

| menace | exemple | contre-mesure principale |
| --- | --- | --- |
| Prise de contrôle de compte | bourrage d'identifiants, phishing | limitation des tentatives, mots de passe vérifiés, alerte de connexion, 2FA optionnelle |
| Arnaque sentimentale | demande d'argent, faux profil | alerte dans la conversation, détection de signaux, signalement prioritaire, sanctions |
| Mineurs | inscription sous 18 ans, contact d'un mineur | 18+ strict, signalement dédié, suspension immédiate, revue prioritaire |
| Contenu illégal / explicite | photos non consenties, contenu pédocriminel | modération avant publication, signalement aux autorités, conservation légale |
| Fuite de données | base exposée, médias publics | chiffrement, URL signées, moindre privilège, sauvegardes chiffrées |
| Abus d'API | scraping de profils, spam | limites de débit, quotas, détection de comportements |
| Fraude de paiement | double crédit, faux reçu | validation côté serveur via RevenueCat, idempotence, registre de crédits |
| Abus d'administration | modérateur malveillant | rôles, 2FA, journal d'audit immuable |
| Géolocalisation | trilatération d'un utilisateur | position arrondie (~1 km), jamais de coordonnées précises à l'API |

## Exigences

### Authentification et sessions
1. Mots de passe hachés avec Argon2id ; jamais journalisés.
2. Mot de passe ≥ 10 caractères, vérification contre une liste de mots de passe compromis.
3. Jetons Sanctum à durée limitée, révocables, liés à un appareil ; rotation à la connexion.
4. Limitation : 5 échecs de connexion / 15 min par (email, appareil) ; verrouillage progressif.
5. Réponses identiques pour « email inconnu » et « mot de passe faux » sur la récupération de compte.
6. Codes de vérification hachés, usage unique, expiration courte, essais limités.
7. 2FA obligatoire pour tout compte d'administration et de modération.

### Autorisation
1. Politique Laravel sur chaque ressource ; tests qui prouvent qu'un utilisateur A ne lit pas les données de B.
2. Aucun identifiant utilisateur pris dans le corps de la requête pour décider des droits.
3. Un utilisateur bloqué ne peut ni voir, ni écrire, ni appeler, ni recevoir de cadeau.
4. Canaux Reverb privés : abonnement refusé si non participant.
5. Filament isolé sur un sous-domaine, accès restreint par rôle, IP optionnelle.

### Données personnelles (RGPD et équivalents)
1. Base légale et consentements enregistrés (CGU, confidentialité, traitement de données sensibles).
2. **Données sensibles (article 9 du RGPD) : il y en a, et il faut les traiter comme telles.** Le genre du profil combiné au genre recherché (`preferences.seeking_genders`) révèle indirectement l'orientation sexuelle. L'origine (`origin_country`, filtre central du produit) peut révéler une origine ethnique ou raciale, et l'usage d'une app de rencontres est en soi une information sensible. Conséquences : consentement **explicite et distinct** (`user_consents.kind='sensitive_data'`), retrait possible, analyse d'impact (AIPD) avant lancement, aucune utilisation publicitaire, aucune exposition dans les API publiques au-delà de ce qui est nécessaire. À faire valider par un juriste. Le selfie de vérification est une donnée biométrique potentielle : consentement dédié (`verification_biometric`), suppression après la décision, pas de comparaison automatisée sans AIPD.
3. Export des données et suppression à la demande ; effacement sous 30 jours (médias R2 compris), avec conservation limitée des signalements et preuves exigés par la loi.
4. Localisation : approximative, avec consentement explicite ; désactivable.
5. Sous-traitants (RevenueCat, fournisseur email/SMS, modération, hébergeurs) listés dans la politique de confidentialité, avec accords de traitement.
6. Registre des traitements et analyse d'impact (AIPD) avant lancement.

### Protection des mineurs
1. Âge minimum 18 ans : date de naissance obligatoire, refus sans moyen de contournement évident (message neutre, pas d'indication de l'âge limite exact au refus répété).
2. Motif de signalement « mineur suspecté » → priorité maximale, suspension préventive du compte signalé, revue sous 2 h.
3. Contenus évoquant des mineurs : suppression immédiate et procédure de signalement aux autorités compétentes.
4. Aucun profil de mineur n'est jamais visible.

### Contenu et modération
1. Aucun média public avant `approved`.
2. Contrôle automatique des images (prestataire à choisir, ADR 005) puis file humaine pour les cas limites.
3. Vérification du type MIME réel et de la taille côté serveur ; retrait des métadonnées EXIF (GPS compris).
4. Signalement accessible depuis profil, conversation, appel et story.
5. Délai cible de traitement : 24 h pour un signalement standard, 2 h pour un mineur suspecté ou une menace.
6. Décisions de modération tracées (qui, quoi, pourquoi) ; possibilité de contestation.

### Antifraude et anti-spam
1. Score de risque par utilisateur (`risk_events`) : photos dupliquées, âge incohérent, activité en rafale, nombreux signalements, pays incohérents.
2. Seuils : 3 signalements distincts → revue ; score élevé → limitation puis suspension.
3. Limite de nouvelles conversations par jour (valeurs à calibrer), détection de messages identiques en masse.
4. Alerte « demande d'argent » dans la conversation à partir de mots clés (liste maintenue).
5. Vérification de profil par selfie guidé pour obtenir le badge ; le badge n'est pas une garantie d'identité et ne doit pas être présenté comme telle.

### Application mobile
1. Jetons stockés dans le trousseau sécurisé (Keychain / Keystore via `expo-secure-store`), jamais dans AsyncStorage.
2. TLS obligatoire ; épinglage de certificat à étudier plutôt qu'imposer.
3. Pas de secrets dans le binaire (clés LiveKit, RevenueCat privée, etc.).
4. Journaux sans données personnelles.
5. Masquage de l'aperçu dans le sélecteur d'applications (option) pour les conversations.

### Infrastructure
1. Serveur : accès SSH par clé, pare-feu (80, 443), mises à jour de sécurité automatiques. **Docker contourne `ufw`** (règles iptables propres) : ne publier aucun port de base de données ni de Redis, utiliser un réseau Docker interne, lier tout port de débogage à `127.0.0.1`, filtrer par la chaîne `DOCKER-USER`, et inclure un scan de ports depuis l'extérieur dans la liste de mise en production. LiveKit est hébergé à part : ses ports ne sont pas ouverts sur le serveur de l'API.
2. Secrets en variables d'environnement hors dépôt, rotation planifiée ; `gitleaks` en CI.
3. Sauvegardes chiffrées de PostgreSQL chaque nuit, **test de restauration mensuel**.
4. Buckets R2 privés ; accès uniquement par URL signées.
5. Dépendances surveillées (Dependabot, `composer audit`, `npm audit`).

### Paiements
1. Les reçus sont validés par RevenueCat ; le serveur ne fait jamais confiance à un état de paiement fourni par l'app.
2. Webhooks authentifiés, idempotents, rejouables.
3. Crédits gérés par un registre en ajout seulement (`credit_ledger`) ; ajustements manuels motivés et audités.

## Compléments issus de la relecture indépendante (2026-11-05)

1. **Délais de modération alignés** : signalement standard 24 h ; menace ou **mineur suspecté** 2 h (suspension préventive immédiate). Un seul délai par catégorie dans tous les documents.
2. **Ressources humaines** : modération assurée dans les deux langues (fr, en) sur plusieurs fuseaux ; le coût et l'astreinte sont à chiffrer avant le lancement (voir plan de coûts). Preuves sensibles à accès restreint (pas de visionnage par tous les modérateurs) et journalisées.
3. **Contenu illégal** : procédure écrite de signalement aux autorités par pays, hachage de contenus connus avec un prestataire de classification qui gère aussi les contenus d'abus d'enfants, durée de conservation des preuves définie avec un juriste.
4. **Filtrage de texte** : messages, bio et noms passent par un filtre fr/en (insultes, sollicitation sexuelle, liens, demandes d'argent) en plus du filtrage des images.
5. **Contestation** : l'utilisateur sanctionné est informé du motif (`GET /me/sanctions`, notification `sanction.created`) et peut contester une fois (`POST /appeals`).
6. **Âge** : contrôle **avant** création du compte, refus mémorisé par hash (appareil, identifiant social), purge des données de l'inscription refusée. Aucune promesse « zéro mineur » dans les CGU : signaux complémentaires (photos, texte, signalements).
7. **Comptes d'administration** : table `staff_users` séparée, 2FA obligatoire, accès à Filament seulement, interdits sur l'app mobile. Matrice des droits : modérateur (médias, signalements), support (tickets, lecture limitée), admin (tout, y compris crédits, avec motif).
8. **Journal d'audit** : table append-only par déclencheur (testé) ; la consultation d'une conversation par un modérateur est journalisée.
9. **Géolocalisation** : distance affichée par tranches, pas de tri ni filtre sensible à l'unité, plafond de requêtes de découverte, chiffrement du disque et des sauvegardes.
10. **Suppression de compte** : ré-authentification adaptée au mode de connexion (jeton frais du fournisseur pour les comptes sociaux), révocation des jetons Apple / TikTok, page web de demande de suppression (exigée par les stores, à vérifier), anonymisation plutôt que suppression des lignes liées aux signalements et sanctions, hash conservés pour empêcher le retour d'un utilisateur banni.
11. **Marchés** : une matrice marché × obligation (RGPD et DSA en UE, Loi 25 au Québec, PIPEDA au Canada, CCPA/CPRA en Californie, lois africaines applicables, retrait d'images intimes non consenties aux États-Unis) doit être établie **par un juriste** avant le gate G3. Cette liste n'est pas exhaustive et n'est pas un avis juridique.

## Critères d'acceptation (gate sécurité)

| # | critère | preuve attendue |
| --- | --- | --- |
| S1 | Aucun accès à la donnée d'autrui | suite de tests d'autorisation (Pest) verte |
| S2 | Limites de débit actives | tests qui obtiennent 429 |
| S3 | Pas de secret dans le dépôt | rapport `gitleaks` propre |
| S4 | Dépendances sans vulnérabilité critique | rapports `composer audit` / `npm audit` |
| S5 | Médias non approuvés invisibles | test d'API |
| S6 | Mineur suspecté traité en priorité | test du flux + procédure écrite |
| S7 | Journal d'audit immuable | test : tentative de modification refusée |
| S8 | Sauvegarde restaurée | procès-verbal de restauration |
| S9 | Revue indépendante | rapport de l'Independent Reviewer sans point bloquant |

## Questions juridiques à faire valider par un professionnel

Traitement de données sensibles (origine, relations), transferts internationaux (utilisateurs en Afrique, UE, Amérique du Nord), obligations de signalement de contenus illégaux selon les pays, mentions légales et conditions d'abonnement. Ce document n'est pas un avis juridique.
