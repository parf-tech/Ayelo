# REA : Meetic (analyse fonctionnelle et UX à partir de sources publiques)

Date de lecture des sources : 2026-11-12 (sauf mention contraire).

Méthode : celle de `docs/02-REA-REPORT.md`. Sources publiques uniquement. Aucune lecture de code d'app, aucune décompilation, aucune capture réseau, aucun compte (ni le nôtre ni celui d'un tiers). Aucun texte, image ou élément de marque n'est copié : tout est résumé avec nos mots.

Niveaux de preuve : **C** = source officielle lue (Meetic, Meetic Europe, fiche App Store) ; **T** = source tierce lue (presse, avis, comparateurs) ; **H** = hypothèse, aucune preuve.

Limite de lecture à connaître : les pages ont été lues avec un outil qui renvoie un résumé de la page, pas le HTML brut. Les chiffres de ce document sont ceux que le résumé a restitués ; ils sont à relire à la source avant toute citation externe. Aucune interface n'a été parcourue : les écrans décrits viennent de textes, pas de captures vues par nous. Aucune capture d'écran n'a été examinée dans cette analyse.

## 0. Sources lues

| # | source | URL | état |
| --- | --- | --- | --- |
| 1 | Site Meetic FR (accueil) | https://www.meetic.fr/ | lue, C |
| 2 | Fiche App Store FR | https://apps.apple.com/fr/app/id416973595 | lue au 2e essai (le 1er a échoué en 429), C. Voir réserve en 3.3 |
| 3 | Fiche Google Play | https://play.google.com/store/apps/details?id=com.meetic.meetic (et une variante) | **échec (404)**. Aucune donnée Play officielle. |
| 4 | Meetic Europe (groupe) | https://www.meetic-europe.com/en | lue, C |
| 5 | Politique de confidentialité | https://www.meetic-europe.com/privacy/en | lue, C |
| 6 | Pages aide, CGU, règles de communauté, conseils de sécurité | meetic.fr/aide, /cgu, /regles-de-communaute, /conseils-securite | **échec** : le résumé ne renvoie que « Connexion ». Non lues. help.meetic.fr : domaine introuvable. |
| 7 | Tarifs juillet 2026 | https://www.alucare.fr/combien-coutent-meetic-pour-les-hommes/ | lue, T (article du 12/07/2022, modifié le 03/07/2026) |
| 8 | Trustpilot | https://nz.trustpilot.com/review/www.meetic.fr | lue, T |
| 9 | Custplace | https://fr.custplace.com/meetic | lue, T (non officielle) |
| 10 | Clubic (fiche Android) | https://www.clubic.com/telecharger-fiche437685-meetic-amour-et-rencontre.html | lue, T |
| 11 | Futura | https://www.futura-sciences.com/tech/telecharger/meetic-30570 | lue, T (1er oct. 2025) |
| 12 | El Grupo Informático (refonte 2019) | https://www.elgrupoinformatico.com/noticias/meetic-renueva-nuevo-diseno-perfiles-con-mas-informacion-otras-mejoras-t74031.html | lue, T (11/06/2019) |
| 13 | Global Dating Insights (modération IA) | https://www.globaldatinginsights.com/news/meetic-implements-ai-content-moderation/ | lue, T (22/03/2018) |
| 14 | Next.ink (CNIL) | https://next.ink/17518/95977-la-cnil-met-en-demeure-13-sites-rencontres-dont-meetic-et-adopte-mec/ | lue, T (29/07/2015) |
| 15 | FrenchWeb (refonte 2012) | https://www.frenchweb.fr/entretien-exclu-les-nouveautes-de-meetic-decryptees-par-sa-dg-france-jessica-delpirou/92079 | lue, T (18/12/2012) |
| 16 | Étude de cas Contra (freelance) | https://contra.com/p/6F2gPUbR-dating-platform-redesign-app-web-app-and-website | lue, T, non confirmée par Meetic (26/09/2023) |
| 17 | Annonce Match Group (vérification, fév. 2024) | https://match-group.dd-nyc.co/?p=601 | **extrait de recherche seulement, page non lue**, T |
| 18 | Europe 1 (test) | https://www.europe1.fr/societe/meilleur-site-de-rencontre-243427 | lecture échouée (403) ; seuls des extraits de recherche ont été vus, T faible |
| 19 | Logo (couleurs) | https://whatthelogo.com/logo/meetic/272361 | extrait de recherche seulement, **peu fiable** |

## 1. Identité

| élément | valeur | preuve |
| --- | --- | --- |
| Éditeur | Meetic SAS, 53 rue de Châteaudun, 75009 Paris | C : fiche App Store FR, politique de confidentialité |
| Groupe | Meetic Europe, rattaché à Match Group (lien et mention dans la navigation du site groupe) ; marques sœurs listées : Lexa, Match, Lovescout24, DisonsDemain, Ourtime, Zweisam ; Even cité en actualité | C (site groupe) |
| Présence | 21 pays européens, plus de 20 ans d'activité (déclaratif) | C (marketing) |
| Plateformes | iOS (fiche FR : iOS/iPadOS 17.0 minimum, visionOS 1.0), Android, web | C (App Store) ; Futura pour le web, T |
| Version iOS lue | 26.19.00 (« 4 nov. », année non affichée), 202,3 Mo | C |
| Catégorie / classement | Lifestyle ; n° 46 des gratuites Lifestyle le jour de lecture | C |
| Âge | 18+ (thèmes suggestifs, contenu généré par les utilisateurs, messagerie) | C |
| Note iOS (FR) | 3,9/5 sur environ 83 000 notes | C |
| Note Android | **non lue** (échec Play) | aucune |
| Langues iOS | français plus 19 autres | C |
| Note Trustpilot | 1,3/5 affiché en texte (étoiles à 1,5), 10 874 avis, 620 sur 12 mois ; 34 % de 1 étoile, 31 % de 5 étoiles | T |
| Note Custplace | 1,1/5 sur 57 avis, page non officielle | T |
| Déclaration de confidentialité iOS | « utilisé pour vous suivre » : identifiants ; « lié à vous » : achats, paiement, e-mail, nom, photos/vidéos, e-mails/SMS, support, historique de recherche, ID, ID appareil, données sensibles, usage (publicité tierce) | C |
| Accessibilité déclarée sur l'App Store | aucune fonction listée | C |

Constat sur les notes : l'écart est fort entre la note du store (3,9, population d'utilisateurs actifs, filtrage par le store) et les sites d'avis (1,1 à 1,5, population de mécontents). Les deux sont à lire ensemble, aucune n'est représentative seule (H).

## 2. Inscription et onboarding

Ce qui est établi :

| étape | contenu | preuve |
| --- | --- | --- |
| Page d'accueil web | Un module de recherche avant tout compte : choix de l'orientation en 6 combinaisons (homme/femme cherchant femme, homme, ou les deux), tranche d'âge par deux listes (18 à 100 et plus), lieu en texte libre, bouton « voir les célibataires ». Un bouton « s'inscrire » existe plus bas. Aucun e-mail ni mot de passe sur ce module. | C |
| Données à l'inscription | numéro de téléphone, e-mail, date de naissance ; profil : genre, centres d'intérêt, préférences, localisation approximative ; données sensibles seulement si l'utilisateur les saisit | C (confidentialité) |
| Âge | service limité aux 18 ans et plus ; un membre soupçonné mineur peut être signalé | C (confidentialité) |
| Photo | classée dans « contenu » ; la politique ne dit pas qu'elle est obligatoire à l'inscription | C (silence de la source) |
| Vérification de photo | données « visage » (vérification photo) et « pièce d'identité » listées comme facultatives | C |
| Coach virtuel | un agent conversationnel pose des questions pour construire le profil et la recherche ; le score de compatibilité vient de ces réponses | T (Clubic, Android, version 5.67.2, 03/11/2026) |
| Question d'intention | l'inscription demande ce que la personne attend de la relation | T (Futura) |
| Confirmation | validation par lien reçu par e-mail | T (guide débutant vu en extrait de recherche, faible) |

Non établi, donc H : nombre exact d'écrans, ordre des questions, photo obligatoire ou non, moment où le numéro de téléphone est demandé, saisie de la date de naissance en un champ ou en trois, mur de paiement dès l'inscription. Des avis (Trustpilot) évoquent une exigence de numéro de téléphone et des comptes bloqués après usage d'un VPN (T).

Remarque produit : la preuve de valeur avant création de compte (voir des célibataires avant de s'inscrire) est un schéma à retenir (voir 9).

## 3. Architecture d'information et écrans

### 3.1 Ce qui est documenté

| zone | observation | preuve |
| --- | --- | --- |
| Navigation de l'app (2019) | barre d'onglets en bas ; Événements dans l'onglet central ; accueil en deux bandes : profils selon les centres d'intérêt, puis membres connectés dans les 30 dernières minutes ; favoris et « qui s'est intéressé à moi » | T (El Grupo Informático, 2019, donc probablement dépassé, H sur l'état actuel) |
| Fiche profil (2019) | un balayage vers le haut ouvre une grande photo (plus de la moitié de l'écran) avec une courte description, puis un défilement fait apparaître toutes les informations, dans un style inspiré d'Instagram | T (2019) |
| Messagerie | demandes de discussion que l'on peut accepter ou refuser après avoir vu le profil de l'expéditeur (principe « non, c'est non ») ; chat gratuit tant qu'il n'y a pas d'intérêt mutuel selon la source 2019, ce qui est contredit par les plaintes actuelles (voir 5 et 8) | T |
| Messagerie (fonction) | envoi de photos, filtres anti-spam, espace de chat sécurisé | T (Futura, 2025) |
| Recherche | onglet « vos recherches » avec critères personnalisés, jugé peu visible ; filtres avancés payants | T (Clubic) |
| Sélection quotidienne | « Daily Match », sélection de profils chaque jour (le site de 2012 parlait déjà de « 6 par jour ») | T (Futura 2025, FrenchWeb 2012) |
| Événements | soirées célibataires, accès partiel gratuit, le reste payant | C (navigation et pied de page du site) ; T (Futura) |
| Modes de confidentialité | modes « Incognito » (visiter un profil sans être vu) et « Zen » (n'être contacté que par les membres correspondant à ses critères). Statut gratuit ou payant **contradictoire** : le site Meetic les présente dans une section de fonctions, des fiches App Store étrangères les vendent en achat intégré (« mode privé »), un comparateur les place dans les pass payants | C (site), T (App Store étrangères via recherche), T |
| Paramètres | accès à « mon compte » pour corriger ou supprimer ses données ; suspension du profil depuis « Mon compte », sans arrêt automatique de l'abonnement | C (site, confidentialité) ; T (plainte Test-Achats citant la FAQ Belgique) |
| Contenu éditorial | magazine (meeticmag.fr), conseils de rencontre, « belles histoires » | C (pied de page) |
| Fonctions décrites sur la fiche App Store FR | profils avec questions-réponses (« prompts ») et « Valeurs », chat, Super Like, mode privé, Boost quotidien, filtres avancés, archivage automatique d'une conversation sans réponse après 7 jours (anti-ghosting) | C sous réserve : voir 3.3 |

### 3.2 Schéma d'écrans déduit (H)

Accueil/Découvrir (sélection quotidienne, profils), Recherche (critères, filtres), Likes (reçus/envoyés), Messages (demandes, conversations), Événements, Mon profil (« Moi »), Réglages/compte, Abonnement (écran de comparaison de pass). Cette liste est une déduction : l'ordre et le nombre d'onglets de la version 26.x ne sont pas prouvés.

### 3.3 Réserve sur la fiche App Store

Le résumé de la fiche FR mentionne Super Like et anti-ghosting. Ces deux termes apparaissent aussi dans la fiche de l'application Even (autre application de Meetic SAS pour parents célibataires, trouvée dans les mêmes résultats). Risque de confusion de page : à relire sur la fiche avant de s'appuyer dessus. Les noms de paliers dans cette fiche (Essentiel, Premium, Prestige) concordent avec la source tarifaire alucare.

## 4. UX et identité visuelle observables

Constat honnête : **aucune capture d'écran de Meetic n'a pu être examinée** (les outils de lecture ne renvoient pas les images des fiches de store). Cette section ne contient donc que des éléments textuels sourcés ; le reste est H.

| sujet | ce qui est sourcé | niveau |
| --- | --- | --- |
| Couleur de marque | une seule source donne un code (fuchsia #FF00BB et noir #000000), mais c'est un site de logos dont la description est incohérente (elle parle d'un contour jaune et d'un damier) et qui n'a vu aucune charte officielle. **Je ne peux pas sourcer la couleur de Meetic de façon fiable.** | T, non fiable |
| Mémoire non sourcée | le logotype Meetic est en minuscules, de teinte rose à rouge sur fond clair ; l'app utilise du blanc comme fond dominant | **H** |
| Logo | refonte en 2012 combinant « Me » et « Etic » (texte de l'article) | T |
| Signature de marque | « Serious dating, crazy love », plateforme créée avec l'agence WNP, récompensée d'un Effie (extrait de recherche, page lareclame.fr non lue, 403) | T faible |
| Tonalité éditoriale | rassurante et orientée sérieux : relations durables, chiffres de succès, témoignages, conseils ; le sérieux est un positionnement explicite | C (site) |
| Densité et mise en page web | page d'accueil à module de recherche en tête, puis blocs de réassurance (profils modérés, outils anti-harcèlement, modes de confidentialité, recommandations, événements, témoignages), puis liens de villes et régions (SEO) et pied de page très long avec nombreux liens | C |
| Refonte « 3 principes » | donner le contrôle (choisir qui peut vous contacter, refuser ou bloquer), être pertinent (recommandations, recherche, coach « Lara »), créer de l'émotion (illustrations, animations, micro-interactions) ; cible déclarée : femmes de 30 à 45 ans en lassitude des rencontres | T, **auteur freelance non confirmé par Meetic** |
| Typographie, icônes, rayons de bordure, grille | non sourcés | H |

Ce qui rassure, d'après les textes : (1) la preuve de valeur avant inscription, (2) la modération annoncée et les outils de signalement/blocage affichés sur la page d'accueil, (3) le contrôle du contact (Zen, refus de demandes), (4) le ton sérieux et sans humour lourd, (5) les données de marque chiffrées avec notes de méthode en bas de page (rare et appréciable, même si les chiffres restent déclaratifs).

Ce qui paraît daté ou lourd (jugement de lecture, H sur le rendu réel) : la page d'accueil web très chargée en liens de SEO et en mentions légales ; le grand nombre de paliers et de noms de paliers qui ont changé au fil des années (Basic, Découverte, Illimité, Illimité Zen puis Essentiel, Premium, Prestige selon alucare) ; l'onglet de recherche peu visible (Clubic) ; une logique à base de « pass » plutôt que de parcours.

## 5. Monétisation et mur de paiement

### 5.1 Palier et prix (instables, plusieurs sources divergent)

| source | date / pays | prix constatés |
| --- | --- | --- |
| App Store FR (C) | lu le 2026-11-12 | Premium 1 semaine 24,99 € ; Premium 1 mois 39,99 € ; Premium 6 mois 79,99 € ; Pass 1 mois 39,99 € ; autres achats intégrés : 5,99 ; 7,99 ; 19,99 ; 29,99 (x2) ; 59,99 € |
| alucare (T) | juillet 2026 | Pass Essentiel : 19,99 € (1 mois), 9,99 €/mois sur 6 mois (59,94 € au total) ; Pass Premium : 27,99 € (1 mois), 14,99 €/mois sur 6 mois (89,94 €) ; Prestige : prix non indiqué. Anciens paliers : Basic, Découverte, Illimité, Illimité Zen |
| Custplace (T) | avis du 26/12/2025 | un utilisateur cite un abonnement Premium à 29,90 €/mois et des options payantes de visibilité |
| agrégateurs de codes promo (T très faible) | juillet 2026 | 39,99 €/mois en formule seule, 24,99 € sur 3 mois, 14,99 € sur 6 mois ; autre agrégateur : 54,99 €/mois en prix d'appel, 29,99 € sur 6 mois ; Belgique : 27,99 € |

Lecture : les prix affichés varient selon le canal (web ou store), le pays, la durée et la promotion ; l'écart entre l'App Store (39,99 € le mois) et le web (27,99 € pour Premium selon alucare) est un fait à retenir : le même palier n'a pas le même prix selon l'achat par le store (commissions) ; c'est une inférence (H) sur la cause.

### 5.2 Gratuit contre payant

| fonction | gratuit | payant | preuve |
| --- | --- | --- | --- |
| Inscription, profil, navigation, filtres de base, likes envoyés, réception de messages d'abonnés | oui | | T (alucare) |
| Envoi de messages | **non** pour la plupart des avis ; contradictoire avec la promesse « chat gratuit » du site | Essentiel : messages illimités (alucare) ; selon la fiche App Store, l'illimité est dans Premium | T ; fiche App Store sous réserve (3.3) |
| Voir qui a liké ou visité, choisir qui peut vous contacter, filtres avancés | | Essentiel (alucare) | T |
| Choisir qui voit votre profil, accusés de lecture, 5 boosters par mois, icône Premium | | Premium (alucare) ; fiche App Store : 3 Super Likes par semaine | T |
| Boost quotidien automatique, likes prioritaires | | Prestige (fiche App Store) | C sous réserve |
| Événements physiques | partiels | tous | T (Futura) |

Divergence entre sources sur le contenu de chaque palier : à ne pas figer sans vérifier sur le produit.

### 5.3 Divulgation du renouvellement et schémas sombres

| point | observation | preuve |
| --- | --- | --- |
| Reconduction tacite | des guides tiers évoquent un engagement de 1, 3 ou 6 mois, une reconduction automatique et un préavis de résiliation (48 heures cité) ; non vérifié aux CGV réelles (page non lue) | T faible |
| Résiliation | à faire depuis le compte ; suspension du profil ≠ arrêt de l'abonnement | T |
| Plaintes de facturation | prélèvements après résiliation, renouvellements imprévus, remboursements partiels ou refusés, société de facturation inconnue de l'utilisateur, difficulté à supprimer le profil, carte bloquée | T (Trustpilot, Custplace, voir 8) |
| Pas d'accès à la messagerie sans abonnement | messages d'abonnés visibles seulement par d'autres abonnés (avis) ; « messages illimités » vendu comme avantage | T |
| Pression de prix | durées courtes très chères (1 semaine à 24,99 € contre 1 mois à 39,99 € sur l'App Store) qui rendent la durée longue plus attractive ; paliers nombreux | C (prix), H (intention) |
| Mur de paiement à l'inscription | non établi | H |

Rien dans les sources lues ne prouve une pratique illégale. Les plaintes portent sur la perception de la divulgation du renouvellement.

## 6. Confiance et sécurité

| mécanisme | observation | preuve |
| --- | --- | --- |
| Profils « modérés » | le site affirme que chaque description et chaque photo est modérée | C (marketing) |
| Modération automatisée | en 2018, 74,8 % du contenu était modéré automatiquement avec 99 % de précision (97,9 % en manuel), puis environ 90 % des décisions ; prestataire Besedo ; objectif affiché : arnaques sentimentales | T (Global Dating Insights, 2018, ancien) |
| Vérification de profil | annonce de février 2024 par Match Group : les profils non vérifiés de plusieurs marques, dont Meetic, reçoivent une demande de vérification par vidéo-selfie ; étapes exactes de Meetic non décrites | T (extrait de recherche, page non lue) |
| Badge | un « badge certifié » existait déjà en 2019, affiché près de la photo et lié à une série d'étapes ; état actuel et gratuité inconnus | T (2019), H pour aujourd'hui |
| Données de vérification | visage et copie de pièce d'identité traités comme données facultatives | C (confidentialité) |
| Signalement | boutons signaler et bloquer annoncés sur la page d'accueil ; un lien « signaler un contenu illégal » en pied de page ; on peut signaler un mineur présumé ; le signaleur peut être informé de la suite donnée | C |
| Sanctions | bannissements pouvant être partagés entre services Match Group, données utilisées pour empêcher la recréation de compte | C (confidentialité) |
| Inactivité | clôture automatique après deux ans ; conservation de sécurité de trois mois après clôture | C |
| Historique réglementaire | en 2015, la CNIL a mis Meetic en demeure sur trois points : exclusion automatisée sans autorisation préalable, données sensibles sans consentement exprès, comptes conservés plus de trois ans après la clôture ; pas de sanction | T (Next.ink, 2015, ancien) |
| Résultat perçu | les avis rapportent des profils faux, des bots, des profils inactifs depuis des mois ou des années, des likes de comptes automatisés, des suppressions de compte sans explication | T (Trustpilot, Custplace, voir 8) |
| Règles de profil (photos, identité) | **non lues** (page des règles de communauté illisible) | non sourcé |

## 7. Accessibilité et localisation

| point | observation | preuve |
| --- | --- | --- |
| Accessibilité déclarée | aucune fonction d'accessibilité déclarée sur la fiche App Store | C |
| Contrastes, tailles dynamiques, lecteur d'écran | non audités | H |
| Langues | français plus 19 autres langues (20 en tout) | C |
| Pays | 21 pays européens (groupe) | C |
| Tarification locale | prix distincts par pays (Belgique 27,99 € Premium selon une source, prix en złoty et en forint sur des fiches App Store étrangères) | T |
| Intitulé du store | « Relationship and Love » en anglais et « Rencontre et Amour » en français : titre localisé et non traduit mot à mot | C (résultats de recherche des fiches) |
| Positionnement | produit centré sur la France (annonce du site : « application préférée des Français », enquête OpinionWay 2023 citée avec méthodologie en pied de page) | C |
| Orientations | six combinaisons d'orientation dès l'accueil web, pages dédiées lesbiennes et gays | C |

## 8. Plaintes récurrentes des utilisateurs

Toutes proviennent de sites d'avis ; elles sont auto-déclarées et non vérifiées. Les avis visibles sur Trustpilot étaient tous à 1 ou 2 étoiles dans l'extrait ; la page indique aussi 31 % d'avis à 5 étoiles au total.

| thème | exemple paraphrasé | source et date |
| --- | --- | --- |
| Prélèvements après résiliation, renouvellement automatique mal compris | une personne dit avoir été facturée par une société inconnue après un essai d'un mois ; une autre n'arrive pas à arrêter le renouvellement même après avoir retiré sa carte | Trustpilot : 26/10/2026 ; 28/06/2025 |
| Remboursements partiels ou refusés | abonnement payé mais inutilisable, remboursement refusé ; remboursement incomplet malgré la rétractation sous 14 jours | Trustpilot : 29/07/2026 ; 20/02/2025 |
| Faux profils, bots, profils inactifs | de nombreux comptes inexistants ou inactifs depuis longtemps, ou situés à l'étranger ; une personne dit que la plupart des likes reçus viennent de bots | Trustpilot 05/05/2025 ; Custplace 17/02/2025 et 24/02/2026 |
| Messagerie réservée aux abonnés | on ne peut pas répondre sans payer ; les messages d'un abonné ne seraient lisibles que par d'autres abonnés ; peu de femmes abonnées, d'où un intérêt limité à payer | Custplace 10/11/2024, 08/12/2024, 14/02/2026 |
| Prix | tarif jugé élevé pour le service reçu, options de visibilité payantes en plus | Trustpilot ; Custplace 26/12/2025 et 20/07/2025 |
| Suggestions non pertinentes | profils hors critères, y compris déjà bloqués ou refusés | Custplace 06/05/2025, 01/06/2025, 08/09/2024 |
| Suspension de compte sans explication | compte supprimé juste après un abonnement ou l'ajout d'une photo | Custplace 02/07/2025 |
| Support peu utile | réponses automatiques répétitives | Custplace 13/02/2025 |
| Qualité en baisse | un avis dit que Meetic était une référence avant septembre 2024 | Custplace 10/11/2024 |
| Réponses de l'entreprise | la page Trustpilot indique que Meetic n'a pas répondu aux avis négatifs | Trustpilot |

Autres éléments : une plainte publique existe sur Test-Achats (Belgique) pour une annulation non prise en compte (T, vue en extrait de recherche, page non lue). Des fils du forum Que Choisir évoquent des suppressions de compte et un taux élevé de faux profils (T, fils non lus, extraits de recherche).

## 9. Leçons pour Ayelo

### 9.1 Dix schémas à adopter

1. **Preuve de valeur avant inscription** : montrer des profils (ou des exemples de résultats) avant de demander e-mail et mot de passe. Chez Meetic le module de recherche est en tête de page.
2. **Contrôle explicite du contact** : choisir qui peut vous écrire, accepter ou refuser une demande après avoir vu le profil de l'expéditeur.
3. **Vérification facultative et visible** : une preuve de photo par vidéo-selfie avec un badge lisible, des données de visage et de pièce d'identité traitées comme facultatives et étiquetées comme telles.
4. **Signalement et blocage affichés tôt**, avec retour d'information au signaleur sur la suite donnée.
5. **Question d'intention dès l'inscription** (relation durable, rencontre, amitié) et affichage de cette intention sur le profil, avec le filtre correspondant.
6. **Sélection quotidienne limitée** (quelques profils par jour) plutôt qu'un flux infini : lisible, rythmé, moins fatigant.
7. **Archivage ou relance d'une conversation sans réponse** après un délai affiché (anti-ghosting), sous réserve de vérifier que la fonction existe chez Meetic (voir 3.3).
8. **Statistiques de marque avec méthode et date en pied de page** : ne citer que des chiffres que l'on peut sourcer.
9. **Page de confidentialité qui donne les durées de conservation** (inactivité, clôture, transactions, journaux) : crédibilité de la mise à plat.
10. **Fiche de store honnête** : notes de mise à jour réelles, déclaration d'accessibilité renseignée (Meetic ne le fait pas), étiquettes de confidentialité complètes.

### 9.2 Dix schémas à éviter

1. **Promettre un chat gratuit puis bloquer l'écriture** : c'est la première cause de colère dans les avis.
2. **Multiplier les paliers et les noms de paliers** (Basic, Découverte, Illimité, Zen, Essentiel, Premium, Prestige) ; privilégier deux paliers lisibles.
3. **Prix différents selon le canal sans l'expliquer** (web et store, 27,99 € contre 39,99 € pour un mois de Premium selon deux sources).
4. **Renouvellement automatique peu visible** : afficher la date et le montant du prochain prélèvement, un bouton d'annulation dans l'app, un rappel avant la reconduction.
5. **Société de facturation inconnue** sur le relevé bancaire : faire apparaître le nom du produit.
6. **Durées courtes à prix punitif** pour pousser la durée longue (1 semaine à 24,99 € sur l'App Store).
7. **Laisser des profils inactifs ou suspects dans les résultats** ; masquer ce qui est inactif depuis longtemps, étiqueter la fraîcheur d'activité.
8. **Suspendre ou supprimer un compte sans motif lisible** : toujours dire quelle règle est en cause et comment faire appel.
9. **Support par réponses automatiques répétées** : prévoir un chemin vers une personne pour la facturation et la sécurité.
10. **Recherche difficile à trouver et filtres de base payants** : garder la recherche au premier niveau de navigation.

### 9.3 Direction visuelle d'Ayelo contre l'identité visible de Meetic

Palette proposée par Ayelo : violet #4B0F5B, magenta #E6007A, corail #FF7A3D, rose pâle #FFE1EB, lavande #EDE6FF ; Poppins ; grille de 8 px ; marges de 20 px.

| point | état de la preuve | risque |
| --- | --- | --- |
| Couleur dominante de Meetic | **non sourcée de façon fiable** (voir section 4). Un code fuchsia #FF00BB existe sur un site de logos peu fiable. À titre d'hypothèse (H, mémoire), la marque est dans les roses à rouges. | Si H est juste, notre magenta #E6007A est dans la même famille chromatique que la marque Meetic : risque de ressemblance **à vérifier sur capture réelle avant décision**. |
| Rose très pâle (#FFE1EB) et lavande (#EDE6FF) | aucune donnée sur l'usage chez Meetic | non évaluable |
| Violet profond #4B0F5B comme couleur de structure | non sourcé pour Meetic ; différenciant si Meetic reste sur un rose seul (H) | faible, à vérifier |
| Corail #FF7A3D | non sourcé pour Meetic | non évaluable ; ce n'est pas la couleur principale de Meetic selon H |
| Poppins, grille 8 px, marges de 20 px | typographie et grille de Meetic non sourcées | non évaluable |
| Ton éditorial | Meetic : sérieux, rassurant, orienté résultat (C) | Ayelo peut se différencier par un ton plus chaleureux et plus direct, à condition de ne pas perdre le signal de sérieux |
| Densité | Meetic web : dense, très chargé en liens (C) | Ayelo : fond clair, 20 px de marge et hiérarchie nette, c'est un choix déjà opposé |

Recommandation : avant de figer le magenta comme couleur primaire, faire une comparaison visuelle sur de vraies captures publiques de la fiche App Store de Meetic (action manuelle, car les outils de lecture ne renvoient pas les images). Si les deux sont proches, laisser le violet porter l'identité (logo, en-têtes, états actifs) et réserver le magenta aux appels à l'action secondaires, avec le corail comme accent chaleureux.

## 10. Limites et points à refaire

1. Fiche Google Play : non lue (404 sur deux identifiants testés). À refaire avec le bon identifiant ou par un tiers de stats.
2. Aide Meetic, CGU, CGV, règles de communauté, conseils de sécurité : non lues (la lecture renvoie une page de connexion). Les règles de profil (photo, identité, âge) et les conditions de renouvellement restent donc non sourcées.
3. Aucune capture d'écran examinée : couleurs, typographie, icônes, densité réelle de l'app sont en H.
4. Prix : sources contradictoires (App Store, alucare, avis, agrégateurs). Ne pas figer un tarif.
5. Les avis proviennent de sites où les mécontents sont sur-représentés.
6. Article El Grupo Informático de 2019 et article de modération de 2018 : anciens, utilisés comme historique, pas comme état actuel.
7. Fonctions Super Like et anti-ghosting : à confirmer sur la fiche Meetic (confusion possible avec la fiche d'Even).
8. Vérification par vidéo-selfie : annonce de groupe de février 2024 vue en extrait de recherche, pas sur une page Meetic.

## Conformité de la méthode

| règle | respectée |
| --- | --- |
| Sources publiques seulement | oui |
| Aucun compte, aucun code d'app, aucune capture réseau, aucune décompilation | oui |
| Aucun texte, image ou élément de marque copié | oui (résumés en propres termes) |
| Chaque donnée non sourcée marquée H | oui |
| Aucun chiffre inventé | oui ; les chiffres cités sont ceux restitués par les pages lues, avec leur date |
