# 02 : Rapport REA (reverse engineering fonctionnel)

Méthode : sources publiques uniquement (fiches stores, site officiel, CGU, pages de statistiques tierces). Pas de lecture du code de l'app, pas de capture réseau, pas de décompilation, pas de compte tiers.

Niveaux de preuve : **C** = confirmé par une source officielle lue ; **T** = confirmé par une source tierce ; **H** = hypothèse produit, aucune preuve.

## Phase 1 : reconnaissance

### Identité

| élément | valeur | preuve |
| --- | --- | --- |
| Éditeur | Affinity Square US Inc. | C : App Store, CGU |
| Plateformes | iOS (≥ 15.0), Android (`com.chatetyamo`) | C |
| Catégorie | Lifestyle (iOS), Dating (Android) | C / T |
| Âge | 18+ | C |
| Version iOS lue | 1.1.257 (27 oct.) | C |
| Taille iOS | 145,7 Mo | C |
| Note iOS | 4,2/5 (≈1,1 k) | C |
| Note Android | ≈3,97/5 (≈13 k), 2,3 M+ installs, ≈53 k MAU estimés | T (AppGoblin) |
| Langue iOS (US) | français | C |
| Revenus | 100 % achats in-app, estimation < 10 k$/mois | T (AppGoblin) |

### Sources

| # | source | URL | usage |
| --- | --- | --- | --- |
| 1 | App Store US | https://apps.apple.com/us/app/id1339782074 | fonctions, achats, versions |
| 2 | App Store FR | https://apps.apple.com/fr/app/chat-yamo-app-de-rencontre/id1339782074 | **lue le 2026-11-05** : stories, cadeaux, proximité, prix en euros |
| 3 | Google Play | https://play.google.com/store/apps/details?id=com.chatetyamo | **lecture échouée** (page tronquée) ; données Android via AppGoblin |
| 4 | Site officiel | https://www.chat-yamo.com/ | **lue le 2026-11-05** : fonctions, vérification, pays, chiffres |
| 5 | Sécurité | https://www.chat-yamo.com/?p=529 | blocage, signalement, visibilité |
| 6 | CGU | https://www.chat-yamo.com/?p=626 | comptes, UGC, abonnements, login TikTok |
| 7 | AppGoblin | https://appgoblin.info/apps/com.chatetyamo | stack, installs, revenus |
| 8 | CB Insights | https://www.cbinsights.com/company/chatyamo | société (extrait de recherche seulement, page non lue) |

**À faire** : relire la source 3 (Google Play), dont la lecture a échoué.

### Fonctionnalités documentées

| fonction | preuve | source |
| --- | --- | --- |
| Invitations vidéo (film, concert, dîner) | C | App Store |
| Filtre par origine et pays, y compris un autre pays | C | App Store |
| Intentions : mariage, amour durable, flirt, amitié, « on verra » | C / T | App Store, AppGoblin |
| Singles à proximité (notification) | C | App Store |
| Appels vidéo avant échange de numéro | C | App Store |
| Support client dans l'app | C | App Store |
| Coachs de rencontre et événements | C | App Store |
| Explore : swipe, profils vérifiés, chat gratuit, vidéo | C | App Store (nouveautés) |
| Abonnements Premium (1 / 6 / 12 mois) et achats « Conversation », « Propositions » | C | App Store (prix IAP) |
| Visibilité du profil (« Show my profile ») | C | page sécurité |
| Blocage et signalement (4 motifs) | C | page sécurité |
| Login Chat&Yamo et TikTok | C | CGU |
| Suppression du compte dans les réglages | C | CGU |
| Notifications push et email | C | CGU |
| Débloquer le Premium via réseaux sociaux, invitations, défis | T | fiche App Store coréenne (non relue en détail) |

### Mise à jour du 2026-11-05 : lecture de l'App Store FR et du site officiel

| fonction | statut après lecture | source |
| --- | --- | --- |
| Stories vidéo de 15 à 20 s, montrées aux profils compatibles | **C** | App Store FR, site |
| Cadeaux virtuels achetés avec des crédits | **C** | App Store FR, site |
| Appels voix et vidéo depuis le chat | **C** | site ; des avis d'utilisateurs en demandent encore dans l'app |
| Proximité par géolocalisation (« Singles Met ») | **C** | App Store FR, site |
| Test de compatibilité de 3 minutes | **C** | site |
| Section communauté, recommandations | **C** | site |
| Certification du profil par photos ou courte vidéo, revue humaine des signalements | **C** | site |
| Message direct avant match (option Premium) | **C** | site |
| Filtres avancés payants | **C** | App Store FR (« Advanced Filters, 1 month ») |
| Match réciproque (logique exacte) | **C** pour le swipe, logique inconnue | App Store FR |

Toujours **H** (aucune source) : notes vocales, images dans le chat, accusés de réception, présence, vérification email / téléphone. Elles sont spécifiées comme choix produit.

### Chiffres du site (déclaratifs, non vérifiés)

4 000 000+ inscrits, 2 M+ téléchargements, 4,0/5 sur 12 900+ avis Google Play, disponible « dans tous les pays ». Pays cités : 19 pays africains et 7 pays de la diaspora (Allemagne, Belgique, Canada, États-Unis, France, Royaume-Uni, Suisse). Ces chiffres sont du marketing : ne pas les utiliser comme références de performance.

### Prix constatés en euros (App Store FR)

Premium 8,99 € ; Abonnement 8,99 € ; Conversation 0,99 € ; Premium 1 mois 11,99 € ; Pack SOLO 11,99 € ; Premium 3 mois 22,99 € ; Diaspora 1 mois 18,99 € ; Pack DIASPORA ÉLITE 18,99 € ; Pack PREMIUM PLUS 29,99 € ; Filtres avancés 1 mois 29,99 €. Beaucoup de paliers, ce qui est un point faible (un avis dit que beaucoup de fonctions sont payantes).

### Points faibles relevés sur la fiche App Store FR (avis visibles, non datés)

1. Plantages après une mise à jour.
2. Trop de fonctions payantes.
3. Absence d'appels vocaux/vidéo dans l'app (demande exprimée) : notre appel inclus dès le lancement est un avantage.

### Déclaration de confidentialité de l'original

Données déclarées : usage (suivi inter-apps), localisation approximative, contact (nom, email, téléphone), contenu utilisateur. Cela confirme qu'il faut prévoir les étiquettes de confidentialité des stores pour notre app.

## Phase 2 à 5

Les phases suivantes sont documentées dans les fichiers dédiés :

| phase | document |
| --- | --- |
| Analyse fonctionnelle | `03-FUNCTIONAL-SPECIFICATIONS.md`, `04-USER-FLOWS.md` |
| UI / UX | `05-SCREEN-INVENTORY.md`, `06-UI-UX-SPECIFICATIONS.md`, `07-DESIGN-SYSTEM.md` |
| Technique | `08-SOFTWARE-ARCHITECTURE.md`, `09-DATABASE-SCHEMA.md`, `10-API-SPECIFICATIONS.md` |
| Reconstruction | `15-BACKLOG.md` |

## Observations techniques (indices, non vérifiés)

Selon AppGoblin : Flutter et Kotlin, Firebase (analytics), RevenueCat, Square. Ces informations viennent d'un tiers et **ne conditionnent pas** nos choix.

## Limites de l'analyse

1. Aucune capture d'écran de l'app n'a été examinée. Les écrans sont déduits.
2. Aucune interface n'a été parcourue : les règles métier (quotas, limites de messages gratuits, algorithme de classement) sont inconnues.
3. Une étude systématique des avis n'a pas été faite : la section « Points faibles » ne repose que sur les avis visibles sur la fiche App Store FR (pas de date ni de nombre relevés).
4. Les prix en euros viennent de la fiche App Store FR ; ceux en dollars (2,99 à 54,99 $) viennent de la fiche US. Ils varient selon le pays.

## Conformité de la méthode

| règle | respectée |
| --- | --- |
| Sources publiques seulement | oui |
| Aucun compte tiers | oui |
| Aucun scraping de masse | oui (4 pages lues une par une, plus 4 recherches web) |
| Pas de code ou d'API privée | oui |
| Captures de l'original = référence uniquement | sans objet (aucune capture) |
