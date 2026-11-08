# Phase 0 : analyse concurrentielle d'Ayelo

Version 1, 2026-11-08. Livrable de recherche de la phase 0 de `docs/design/PROMPT-UIUX-EXPERT.md` (sections 1 à 5). Il alimentera `docs/design/00-audit.md`. Aucune identité visuelle, aucun texte et aucune image d'une autre application n'est repris : on observe des mécanismes, on ne copie rien. Chat&Yamo est l'application étudiée à l'origine du projet ; elle figure ici comme un concurrent parmi d'autres.

## 1. Méthode, limites et conventions

**Ce qui a été consulté.** Fiches publiques de l'App Store (lues en entier avec un outil de lecture de page), pages d'avis Trustpilot, articles de presse et de blogs spécialisés, pages de données de marché (DataReportal, GSMA, Statista, FTC, Centre antifraude du Canada). Chaque affirmation porte l'adresse consultée entre parenthèses ou dans le tableau des sources de la section 11.

**Limites à connaître avant de s'appuyer sur ce document.**

1. Les centres d'aide de Tinder, Hinge et Bumble ont répondu « 403 Forbidden » à la lecture directe. Leur contenu (vérification de photo, vérification d'identité, contrôles d'âge) n'a été vu que par les extraits renvoyés par le moteur de recherche. Ces affirmations sont marquées « (extrait de recherche) » : à confirmer en ouvrant la page dans un navigateur.
2. Google Play n'a pas pu être lu (page tronquée ou connexion coupée). Les notes ci-dessous viennent de l'App Store. Les notes Android de Chat&Yamo (environ 3,93 sur 12,2 mille avis, 2 millions d'installations) ne proviennent que d'un traqueur tiers cité par un moteur de recherche, sans page lue : indicatif seulement.
3. Les notes de l'App Store sont un instantané du jour de la consultation et varient selon le pays de la boutique.
4. La longueur du parcours d'inscription (nombre d'écrans ou de questions) n'a presque jamais pu être établie sans installer les applications. Là où elle n'est pas sourcée, la cellule indique « non établi ». Action recommandée : parcours d'inscription réalisé à la main sur Android d'entrée de gamme pour chaque application, avec captures conservées hors dépôt.
5. Les avis cités sont des témoignages individuels, pas des statistiques. Un avis négatif prouve qu'un utilisateur a vécu un problème, pas sa fréquence.
6. Aucun chiffre n'est inventé. Tout ce qui n'est pas sourcé est étiqueté « hypothèse ».

**Applications retenues.** Ciblage Afrique ou diaspora africaine : Chat&Yamo, AfroIntroductions, Ruut, Moyyo. Généralistes : Hily, Badoo, Tinder, Bumble, Hinge. Marché francophone : Meetic, happn. Confiance communautaire et mariage : Muzz. **Écartées faute de source exploitable** : Coffee Meets Bagel, Feeld (seulement mentionné pour son contrôle d'âge), Parship, Ayoba. Ayoba est une messagerie, pas une application de rencontres : hors périmètre. Ruut et Moyyo existent, mais leur activité actuelle n'est pas établie (voir leurs fiches) ; elles sont analysées comme signaux, pas comme références.

## 2. Fiches par application

### 2.1 Chat&Yamo (application d'origine, Cameroun)

- **Positionnement.** Rencontres sérieuses, recherche « par pays ou origine de la diaspora », intentions mariage, relation durable, flirt, amitié ; invitations vidéo pour une sortie ; coaching et événements. Éditeur Affinity Square US Inc. (fiche App Store : https://apps.apple.com/us/app/id1339782074).
- **Inscription.** Non établi.
- **Contrôle d'âge.** Classe 18+ affichée. Méthode non établie.
- **Confiance.** La fiche dit « Verified profiles » dans les nouveautés, sans décrire la méthode (https://apps.apple.com/us/app/id1339782074). Aucune vérification documentée.
- **Découverte.** Recherche par pays ou origine, intention (même fiche).
- **Discussion.** Appel vidéo dans l'application pour « préciser attentes et besoins avant d'échanger les numéros » (même fiche et https://www.chat-yamo.com/?p=3006 via résultats de recherche).
- **Monétisation.** Gratuit avec achats intégrés : Premium 7,99 $, Premium 1 mois 9,99 $, 3 mois 19,99 $, Pack SOLO 9,99 et 29,99 $, Pack PREMIUM PLUS 24,99 $, Pack DIASPORA ELITE 17,99 $, « Conversation » 0,99 $ (intitulé seul : le mécanisme exact n'est pas décrit, hypothèse : achat à l'unité) (https://apps.apple.com/us/app/id1339782074).
- **Accessibilité.** Aucune fonction déclarée par l'éditeur (même fiche).
- **Langue.** Français seul sur l'App Store (même fiche).
- **Note et avis.** 4,2 sur 1,1 mille notes (App Store, même fiche). Un avis du 02/09/2025 demande de prendre en charge le Mobile Money, très utilisé au Ghana (même fiche) : c'est le seul signal sourcé de la demande de paiement local dans ce corpus.

### 2.2 AfroIntroductions (Cupid Media, panafricain)

- **Positionnement.** « Meet African Singles Online », pool panafricain, revendique plus de 4,5 millions de membres (auto-déclaré, non audité) (https://apps.apple.com/app/id1597869513 ; résultats de recherche).
- **Inscription / contrôle d'âge.** Non établis. Classe 18+ avec « Age Assurance » listé dans les contrôles de l'App Store.
- **Confiance.** « Algorithmes avancés » contre les profils frauduleux, outil de signalement, assistance 24 h sur 24 revendiquée (même fiche). Aucune vérification de photo ou d'identité décrite.
- **Monétisation.** Gratuit au téléchargement. Platinum 1 semaine 19,99 $, 1 mois 39,99 $, 3 mois 79,99 $, 12 mois 169,99 $ ; Gold 1 semaine 17,99 $, 3 mois 67,99 $, 12 mois 134,99 $ (plusieurs lignes contradictoires pour le mois et l'année) (même fiche). Un avis de 2022 affirme que les deux membres doivent payer pour discuter ; l'éditeur répond qu'un seul suffit : la fiche ne tranche pas.
- **Langue.** Anglais seul (même fiche).
- **Note et avis.** 4,5 sur 13 mille (App Store). Sur Trustpilot : 2,3 sur 5, 804 avis, 45 % de 5 étoiles et 22 % de 1 étoile ; les plaintes récurrentes sont les faux profils et arnaqueurs, des comptes suspendus après paiement, et l'absence de réponse du support ; l'entreprise ne répond pas aux avis négatifs selon Trustpilot (https://ca.trustpilot.com/review/www.afrointroductions.com). Avis App Store de 2022 et 2025 : demandes d'argent, billets d'avion, passage forcé sur WhatsApp (https://apps.apple.com/app/id1597869513). L'éditeur répond par un renvoi vers l'outil de signalement.

### 2.3 Ruut (diaspora africaine, activité à vérifier)

- **Positionnement.** « Espace conçu pour les Africains de la diaspora » (Instagram de l'éditeur, cité par https://www.deedsmag.com/stories/the-new-dating-app-for-the-african-diaspora-genuine-or-a-rug-pull-an-honest-review). Marque déposée le 16 mars 2025 par TidyHub Technology Inc. (même article). Aucune date de publication n'est visible dans l'article ; l'état actuel du service n'a pas pu être confirmé.
- **Inscription.** Questions très précises sur le contexte culturel ; pas de taille, de morphologie ni de couleur des yeux (même article).
- **Confiance.** Aucun contrôle d'identité décrit ; règles antifraude dans les conditions mais doutes des auteurs sur leur application ; profil suspecté d'être généré par IA signalé sans confirmation (même article). Les profils peuvent être capturés en écran et les réseaux sociaux des membres sont faciles à retrouver (même article).
- **Monétisation.** Annoncé gratuit, mais limites gratuites très serrées : environ 20 balayages par 24 h et environ 15 messages après un match avant une attente de 24 h (même article).
- **Constat de l'article.** Fondateur non identifié, correspondance strictement femme vers homme, profil de test supprimé sans explication.

### 2.4 Moyyo (diaspora africaine, activité à vérifier)

- **Positionnement.** « Connecting African Diaspora », éditeur Fonkka ; la description cite amharique, swahili, yoruba, haoussa, français, arabe (fiche : https://apps.apple.com/lb/app/moyyo/id6476918792).
- **Confiance.** « Chaque utilisateur est vérifié » (affirmation de la fiche, méthode non décrite), messagerie chiffrée, navigation incognito (même fiche).
- **Monétisation.** Neuf lots à 0,99 $ dont le contenu n'est pas expliqué (même fiche).
- **Note.** Pas assez d'avis pour afficher une note ; langue de l'App Store : anglais seul malgré la liste de langues de la description (même fiche). Signal faible : à ne pas utiliser comme référence.

### 2.5 Muzz (mariage, communauté musulmane)

- **Positionnement.** « Where Muslims Marry », mariage (https://apps.apple.com/us/app/muzz-where-muslims-marry/id969997496).
- **Contrôle d'âge / inscription.** Selfie de vérification obligatoire à l'inscription pour tous (https://muzz.com/muslim-dating-app/ ; fiche App Store). Nombre d'écrans non établi.
- **Confiance.** Chaque profil vérifié par selfie ; vérification d'identité facultative avec badge bleu ; équipe d'aide dédiée ; profil et photos masquables ; captures d'écran bloquées ; **tuteur (wali) ajoutable à la conversation** ; pseudonyme possible ; badges de bonne conduite évalués par la communauté ; conseils pour un premier rendez-vous (lieu public, prévenir un proche). La page ne contient aucun avertissement anti-arnaque spécifique (https://muzz.com/muslim-dating-app/).
- **Découverte.** Filtres, mode voyage (résultats de recherche : https://propakistani.pk/2024/05/17/muzz-is-putting-rishta-aunties-out-of-business/ ).
- **Discussion.** Appel audio et vidéo sans partager son numéro (https://muzz.com/muslim-dating-app/).
- **Monétisation.** Gratuit sans achat ; Gold hebdomadaire à annuel ; prix listés de 9,99 $ à 41,99 $, périodes non appariées dans la fiche ; Compliment 4,99 $ ; Premium 19,99 $ (fiche App Store). Un site tiers affirme qu'environ 10 % des membres paient (miroir Wikipédia via résultats de recherche : non vérifié).
- **Langues.** 15 : anglais, arabe, bengali, néerlandais, français, allemand, hindi, indonésien, italien, malais, persan, russe, espagnol, turc, ourdou (fiche App Store).
- **Note et avis.** 4,5 sur 55 mille. Avis négatifs : filtres d'ethnicité jugés réducteurs (2025) ; notification de visite de profil jugée gênante (2019) (fiche App Store). Un utilisateur dit avoir été banni en une journée sans explication (résultats de recherche, App Store).

### 2.6 Hily

- **Positionnement.** Rencontres avec questionnaire de compatibilité et brise-glaces personnalisés (https://apps.apple.com/us/app/hily-dating-app-meet-date/id1250946975).
- **Inscription.** Le questionnaire de compatibilité compte 10 à 40 questions ; le nombre d'écrans d'inscription n'est pas indiqué (https://www.swipestats.io/blog/hily-review, source unique).
- **Confiance.** « Profile Verification & Safety Team » (fiche App Store). Vérification par selfie avec une pose imposée, comparée aux photos ; Consent Guard (octobre 2025) contre le contenu explicite non sollicité ; score de risque pouvant bloquer les contacts suspects (swipestats, source unique).
- **Découverte.** Profils floutés pour les « J'aime » reçus (déblocage payant) ; filtre de distance en dessous de 31 miles payant (swipestats).
- **Monétisation.** Gratuit pour apparier et écrire aux appariés (fiche). Premium « 7 jours gratuits puis 14,99 $ », Elixir 19,99 $, Premium+ 1 semaine 24,99 $, boost 5,99 à 9,99 $, « 1 unblur » 4,99 $ (fiche). Selon swipestats : essai de 7 jours qui bascule dans le forfait hebdomadaire le plus cher, résiliation à faire à deux endroits (l'application et la boutique), achats intégrés cumulés à l'abonnement, publicités à croix minuscule.
- **Langues.** Anglais et 16 autres (fiche).
- **Note et avis.** 4,4 sur 389 mille. Avis : « va vous harceler pour de l'argent plus que toute autre plateforme » (18/07/2023), modération automatique de photos trop stricte (05/05/2021), filtres de genre et de rayon peu fiables (14/10/2020), points positifs : niveau gratuit généreux, appel dans l'application pour vérifier une personne (19/11/2023) (fiche App Store).

### 2.7 Badoo

- **Positionnement.** Rencontres et amitiés, appel vidéo (https://apps.apple.com/gb/app/badoo-dating-app-friends/id351331194).
- **Contrôle d'âge.** Classe 18+ avec « Age Assurance » listé ; méthode non établie.
- **Confiance.** Vérification de photo en trois étapes, option « n'interagir qu'avec des profils vérifiés », « Private Detector » (détection IA de photos explicites floutées au choix) et « Deception Detector » contre faux comptes, arnaques et spam (fiche). La vérification par selfie existe depuis 2016 (https://techcrunch.com/2016/03/25/badoo-launches-photo-verification-for-safer-more-efficient-online-dating/amp).
- **Monétisation.** Premium 4,49 à 6,99 £, 7 jours 9,99 £, crédits 0,99 à 7,99 £ ; la fiche précise que le prix « varie selon le pays » et que le renouvellement est automatique sauf désactivation 24 h avant la fin (fiche).
- **Langues.** Anglais et 38 autres, dont le français (fiche).
- **Note et avis.** 4,5 sur 41 mille. Les quatre avis affichés sont négatifs : « 90 % de faux profils » (20/01/2024) ; « même Premium payé, impossible d'écrire sans acheter des crédits » (05/08/2024) ; l'éditeur répond en citant la vérification de photo et la modération 24 h sur 24 (fiche).

### 2.8 Tinder

- **Positionnement.** Généraliste de masse (https://apps.apple.com/us/app/tinder-dating-app-date-chat/id547702041).
- **Contrôle d'âge.** « Age Assurance » listé. Au Royaume-Uni, reconnaissance faciale à partir d'un portrait traité automatiquement (https://www.globaldatinginsights.com/featured/uk-dating-apps-adopt-age-verification-ahead-of-online-safety-law/, 24 juillet 2025).
- **Confiance.** Vérification de photo par selfie vidéo, facultative ; vérification d'identité + photo en test dans certains marchés ; l'éditeur dit que cela ne garantit ni la validité d'un document, ni l'identité, ni la sécurité (extrait de recherche : https://www.help.tinder.com/hc/en-us/articles/19868368795917-ID-Photo-Verification ; https://www.help.tinder.com/hc/en-us/articles/4422771431309). Une capture tierce du parcours montre une étape « Face Check » avec option de l'ignorer (https://revyl-landing.pages.dev/atlas/tinder/flows/sign-up-defer-face-check-land-on-home/, source faible).
- **Monétisation.** J'aime, appariement et discussion gratuits ; Plus 9,99 $, Gold 13,99 à 24,99 $, Boost 3,99 à 7,99 $, Super Likes (fiche). Périodes non affichées dans la fiche.
- **Langues.** Anglais et 54 autres, dont le français (fiche).
- **Note et avis.** 4,2 sur 1,8 million. Avis : comptes faux, inactifs ou hors zone (03/04/2022), bannissements jugés injustes, ombre-bannissement allégué (14/08/2023) (fiche).

### 2.9 Bumble

- **Positionnement.** Les femmes écrivent en premier dans les rencontres hétérosexuelles ; un match expire en 24 h s'il n'y a pas de message (https://apps.apple.com/us/app/bumble-dating-app-meet-date/id930441707 ; fiche britannique via résultats de recherche).
- **Confiance.** « Get ID Verified » (pièce d'identité + selfie en direct, comparé via le prestataire Veriff, badge, marchés limités, conservation par le prestataire jusqu'à 72 h) (extrait de recherche : https://support.bumble.com/hc/en-us/articles/28785291893917-Verifying-with-your-ID ; https://www.biometricupdate.com/202503/bumble-adds-veriff-id-verification). Partage de rendez-vous, signalement, Safety Center (fiche).
- **Monétisation.** Boost 2,99 à 12,99 $, Premium 17,99 à 32,99 $, pièces 1,99 $ ; « Bumble est gratuit, mais ces services premium… » (fiche).
- **Langues.** Anglais et 17 autres, dont le français (fiche).
- **Note et avis.** 4,3 sur 1,8 million. Positif : « le plus sûr », moins de faux profils (23/08/2024, 14/09/2025). Négatif : délai de 24 h qui fait disparaître les matchs, poussée vers l'abonnement, biographie limitée à 300 caractères (fiche).

### 2.10 Hinge

- **Positionnement.** « Application conçue pour être effacée », profils de personnalité (texte, photo, vidéo, voix) (https://apps.apple.com/us/app/hinge-dating-app-match-date/id595287172).
- **Contrôle d'âge.** Âge estimé à partir du visage, parfois complété par un signal de la boutique d'applications ; « Face Check » obligatoire dans certaines régions (extrait de recherche : https://help.hinge.co/hc/en-us/articles/42464185429651-Age-Checks-at-Hinge ; https://help.hinge.co/hc/en-us/articles/45715796564243-Face-Check-Scan). Selon un article tiers, données de scan conservées jusqu'à un an et image de vérification trois mois au Royaume-Uni (globaldatinginsights, lien ci-dessus).
- **Confiance.** Vérification par selfie facultative, badge ; gabarit facial non conservé au-delà de la vérification, selon l'éditeur (extrait de recherche : https://help.hinge.co/hc/en-us/articles/10303221435539-What-is-Selfie-Verification-).
- **Monétisation.** « L'application est gratuite » ; Hinge+ voit tous les J'aime ; HingeX priorise ; abonnements 14,99 à 34,99 $, Hinge+ 16,99 et 19,99 $, Membership 19,99 $ ; roses 9,99 à 29,99 $ ; renouvellement automatique sauf désactivation 24 h avant (fiche).
- **Langues.** Anglais et 11 autres, dont le français (fiche).
- **Note et avis.** 4,4 sur 1,1 million. Avis négatif : bannissement d'un membre payant sans avertissement, appel refusé par décision automatique « finale » (15/12/2021) (fiche).

### 2.11 Meetic (France)

- **Positionnement.** Rencontres sérieuses, formules Essentiel, Premium, Prestige (https://apps.apple.com/fr/app/meetic-appli-de-rencontre/id416973595).
- **Confiance.** « Profils modérés ». Mention honnête : « Toutes les photos montrent des modèles » (illustration seulement) (fiche).
- **Monétisation.** Création de profil gratuite ; Premium 1 semaine 24,99 €, 1 mois 39,99 €, 6 mois 79,99 € (fiche). Une autre fiche indique que le chat nécessite en général un abonnement (https://apps.apple.com/fr/app/meetic-relationship-and-love/id416973595?l=en-GB, extrait de recherche). Reconduction automatique « au même prix et pour la même durée » (https://apps.apple.com/fr/app/meetic-rencontre-c%C3%A9libataires/id416973595?l=en, extrait de recherche).
- **Langues.** Français et 19 autres (fiche).
- **Note et avis.** 3,9 sur 83 mille. Avis : visites de profil comptées même sans ouvrir le profil (27/06/2021), profils qui ne correspondent pas aux photos et comptes gratuits qui attirent les contacts non désirés (17/04/2024), impossibilité d'annuler un J'aime (11/07/2024) (fiche).

### 2.12 happn (France)

- **Positionnement.** Rencontres basées sur les croisements dans la vie réelle ; position invisible pour les autres ; J'aime secrets (https://apps.apple.com/fr/app/happn-appli-de-rencontre/id489185828).
- **Confiance.** « Dating 100 % sécurisé » sans méthode décrite ; aucune vérification d'identité décrite (même fiche).
- **Monétisation.** Abonnements de 10,99 à 39,99 €, 1 mois 19,99 €, boost 7,99 €, crédits 1,99 à 2,99 € ; renouvellement non indiqué dans la fiche (même fiche).
- **Note et avis.** 4,2 sur 189 mille. Avis : abonnement annuel coûteux et difficile à résilier (27/02/2020) ; mode invisible qui s'arrête en mode avion et expose le profil (31/10/2020) (même fiche).

## 3. Matrice comparative

« n. é. » signifie non établi par les sources consultées. Les notes sont celles de l'App Store (boutique américaine ou britannique selon la fiche).

| Application | Cible | Note App Store | Âge / contrôle d'âge | Vérification | Signalement et alertes arnaque | Gratuit | Prix visibles (fiche) | Dark pattern cité par des sources | Langues |
|---|---|---|---|---|---|---|---|---|---|
| Chat&Yamo | Afrique, diaspora | 4,2 (1,1 mille) | 18+, méthode n. é. | « Profils vérifiés », méthode n. é. | n. é. | Oui, limité | 7,99 à 29,99 $ | n. é. | Français |
| AfroIntroductions | Panafricain | 4,5 (13 mille) ; Trustpilot 2,3 | 18+, méthode n. é. | Algorithmes anti-fraude, pas de contrôle de photo décrit | Outil de signalement ; plaintes de non-suppression | Oui, limité | 17,99 à 169,99 $ | Comptes suspendus après paiement (avis) | Anglais |
| Ruut | Diaspora | n. é. | n. é. | Aucune décrite | Règles dans les conditions | Très limité | n. é. | Limites gratuites serrées | n. é. |
| Moyyo | Diaspora | Pas assez d'avis | 18+ | « Chaque utilisateur est vérifié », méthode n. é. | n. é. | Oui | Lots à 0,99 $ | Contenu des lots non expliqué | Anglais (App Store) |
| Muzz | Communauté musulmane, mariage | 4,5 (55 mille) | Selfie obligatoire à l'inscription | Selfie pour tous, pièce d'identité facultative | Équipe dédiée, conseils de rendez-vous, tuteur | Oui | 4,99 à 41,99 $ | Aucun cité par les sources | 15 |
| Hily | Généraliste | 4,4 (389 mille) | « Age Assurance » n. é. | Selfie avec pose | Consent Guard, score de risque | Oui | 4,99 à 24,99 $ | Essai vers forfait hebdomadaire, double résiliation, J'aime floutés | 17 |
| Badoo | Généraliste | 4,5 (41 mille) | Age Assurance listé | Photo en trois étapes ; Deception Detector | Private Detector ; 24 h sur 24 revendiqué | Oui | 0,99 à 9,99 £ | Crédits obligatoires même en Premium (avis) | 39 |
| Tinder | Généraliste | 4,2 (1,8 M) | Reconnaissance faciale au Royaume-Uni | Selfie vidéo ; identité en test | Outils de sécurité génériques | Oui | 3,99 à 24,99 $ | Bannissements opaques (avis) | 55 |
| Bumble | Généraliste, les femmes d'abord | 4,3 (1,8 M) | S'appuie sur la vérification existante | Identité + selfie, marchés limités | Partage de rendez-vous, Safety Center | Oui | 1,99 à 32,99 $ | Match qui expire en 24 h (avis) | 18 |
| Hinge | Relations durables | 4,4 (1,1 M) | Visage estimé, Face Check selon région | Selfie, badge | Signalement | Oui | 9,99 à 34,99 $ | Bannissement payant sans avertissement (avis) | 12 |
| Meetic | France, relations sérieuses | 3,9 (83 mille) | n. é. | Profils modérés | Signalement par modérateur | Création seulement | 24,99 à 79,99 € | Chat réservé aux abonnés (fiche tierce) | 20 |
| happn | France, croisements | 4,2 (189 mille) | n. é. | Aucune décrite | n. é. | Oui | 10,99 à 39,99 € | Abonnement difficile à résilier (avis 2020) | 14 |

## 4. Observations transversales

1. **La confiance est un argument, pas une preuve.** Les fiches des applications ciblant l'Afrique ou la diaspora (Chat&Yamo, Moyyo, AfroIntroductions) revendiquent des profils vérifiés ou des algorithmes anti-fraude sans décrire la méthode, alors que Muzz, Badoo, Bumble, Tinder et Hinge décrivent un mécanisme (selfie, pièce d'identité, détecteur). Sources : fiches App Store citées en section 2.
2. **Les plaintes sur les faux profils et les arnaques sont constantes chez les acteurs qui ne montrent pas de preuve visible de vérification** (AfroIntroductions, Badoo, Meetic, happn) et plus rares dans les avis cités de Bumble. Il s'agit de corrélations d'avis individuels, pas d'une mesure.
3. **Le renouvellement automatique est mentionné en toutes lettres** par Hinge et Badoo dans leurs fiches, et par une version de la fiche Meetic (extrait de recherche) ; la fiche Meetic lue en entier et celle de happn ne le disent pas, et l'extrait Hily lu non plus. Le signaler de façon visible près du bouton reste une exigence des boutiques et de la section 4 du prompt maître.
4. **L'achat par crédits en plus de l'abonnement** (Badoo, Hily) génère des avis de colère explicites. Les sources : fiches Badoo (05/08/2024) et swipestats pour Hily.
5. **Les bannissements sans explication ni recours clair** apparaissent dans les avis de Tinder, Hinge, Muzz et Ruut. Un avis Hinge du 15/12/2021 décrit un appel refusé par une décision automatique « finale » (fiche Hinge).
6. **Le contrôle d'âge par estimation faciale se généralise** sous la pression réglementaire au Royaume-Uni (Tinder, Hinge, Feeld via Yoti) depuis le 25 juillet 2025 (globaldatinginsights, lien en section 2.8). C'est un précédent, pas une obligation dans les marchés d'Ayelo.
7. **Aucune fiche lue ne déclare de fonction d'accessibilité.** Pour Chat&Yamo et AfroIntroductions, la fiche écrit que l'éditeur n'a pas indiqué ces fonctions. Pour les autres, ce point n'a pas été examiné rubrique par rubrique : non établi. L'accessibilité n'est donc pas, sur la base de ces sources, un différenciateur déjà occupé. Hypothèse : elle est sous-exploitée.

## 5. Dix motifs à adopter

| # | Motif | Origine observée | Principe d'Ayelo (section 4 du prompt maître) |
|---|---|---|---|
| 1 | Dire clairement ce que la vérification prouve et ne prouve pas (« ne garantit ni la validité du document ni l'identité ») | Tinder (extrait d'aide, section 2.8) | 1 Confiance, 2 Honnêteté |
| 2 | Selfie de vérification dès l'inscription et badge visible sur la carte | Muzz (https://muzz.com/muslim-dating-app/) | 1 |
| 3 | Pièce d'identité facultative, badge distinct, conservation courte annoncée | Bumble (72 h), Hinge (gabarit non conservé) | 1, vie privée |
| 4 | Option « n'interagir qu'avec les profils vérifiés » | Badoo (fiche) | 1 |
| 5 | Photos et noms masquables jusqu'à un choix, pseudonyme possible | Muzz (fiche) | 6 Culture, vie privée |
| 6 | Appel dans l'application avant tout échange de numéro | Muzz, Chat&Yamo, Hily (avis 19/11/2023) | Cohérent avec la promesse d'Ayelo « texte puis vidéo » |
| 7 | Conseils de premier rendez-vous (lieu public, prévenir un proche) au bon moment | Muzz (page), Bumble « Share Date » | 1 |
| 8 | Phrase « les photos sont des modèles » : être explicite sur les images de démonstration | Meetic (fiche) | 2 |
| 9 | Prix et reconduction automatique dans le texte même de l'offre | Hinge, Badoo (fiches) | 2 |
| 10 | Niveau gratuit où apparier et écrire aux appariés reste possible | Hily, Tinder (fiches) | 1 « la sécurité n'est jamais payante » |

## 6. Dix motifs à éviter

| # | Motif | Origine observée | Pourquoi |
|---|---|---|---|
| 1 | Affirmer « profils vérifiés » sans décrire la méthode ni ses limites | Chat&Yamo, Moyyo (fiches) | Perte de confiance, risque de promesse trompeuse |
| 2 | Essai gratuit qui bascule dans le forfait le plus cher, avec résiliation à deux endroits | Hily (swipestats, source unique) | Dark pattern |
| 3 | Cumuler abonnement et achats à l'unité pour fonctions de base (crédits, « unblur ») | Badoo (avis 05/08/2024), Hily (fiche) | Frustration, perception de piège |
| 4 | Flouter les J'aime reçus pour créer l'urgence | Hily (swipestats) | Pression psychologique |
| 5 | Verrouiller le chat derrière un abonnement avant toute valeur perçue | Meetic (fiche tierce) | Réduit l'essai, contredit « la sécurité n'est jamais payante » |
| 6 | Suspendre un compte payant sans motif ni recours lisible | AfroIntroductions (Trustpilot), Hinge (avis), Muzz (avis) | Perte de confiance, risque de contestation |
| 7 | Laisser les signalements sans retour visible | AfroIntroductions (Trustpilot, 24/10/2026) | Le signalement devient symbolique |
| 8 | Pousser les échanges vers WhatsApp sans avertissement | Avis AfroIntroductions (2022) | Mode opératoire d'arnaque cité par les victimes |
| 9 | Compteur d'expiration de match qui culpabilise | Bumble (avis 14/09/2025) | Principe 2 : un « non » ou un silence est neutre |
| 10 | Limites gratuites si serrées que le service est inutilisable | Ruut (Deeds Magazine) | Fausse gratuité |

## 7. Espaces qu'Ayelo peut occuper

Chaque ligne est une opportunité de différenciation, avec la preuve de l'espace laissé vacant par les concurrents analysés.

1. **Confiance pour la diaspora.** Aucune des applications africaines ou diaspora examinées ne décrit, dans les sources lues, une vérification de photo ou d'identité avec ses limites : les fiches affirment sans expliquer (sections 2.1 à 2.4). Hypothèse : une vérification expliquée en une phrase, un badge compréhensible et une limite honnête (« pas une garantie d'identité », déjà dans le prompt maître) seraient un avantage.
2. **Conscience des arnaques.** Les avis AfroIntroductions décrivent le scénario type : demande d'argent, billet d'avion, passage à WhatsApp (https://apps.apple.com/app/id1597869513). Aucun concurrent lu ne présente un avertissement contextuel à ces moments précis. Hypothèse : une alerte déclenchée par des mots-clés (« argent », « billet », « WhatsApp ») qui informe sans accuser serait une première chez les applications ciblant l'Afrique ; à valider par test d'usage et par le juriste (faux positifs, données de conversation).
3. **Prix honnêtes.** Les fiches lues affichent plusieurs prix pour un même produit (AfroIntroductions, Muzz, Hinge) sans périodes. Hypothèse : un écran qui affiche prix, durée, devise et date de reconduction à côté du bouton, sans lots cachés, est un différenciateur concret pour des utilisateurs échaudés par les abonnements.
4. **Paiement local.** Un avis sur Chat&Yamo demande le Mobile Money (section 2.1) et le dépôt interne lui-même signale la question comme ouverte (`docs/12-MONETIZATION.md` ligne 85 ; `docs/reviews/phase0.md` MIN-19). Décision du propriétaire, voir section 10.
5. **Recours et transparence de modération.** Plusieurs avis (Tinder, Hinge, Muzz, AfroIntroductions) décrivent des suspensions sans explication. Ayelo a déjà des écrans de sanctions et de contestation (section 3 du prompt maître). Hypothèse : une page de décision claire (motif, délai de réponse, recours) manquerait chez les concurrents lus.
6. **Accessibilité et légèreté.** Aucune fonction d'accessibilité déclarée sur les deux fiches africaines lues. Poids d'application : Tinder 468,9 Mo, Bumble 337,9 Mo, Hily 159,7 Mo (fiches App Store) ; le poids des autres n'a pas été relevé. Hypothèse : une application légère et accessible est un avantage pour les téléphones d'entrée de gamme, à mesurer.
7. **Choix de genre et d'ethnicité.** Un avis Muzz critique des filtres d'ethnicité qui regroupent des cultures entières (fiche, 2025). Ayelo propose pays d'origine et de résidence : ne pas regrouper, laisser « préfère ne pas dire ». C'est aussi une dette connue (section 3 du prompt maître).

## 8. Éléments de marché (uniquement ce qui est sourcé)

### 8.1 Connectivité et appareils

| Pays | Connexions mobiles | Utilisateurs d'internet | Pénétration | Part de connexions « large bande » | Source |
|---|---|---|---|---|---|
| Côte d'Ivoire | 49,7 millions (151 % de la population) | 13,4 millions | 40,7 % | 92,7 % | https://datareportal.com/reports/digital-2026-cote-divoire |
| Sénégal | 23,3 millions (122 %) | 11,5 millions | 60,6 % | 91,3 % | https://datareportal.com/reports/digital-2026-senegal |
| Cameroun | 29,0 millions (96,4 %) | 12,6 millions | 41,9 % | 87,5 % | https://datareportal.com/reports/digital-2026-cameroon |

Avertissements de la source : une connexion mobile n'est pas une personne (certaines sont voix et SMS seulement) et la part « large bande » ne doit pas être prise comme indicateur d'usage d'internet mobile. Les pages ne donnent pas la vitesse mobile, seulement la vitesse fixe : ne pas l'utiliser pour dimensionner l'application. Conséquence sourcée : environ 59 % des Ivoiriens et 58 % des Camerounais n'utilisaient pas internet fin 2025 selon DataReportal ; la cible d'Ayelo en vague 2 est donc une minorité connectée, en ville. Hypothèse : cette minorité est plus jeune et plus équipée que la moyenne ; à vérifier.

Pour l'Afrique subsaharienne en général, selon des reprises de rapports GSMA (sources secondaires, chiffres à prendre avec prudence) : un smartphone coûte environ 26 % du revenu mensuel moyen par habitant contre 16 % dans les autres pays à revenu faible et intermédiaire, et l'écart d'usage d'internet mobile atteint environ 63 % (https://www.ecofinagency.com/news-digital/1003-53619-smartphone-costs-equal-26-of-monthly-income-in-sub-saharan-africa-gsma-says) ; 60 % des utilisateurs d'internet mobile de la région sont sur des smartphones 3G ou des téléphones basiques, contre 16 % dans le monde (https://cioafrica.co/the-30-phone-that-could-unlock-africa) ; prix médian d'un smartphone d'entrée de gamme environ 39 $ en 2024 (https://telecomlead.com/?p=124248). **Hypothèse de conception** : tenir des pages légères, des images à plusieurs tailles et un mode économie de données. Non mesurée pour les trois pays.

### 8.2 Coût des données

Les sources divergent et sont anciennes. Statista (2023) : prix moyen de 1 Go d'environ 1,18 $ en Côte d'Ivoire et 1,63 $ au Sénégal, plan le moins cher 0,64 $ et 0,47 $ (https://statista.com/statistics/1272808/price-for-mobile-data-in-cote-d-ivoire ; https://statista.com/statistics/1272688/price-for-mobile-data-in-senegal ; extraits de recherche). Un classement Cable.co.uk non daté, repris par la presse, donne 3,20 $ en Côte d'Ivoire, 2,75 $ au Cameroun et 3,30 $ au Sénégal (https://techcabal.com/?p=82774, extrait de recherche). Pas de chiffre fiable pour le Cameroun en 2023. **Ces deux séries se contredisent** : utiliser uniquement comme ordre de grandeur. Aucune donnée n'a été trouvée sur le coût d'un appel vidéo en 480p par minute : hypothèse à mesurer.

### 8.3 WhatsApp

L'enquête Africascope (capitales de huit pays francophones, 15 ans et plus) a constaté que WhatsApp dépasse Facebook en Afrique francophone subsaharienne (titre de l'édition 2021 : https://adweknow.com/?p=28049). Le résumé de recherche indique que WhatsApp est la plateforme la plus utilisée en Côte d'Ivoire et au Sénégal en 2025 et qu'il l'était au Cameroun dans l'échantillon 2021-2022 : l'adresse exacte de l'édition 2025 n'a pas pu être rattachée à cette affirmation avec certitude, donc **à confirmer** avant citation dans un document public. Les résultats concernent les capitales (population urbaine). DataReportal ne mentionne pas WhatsApp pour les trois pays. Conséquence de conception, **hypothèse** : l'échange de numéros vers WhatsApp est la norme d'usage, donc le risque d'arnaque se déplace hors de l'application.

### 8.4 Mobile Money

- Afrique subsaharienne : plus de 1,1 milliard de comptes enregistrés (rapport GSMA 2025, avant-propos : https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/wp-content/uploads/2025/04/The-State-of-the-Industry-Report-on-Mobile-Money-2025.pdf, extrait de recherche) ; édition 2026 : 1,2 milliard de comptes (résultats de recherche, non ouverte).
- Côte d'Ivoire et Sénégal : le mobile money pèse plus de 5 % du PIB selon un résumé de presse (https://www.connectingafrica.com/mobile-money/sub-saharan-africa-maintains-mobile-money-lead-gsma, extrait de recherche).
- Cameroun : Orange et MTN réalisent plus de 90 % des transactions selon Ecomatin, et Wave arrive (https://ecomatin.net/cameroun-comment-orange-et-mtn-preparent-leur-riposte-pour-contrer-loffensive-de-wave ; https://www.digitalbusiness.africa/wave-debarque-au-cameroun-orange-money-et-mtn-momo-deja-sous-pression-le-consommateur-se-frotte-les-mains/).
- Sénégal : Wave lancé en 2018 (https://www.osiris.sn/wave-la-tornade-bleue-qui-s-impose-dans-le-paiement-mobile-en-afrique-de-l.html, extrait de recherche) ; Côte d'Ivoire : deuxième marché de Wave (https://www.afrique-sur7.fr/479088-wave-mobile-money-orange-cote-divoire, extrait de recherche).
- Chat&Yamo : un utilisateur demande le Mobile Money (App Store, 02/09/2025, section 2.1).
- **Non établi** : part des utilisateurs de téléphone ayant une carte bancaire, volume de paiements via achat intégré dans ces pays. La règle des boutiques interdit de contourner l'achat intégré pour des contenus numériques dans l'application (prompt maître, section 7) : le paiement local ne peut concerner que ce que les règles des boutiques autorisent. Question pour le propriétaire et le juriste.

### 8.5 Arnaques sentimentales et diaspora (France, Belgique, Canada)

- **Canada** : le Centre antifraude du Canada indique 58,4 millions de dollars canadiens déclarés perdus en arnaques sentimentales en 2024 (https://doppleronline.ca/huntsville/romance-fraud-continues-to-cause-heartbreak-for-canadians-who-reported-losing-58-4-million-in-2024) ; le taux de signalement est estimé à 5 à 10 % (résultats de recherche, même sujet). Chiffre canadien, pas propre à la diaspora.
- **France** : près de 600 demandes d'assistance pour arnaque sentimentale sur Cybermalveillance.gouv.fr en 2022, le nombre réel étant supérieur (https://www.allianz.fr/assurance-particulier/securite/arnaques-aux-sentiments.html) ; le 17Cyber, lancé le 17 décembre 2024, offre un guichet aux victimes (https://www.welivesecurity.com/fr/cybersecurite/17cyber-un-portail-unique-pour-accompagner-les-victimes-de-cybercriminalite/) ; la plateforme THESEE permet de déposer plainte en ligne pour escroquerie aux sentiments (https://www.justice.fr/fiche/signaler-escroquerie-sentiments-thesee-service-ligne). Utile pour un lien de signalement dans l'application.
- **États-Unis (précédent de comparaison)** : les cartes cadeaux sont le moyen de paiement le plus souvent cité (24 % des cas déclarés en 2022), mais les pertes médianes les plus élevées sont en cryptomonnaies (10 079 $) et virements (10 000 $) (FTC, https://WWW.FTC.GOV/system/files/ftc_gov/pdf/romance-spotlight-2023.pdf, extrait de recherche).
- **Côte d'Ivoire** : le terme « brouteur » désigne les escrocs en ligne et la police a démantelé en décembre 2025 une arnaque sentimentale de plus de 144 millions de FCFA (https://www.koaci.com/article/2025/12/20/cote-divoire/societe/cote-divoire-cyberescroquerie-une-arnaque-sentimentale-a-plus-de-144-millions-fcfa-demantelee_193009.html, extrait de recherche). Pas de bilan annuel récent trouvé. **Hypothèse sensible** : les membres ivoiriens honnêtes peuvent être soupçonnés a priori par les membres de la diaspora ; la vérification et le badge doivent protéger aussi ces membres. À valider en entretien.
- **Non établi** : usage de WhatsApp par la diaspora en France, Belgique et Canada, appétence au paiement par carte ou par portefeuille mobile dans ces pays, part des utilisateurs sur Android ou iOS dans ces pays. Aucune source solide trouvée : **hypothèses** à valider en entretien.

## 9. Dix questions de recherche utilisateur à poser (hypothèses à valider)

1. Qu'est-ce qui convainc qu'un profil est vrai : badge, appel vidéo, avis de proches ? (hypothèse : l'appel vidéo pèse plus que le badge)
2. Comprenez-vous la phrase « pas une garantie d'identité » ? Rassure-t-elle ou inquiète-t-elle ?
3. À quel moment avez-vous déjà vu un signe d'arnaque, et qu'auriez-vous aimé voir à cet instant ?
4. Quel moyen de paiement utilisez-vous au quotidien (carte, Orange Money, MTN MoMo, Wave) et le paiement dans l'application vous convient-il ?
5. Que représente le coût des données pour vous : fermez-vous l'application pour économiser ?
6. Quelles langues préférez-vous lire dans l'application ? (français, anglais, langues nationales)
7. Pour la diaspora : quel poids a l'origine du partenaire, du pays de résidence, de la religion ?
8. Que pensez-vous d'un tuteur ou d'un proche ajouté à la conversation (pratique de Muzz) ? Acceptable dans votre contexte ?
9. Comment ressentez-vous un abonnement qui se renouvelle ? À quel moment avez-vous déjà été surpris par un prélèvement ?
10. Comment réagissez-vous à une suspension de compte : quelle explication et quel délai jugez-vous corrects ?

## 10. Décisions pour le propriétaire

| Décision | Options | Recommandation |
|---|---|---|
| Vérification : selfie seul ou selfie + pièce d'identité facultative | A) selfie seul ; B) selfie + pièce d'identité facultative avec badge distinct ; C) pièce d'identité obligatoire | B, avec phrase de limite claire. C réduirait l'inscription en vague 2 (hypothèse). Le juriste valide la conservation des données biométriques. |
| Avertissement anti-arnaque contextuel | A) bannière fixe seulement ; B) bannière + alerte déclenchée sur certains mots ; C) rien de plus | B, après avis du juriste sur le traitement des messages. |
| Paiement local (Mobile Money) | A) achats intégrés seulement ; B) Mobile Money sur le web hors boutiques ; C) les deux | Question ouverte dans le dépôt (`docs/12-MONETIZATION.md`). Je recommande de la poser avec une estimation de revenu par marché (MIN-19). Cette recherche ne tranche pas. |
| Affichage des prix | A) prix et durée seuls ; B) prix, durée, date de reconduction et prix de renouvellement près du bouton | B (conformité boutiques et principe 2). |
| Contrôle d'âge | A) date de naissance + attestation ; B) A + estimation faciale en cas de doute | A en vague 1, B à étudier si la réglementation l'impose (précédent britannique). À valider par le juriste. |
| Tuteur / proche invité dans la conversation | A) non ; B) option plus tard | B, comme hypothèse à tester en entretien ; sensible culturellement. |

## 11. Registre des sources

Consulté en entier (page lue) : https://apps.apple.com/app/id1597869513 ; https://apps.apple.com/us/app/muzz-where-muslims-marry/id969997496 ; https://apps.apple.com/lb/app/moyyo/id6476918792 ; https://www.deedsmag.com/stories/the-new-dating-app-for-the-african-diaspora-genuine-or-a-rug-pull-an-honest-review ; https://apps.apple.com/us/app/hily-dating-app-meet-date/id1250946975 ; https://apps.apple.com/us/app/tinder-dating-app-date-chat/id547702041 ; https://apps.apple.com/us/app/hinge-dating-app-match-date/id595287172 ; https://apps.apple.com/gb/app/badoo-dating-app-friends/id351331194 ; https://apps.apple.com/us/app/id1339782074 ; https://apps.apple.com/fr/app/meetic-appli-de-rencontre/id416973595 ; https://apps.apple.com/fr/app/happn-appli-de-rencontre/id489185828 ; https://apps.apple.com/us/app/bumble-dating-app-meet-date/id930441707 ; https://www.swipestats.io/blog/hily-review ; https://ca.trustpilot.com/review/www.afrointroductions.com ; https://www.globaldatinginsights.com/featured/uk-dating-apps-adopt-age-verification-ahead-of-online-safety-law/ ; https://muzz.com/muslim-dating-app/ ; https://datareportal.com/reports/digital-2026-cote-divoire ; https://datareportal.com/reports/digital-2026-senegal ; https://datareportal.com/reports/digital-2026-cameroon.

Vu seulement en extrait de recherche (à rouvrir avant citation publique) : centres d'aide Tinder, Hinge, Bumble ; Veriff via biometricupdate ; TechCrunch Badoo 2016 ; propakistani Muzz ; GSMA, Ecofin, CIO Africa, TelecomLead ; Statista, TechCabal ; adweknow Africascope ; Ecomatin, digitalbusiness.africa, osiris.sn, afrique-sur7, connectingafrica ; FTC ; doppleronline (Centre antifraude du Canada) ; Allianz, welivesecurity, justice.fr ; Koaci.

Non obtenu : pages Google Play (Muzz : page tronquée ; Chat&Yamo : connexion coupée), pages d'aide des trois grandes applications en lecture directe.

## 12. Hypothèses récapitulées (à valider)

1. L'appel vidéo pèse plus que le badge dans la confiance des utilisateurs.
2. Les utilisateurs de vague 2 connectés sont plus jeunes et mieux équipés que la moyenne nationale.
3. L'échange vers WhatsApp est la norme d'usage, y compris pour la diaspora.
4. Une alerte arnaque contextuelle est acceptée sans se sentir accusatoire.
5. Une application légère et accessible est un avantage concurrentiel perçu.
6. Les membres de Côte d'Ivoire sont soupçonnés a priori à cause des arnaques « brouteurs ».
7. Une page d'explication de décision de modération manque chez les concurrents lus.
8. Le Mobile Money intéresse davantage les utilisateurs de vague 2 que ceux de la diaspora.
9. Le poids des appels vidéo en 480p en données mobiles est un frein (non mesuré).

**Prochaine phase proposée** : `docs/design/00-audit.md` (écarts P0, P1, P2 du dépôt), puis cartographie des 8 parcours, puis personas fondés sur le dépôt. Avant cela, réaliser à la main les parcours d'inscription de 4 concurrents sur Android d'entrée de gamme pour combler les cases « non établi » de la matrice.
