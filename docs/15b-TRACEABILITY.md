# Matrice de traçabilité : exigence → épopée → test

Générée par script à partir de `03-FUNCTIONAL-SPECIFICATIONS.md` (colonnes : phase et origine telles que dans 03) et de l'affectation aux épopées de `15-BACKLOG.md`. Toute exigence sans épopée apparaît en fin de document.
Les noms de tests sont des **types** de test à écrire ; aucun test d'application n'existe encore.

| exigence | résumé | phase | origine | épopée | type de test |
| --- | --- | --- | --- | --- | --- |
| FR-A-1 | Inscription par email + mot de passe (≥ 10 caractères, vérifié contre les mots de passe courant… | A | C | A3 | Pest API + Maestro (parcours 1, 8) |
| FR-A-2 | Connexion Google et Apple ; TikTok en option | A/B | C (TikTok) | A3 (Google, Apple) ; B (TikTok) | Pest API + Maestro (parcours 1, 8) |
| FR-A-3 | Vérification de l'email par lien à usage unique (expire 24 h) | A | H | A3 | Pest API + Maestro (parcours 1, 8) |
| FR-A-4 | Vérification du téléphone par SMS (6 chiffres, expire 10 min, 5 essais max) | B | H | B5 | Pest API + Maestro (parcours 1, 8) |
| FR-A-5 | Récupération de compte par email (lien expire 1 h) | A | H | A3 | Pest API + Maestro (parcours 1, 8) |
| FR-A-6 | Sessions : jeton Sanctum à expiration glissante (30 jours d'inactivité, à confirmer par l'ADR 0… | A | H | A3 | Pest API + Maestro (parcours 1, 8) |
| FR-A-7 | Déconnexion révoque le jeton et le jeton push de l'appareil | A | H | A3 | Pest API + Maestro (parcours 1, 8) |
| FR-A-8 | Suppression du compte depuis les réglages : profil masqué tout de suite, données effacées sous … | A | C | A13 | Pest API + Maestro (parcours 1, 8) |
| FR-A-9 | Limitation des tentatives : 5 échecs de connexion par 15 min et par (email, appareil) | A | H | A3 | Pest API + Maestro (parcours 1, 8) |
| FR-A-10 | Écrans et parcours : mot de passe oublié, compte suspendu, refus d'âge, date de naissance (la s… | A | H | A17 | Pest API + Maestro (parcours 1, 8) |
| FR-A-11 | Suppression de compte avec ré-authentification adaptée (mot de passe ou jeton frais du fourniss… | A | H | A13 | Pest API + Maestro (parcours 1, 8) |
| FR-A-12 | Connexion d'un compte existant sans repasser par les consentements ni le contrôle d'âge (parcou… | A | H | A3 | Pest API + Maestro (parcours 1, 8) |
| FR-B-1 | Création du profil en onboarding : nom, date de naissance, genre, pays d'origine, pays de résid… | A | C | A6 | Pest API + Maestro |
| FR-B-2 | Biographie (500 caractères max) | A | H | A6 | Pest API + Maestro |
| FR-B-3 | 1 à 6 photos ; 1 photo principale ; ordre modifiable | A | H | A6 | Pest API + Maestro |
| FR-B-4 | Vidéo de profil (60 s max, 50 Mo max) | B | C | B6 | Pest API + Maestro |
| FR-B-5 | Préférences : genre recherché, tranche d'âge, pays, origines, intentions, rayon | A | C (origine, pays, intention) | A6 | Pest API + Maestro |
| FR-B-6 | Vérification de profil par selfie guidé comparé aux photos (revue humaine au début) | B | C (profils vérifiés) | B2 | Pest API + Maestro |
| FR-B-7 | Paramètres de confidentialité : masquer mon profil, masquer ma distance, masquer ma dernière co… | A | C (masquer profil) | A6 | Pest API + Maestro |
| FR-B-8 | Toute photo ou vidéo reste invisible tant qu'elle n'est pas approuvée | A | H | A6 | Pest API + Maestro |
| FR-B-9 | Qualité vidéo adaptative (240p, 360p, 480p) et mode économie de données ; plafonds de poids par… | A/B | H | B6 | Pest API + Maestro |
| FR-C-1 | Flux de découverte : cartes à swiper (like, dislike, super-like optionnel) | A | C (Explore) | A7 | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-C-2 | Filtres : âge, pays de résidence (y compris un autre pays), origine, intention, vérifié uniquem… | A | C | A7 | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-C-3 | Match réciproque : si A like B et B like A, une conversation est créée et les deux sont notifiés | A | H | A7 | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-C-4 | Un profil déjà vu, bloqué, masqué ou non conforme n'est jamais reproposé | A | H | A7 | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-C-5 | Suggestions quotidiennes classées par compatibilité (intention, pays, préférences) | B | H | B7 | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-C-6 | Annuler le dernier dislike (Premium) | B | H | B7 | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-C-7 | (fusionné dans FR-C-9) | B | H | B7 (fusionné dans FR-C-9) | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-C-8 | **Déplacé en phase E** : singles à proximité (localisation, migration PostGIS, revue stores) | E | C | E3 | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-C-9 | Limite quotidienne de likes pour les comptes gratuits (valeur initiale à fixer, stockée dans `d… | B | H | B7 | Pest (concurrence, autorisation) + Maestro (parcours 2, 4) |
| FR-D-1 | Conversation privée entre deux utilisateurs avec match ou conversation débloquée | A | C | A9 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-2 | Messages texte (2 000 caractères max) avec idempotence par `client_id` | A | C | A9 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-3 | Accusés d'envoi, de remise et de lecture | A | H | A9 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-4 | Présence : en ligne / dernière connexion (désactivable) | A | H | A9 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-5 | Indicateur « écrit… » | B | H | A9 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-6 | Images dans la conversation (modérées) | B | H | B6 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-7 | Vidéos courtes (30 s) | C | H | C3 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-8 | Notes vocales (2 min max) | C | H | C3 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-9 | Notifications push pour nouveau message, match, invitation | A | C | A9 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-10 | Historique paginé, recherche non incluse en V1 | A | H | A9 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-D-11 | Demandes de conversation : un non-match peut écrire en consommant un crédit « Conversation » | B | C (achat « Conversation ») | B1 | Pest (canaux) + Maestro (parcours 3) ; appels : test manuel sur 2 appareils (parcours 9) |
| FR-E-1 | Appel vidéo depuis une conversation | D | C | D3 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-2 | Appel audio | D | H | D3 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-3 | Signalisation de l'appel (sonnerie, accepter, refuser, occupé) via Reverb + jeton LiveKit éphém… | D | H | D2 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-4 | Permissions micro et caméra demandées au moment de l'appel avec explication | D | H | D3 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-5 | Reconnexion automatique si le réseau tombe (30 s), puis fin propre | D | H | D4 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-6 | Appel manqué : message dans la conversation + notification | D | H | D4 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-7 | Pas d'enregistrement des appels | D | H | D2 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-8 | Bouton de signalement pendant l'appel | D | H | D5 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-9 | Appel limité à 20 minutes, 480p par défaut, réservé aux matchs ; avertissement 2 minutes avant … | D | H | D4 | Pest (jetons) + test manuel réseau dégradé |
| FR-E-10 | Appel entrant app fermée : push VoIP + CallKit (iOS), notification d'appel plein écran (Android… | D | H | D0 | Pest (jetons) + test manuel réseau dégradé |
| FR-F-1 | Publication de story photo ou vidéo (15 s), expire après 24 h | C | C | C1 | Pest API + Maestro |
| FR-F-2 | Visionnage par les profils autorisés ; le publieur voit la liste des spectateurs | C | H | C1 | Pest API + Maestro |
| FR-F-3 | Réaction par emoji | C | H | C1 | Pest API + Maestro |
| FR-F-4 | Suppression immédiate par l'auteur | C | H | C1 | Pest API + Maestro |
| FR-F-5 | Visibilité : tous, matchs seulement, ou liste choisie | C | H | C1 | Pest API + Maestro |
| FR-F-6 | Invitations vidéo (activité, ville, date) visibles dans un fil filtré par pays | C | C | C2 | Pest API + Maestro |
| FR-G-1 | Abonnement Premium : 1, 3 et 12 mois, via achat in-app (décision propriétaire E4) | B | C | B1 | Pest (idempotence, remboursement) + sandbox stores (parcours 6, 7) |
| FR-G-2 | Achat ponctuel : crédits « Conversation ». Le pack « Propositions » est hors lancement tant qu'… | B | C | B1 | Pest (idempotence, remboursement) + sandbox stores (parcours 6, 7) |
| FR-G-3 | Cadeaux virtuels achetés avec des crédits, envoyés dans une conversation | E | C | E1 | Pest (idempotence, remboursement) + sandbox stores (parcours 6, 7) |
| FR-G-4 | Historique des transactions visible par l'utilisateur | B | H | B1 | Pest (idempotence, remboursement) + sandbox stores (parcours 6, 7) |
| FR-G-5 | Restaurer les achats | B | C (exigence des stores) | B1 | Pest (idempotence, remboursement) + sandbox stores (parcours 6, 7) |
| FR-G-6 | Remboursement : suit les remboursements Apple / Google ; les crédits sont repris | B | H | B1 | Pest (idempotence, remboursement) + sandbox stores (parcours 6, 7) |
| FR-G-7 | Protection contre les doubles transactions (clé d'idempotence par transaction) | B | H | B1 | Pest (idempotence, remboursement) + sandbox stores (parcours 6, 7) |
| FR-G-8 | Déblocage gratuit de crédits (invitation d'amis, défis) | E | T | E2 | Pest (idempotence, remboursement) + sandbox stores (parcours 6, 7) |
| FR-H-1 | Tableau de bord : inscriptions, actifs, signalements ouverts, revenus | A/B | H | A12 | Pest (Filament) + test d'audit |
| FR-H-2 | Gestion des utilisateurs : recherche, suspension, bannissement, réactivation | A | H | A12 | Pest (Filament) + test d'audit |
| FR-H-3 | File de vérification de profils | B | H | B2 | Pest (Filament) + test d'audit |
| FR-H-4 | File de modération des médias (approuver / rejeter) | A | H | A12 | Pest (Filament) + test d'audit |
| FR-H-5 | File de signalements, résultats : avertissement, suspension, bannissement | A | C | A12 | Pest (Filament) + test d'audit |
| FR-H-6 | Gestion des abonnements et des crédits (ajustement manuel, avec motif) | B | H | B1 | Pest (Filament) + test d'audit |
| FR-H-7 | Journal d'audit **immuable** de toute action d'administrateur | A | H | A12 | Pest (Filament) + test d'audit |
| FR-H-8 | Statistiques et export CSV | B | H | B8 | Pest (Filament) + test d'audit |
| FR-H-9 | Rôles : modérateur, support, administrateur, avec 2FA obligatoire | A | H | A12 | Pest (Filament) + test d'audit |
| FR-I-1 | Blocage et signalement depuis profil, conversation et appel | A | C | A11 | Pest (autorisation, limites) + procédure écrite |
| FR-I-2 | Motifs de signalement : demande d'argent, harcèlement ou menaces, comportement inapproprié en r… | A | C | A11 | Pest (autorisation, limites) + procédure écrite |
| FR-I-3 | Modération automatique des images (service de classification) puis revue humaine des cas limites | B | H | B3 | Pest (autorisation, limites) + procédure écrite |
| FR-I-4 | Détection de faux profils : signaux (photos réutilisées, âge incohérent, activité en rafale, si… | B | H | B4 | Pest (autorisation, limites) + procédure écrite |
| FR-I-5 | Anti-spam : limite de nouvelles conversations par jour, détection de messages identiques en mas… | A | H | B4 | Pest (autorisation, limites) + procédure écrite |
| FR-I-6 | Alerte « demande d'argent » : message d'avertissement affiché dans la conversation si des mots … | B | H | B4 | Pest (autorisation, limites) + procédure écrite |
| FR-I-7 | Protection des mineurs : 18+ strict, signalement spécifique « mineur suspecté », suspension imm… | A | C (politique zéro tolérance dans les CGU) | A11 | Pest (autorisation, limites) + procédure écrite |
| FR-I-8 | Données personnelles : consentement explicite, export et suppression à la demande, minimisation | A | H | A16 | Pest (autorisation, limites) + procédure écrite |
| FR-I-9 | Chiffrement en transit (TLS) partout ; secrets hors dépôt | A | H | A1 | Pest (autorisation, limites) + procédure écrite |
| FR-I-10 | Filtrage de texte (messages, bio, nom) fr / en en plus du filtrage des images | A | H | A11 | Pest (autorisation, limites) + procédure écrite |
| FR-I-11 | Notification de sanction avec motif et contestation unique (`POST /appeals`) | A | H | A16 | Pest (autorisation, limites) + procédure écrite |
| FR-I-12 | Contrôle d'âge **avant** création du compte : `POST /auth/age-check` renvoie un jeton signé cou… | A | H | A3 | Pest (autorisation, limites) + procédure écrite |
| FR-I-13 | Export des données personnelles à la demande (`POST /me/export`) | A | H | A16 | Pest (autorisation, limites) + procédure écrite |
| FR-I-14 | Consentements enregistrés et révocables (CGU, confidentialité, données sensibles, localisation,… | A | H | A16 | Pest (autorisation, limites) + procédure écrite |
| FR-I-15 | Page web publique de demande de suppression de compte (exigence des stores, à vérifier), confir… | A | H | A16 | Pest (autorisation, limites) + procédure écrite |
| FR-Z-1 | Interface en français et en anglais, langue choisie selon le téléphone puis modifiable (`users.… | A | H | A0 | Jest (clés de traduction) + Maestro en/fr |
| FR-Z-2 | Notifications push, e-mails, SMS et textes légaux dans la langue de l'utilisateur | A | H | A0 | Jest (clés de traduction) + Maestro en/fr |
| FR-Z-3 | Filtres de modération et mots-clés (« demande d'argent », insultes) maintenus par langue (fr, e… | A | H | A0 | Jest (clés de traduction) + Maestro en/fr |

Exigences : 92. Sans épopée : 0 []. Épopées citées sans exigence dans 03 : [].
