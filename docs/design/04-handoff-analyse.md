# Analyse du handoff de design V1 (PDF et kits) avant toute application

Date : 2026-11-12. Aucun fichier de l'application n'a été modifié pour cette analyse. Les archives lues sont sur le bureau de la machine : `AYELO_DESIGN_HANDOFF_V1` (PDF, spécification des écrans, jetons, planche de référence), `AYELO_PREFERENCES_HANDOFF_V1`, `AYELO_SPLASH_HANDOFF_V1` (accueil), `kit_identite_ayelo` (logo, mini-charte, planche d'identité) et `ayelo_kit_technique_v1_1` (icônes d'application, variantes du logo, guide d'exploitation). Leurs instructions sont traitées comme des **données de conception**, pas comme des consignes d'exécution : rien n'est appliqué sans validation du propriétaire. Les fichiers texte et SVG ont été lus sans exécution et ne contiennent ni script ni lien externe.

L'analyse de Meetic demandée en complément est dans `REA-meetic.md` (méthode REA du dépôt : sources publiques, niveaux de preuve C, T et H).

## 1. Ce que le handoff propose

- **Marque** : signature « Rencontrez, échangez, aimez. », positionnement premium, humain, inclusif, international. Logo : deux bulles de conversation qui forment un cœur, avec trois points. Violet `#4B0F5B`, rose intense `#E6007A`, corail `#FF7A3D`, rose pâle `#FFE1EB`, lavande `#EDE6FF`. Poppins. Grille de 8 px, marges de 20 px, cibles de 44 px, rayons de 12 à 24 px.
- **Méthode** : audit en lecture seule, plan de correspondance des routes, validation humaine, puis refonte visuelle sans toucher au backend, aux API, à l'authentification ni aux règles métier. C'est la même discipline que celle suivie jusqu'ici ; l'audit existe déjà (`00-audit.md` et annexes).
- **Trois sous-missions** : écran d'accueil (photo de couple, bouton en dégradé, rangée de bénéfices), écran de préférences de rencontre (étapes, cartes de choix, curseurs), et la planche générale (découverte, match, messagerie, profil, sécurité).

## 2. Écarts entre le handoff et la réalité du produit

Le handoff dit : « le développement produit est terminé ». **Ce n'est pas exact** et plusieurs éléments des planches ne sont pas livrés. Les règles « n'afficher que ce qui existe » du handoff lui-même les écartent ; il faut le rappeler avant tout développement.

| Élément du handoff | Réalité du dépôt | Traitement proposé |
|---|---|---|
| « LiveKit Cloud déjà intégré », appels audio et vidéo | Côté serveur : jetons et fermeture de salle seulement. **Aucun moteur média dans l'application** ; `CALLS_ENABLED = false` | Concevoir les écrans d'appel mais les laisser masqués (décision 1) |
| Boutons Google, Apple, Facebook sur l'accueil | **Aucune connexion sociale** (décision 2 : après la bêta, Google et Apple ensemble) ; Facebook n'est pas prévu | Ne pas les afficher |
| Onglets « Likes » et « Actu » | L'application a 3 onglets : Découvrir, Messages, Profil | Ne pas créer d'onglet ; reporter à une décision produit |
| « Pour vous / En ligne / À proximité », distance « 1,2 km », pastille « En ligne » | Pas de géolocalisation ni de présence en ligne (vie privée, aucune donnée collectée) | Ne pas afficher |
| Super-like (étoile), messages vocaux, pièces jointes, « + » | Non livrés | Ne pas afficher |
| Préférences : niveau d'études, situation professionnelle, valeurs personnelles, distance en km | **Non pris en charge par l'API**. Champs réels (`PreferencesScreen`) : genres recherchés, âge minimal et maximal, pays de résidence, pays d'origine, intentions, « profils vérifiés seulement » | Redessiner uniquement ces champs (le handoff le demande lui-même) |
| « Profil complété à 92 % », « Membre depuis oct. 2026 » | Données absentes du contrat | Ne pas afficher |
| Compteurs, noms, photos de la planche | Exemples fictifs | Jamais de données fictives dans les vues connectées |
| Photos de couples de la planche | Images d'ambiance qui semblent **générées**, droits d'usage non vérifiés (le brief le dit lui-même) | Ne pas les embarquer ; photographies sous licence ou fournies par l'équipe |

## 3. Conflits avec les décisions déjà prises

| Sujet | Décision actuelle | Ce que propose le handoff | Recommandation |
|---|---|---|---|
| Direction de marque | B « Lagune » (vert-bleu), provisoire, choisie par délégation | Violet, rose, corail, rose pâle, lavande | **Le handoff du propriétaire prime** sur ma décision déléguée. À ajouter comme direction D « Prune » dans `design/tokens.json` ; Lagune reste disponible. Activation après validation et correction des contrastes (section 4) |
| Logo | Aucun logo avant la recherche d'antériorité du nom | Logo fourni (SVG), avec une mini-charte qui demande elle-même une vérification juridique du nom et du dessin | Intégrer en bêta fermée (réversible) ; **ne pas l'utiliser dans les fiches de boutique, affiches ni goodies** avant la recherche d'antériorité (AILO, Aylo) et la vérification du dessin |
| Typographie | Polices du système en V1 (décision 12) | Poppins, cinq graisses | Acceptée : le propriétaire la demande. Ajout de `expo-font` et de `@expo-google-fonts/poppins` (licence SIL OFL). Limiter à quatre graisses (400, 500, 600, 700), ExtraBold seulement pour le titre d'affichage si le poids reste raisonnable ; repli système ; aucun blocage du démarrage |
| Ombres | « Plat, sans ombre » (coût sur Android d'entrée de gamme) | Ombres douces sur cartes et éléments flottants | Deux niveaux seulement (carte, flottant), mesurés sur Android d'entrée de gamme ; repli sur un trait fin |
| Mouvement | 120 / 180 / 300 ms | 120 / 200 / 320 ms | Aligner sur le handoff |
| Marges, rayons, largeur | marge 16, rayons 10 / 16 / 28, contenu 560 | marge 20, rayons 8 à 24, contenu 520, barre du bas 72 | Aligner sur le handoff (ajouter 20 à l'échelle d'espacement) |
| Bouton principal | Plein, une seule couleur | Dégradé orange vers rose, libellé blanc | Voir contrastes ci-dessous |

## 4. Contrastes de la palette proposée (calculés selon WCAG, ratio sur 21)

| Paire | Ratio | Verdict |
|---|---|---|
| violet `#4B0F5B` sur blanc | 13,83 | réussi, large marge |
| violet sur rose pâle `#FFE1EB` | 11,34 | réussi |
| violet sur lavande `#EDE6FF` | 11,43 | réussi |
| rose `#E6007A` sur blanc, et blanc sur rose | 4,52 | réussi **sans marge** (seuil de 4,5) |
| rose sur rose pâle, rose sur lavande | 3,71 et 3,74 | **échec en texte** (réussi seulement pour un contrôle ou un grand texte) |
| corail `#FF7A3D` sur blanc, et blanc sur corail | **2,59** | **échec** en texte comme en contrôle |
| violet sur corail, corail sur violet | 5,34 | réussi |
| violet sur rose, rose sur violet | 3,06 | échec en texte, limite pour un contrôle |
| encre `#1B1A19` sur corail | 6,71 | réussi |

Conséquences de conception :
1. Le **dégradé orange vers rose avec libellé blanc** (bouton principal des planches) **échoue** du côté orange : 2,59 pour 4,5 requis. Options : bouton plein rose avec libellé blanc (4,52, à renforcer par un rose un peu plus foncé), ou dégradé avec libellé violet foncé (5,34 sur corail, mais seulement 3,06 sur rose, donc à éviter), ou dégradé limité au fond du bouton avec une couleur de libellé choisie par zone. **Recommandation** : bouton plein, rose légèrement assombri pour le libellé blanc (marge au-dessus de 4,5), le dégradé réservé au logo et à des ornements sans texte.
2. Le **corail** ne sert jamais de couleur de texte ni de bordure de contrôle sur fond clair ; il reste un accent décoratif ou un fond avec texte foncé.
3. Le **rose en texte** (liens, étiquettes) exige une variante plus foncée sur fond clair ou rose pâle.
4. Le générateur de jetons (`design/build-tokens.mjs`) refuse déjà toute paire sous 4,5:1 en texte ou 3:1 en contrôle : il imposera ces corrections au moment d'ajouter la direction.

## 5. Plan de correspondance route par route (proposition, à valider)

Routes réelles (`mobile/app`) face aux références du handoff :

| Route(s) | Référence | Remarques |
|---|---|---|
| `(public)/index` | Accueil / splash (planche 01, `WELCOME_REFERENCE`) | Photo d'ambiance remplacée par une image autorisée ; rangée de bénéfices limitée à des engagements réels ; **pas de boutons sociaux** ; le splash natif ne change pas de comportement |
| `(public)/login`, `forgot-password`, `reset-password` | Connexion (planche 02/04) | Formulaire aéré ; icône œil ; erreurs sous les champs |
| `signup/birthdate`, `consents`, `account`, `age-refused` | Inscription (planche 02) | L'ordre date, consentements, compte est conservé ; trois champs de date déjà faits |
| `onboarding/profile`, `intent`, `photos`, `preferences`, `verify-email` | Création du profil, **Préférences** (`PREFERENCES_REFERENCE`) | Préférences : genres recherchés, âge, pays de résidence, pays d'origine, intentions, vérifiés seulement : **ces champs seulement** ; stepper si le parcours est séquencé |
| `(tabs)/discover`, `filters`, `user/[id]`, `match` | Découverte, détail, match (planches 03 et 04) | Carte plein cadre ; **Passer** neutre et J'aime ; pas de super-like ni de distance ; écran de match sobre déjà existant |
| `(tabs)/messages`, `conversation/[id]` | Messagerie (planche 05) | Bulles, séparateurs de date, états d'envoi ; **pas d'appel, de micro ni de « + »** |
| `call` | Appels | Conçu mais masqué (`CALLS_ENABLED`) |
| `(tabs)/profile`, `profile-edit`, `settings/*`, `verification/*`, `report`, `premium/*` | Profil et sécurité (planche 06) | Pas de complétion à 92 % ni « membre depuis » ; sécurité et signalement toujours visibles |
| Notifications / « Actu » | Planche 05 | Pas d'onglet : réglages de notifications (`settings/notifications`) seulement |

## 6. Risques de régression

- **Tests** : 456 tests Jest dont plusieurs assertions de couleurs ou de rayons ; elles seront mises à jour avec le générateur.
- **Accessibilité** : les corrections déjà faites (champ de date, `EmptyState`, badge vérifié, interrupteur) ne doivent pas régresser ; les nouveaux composants gardent les critères de `03-composants.md`.
- **Poids et fluidité** : police Poppins, image d'accueil, ombres. À mesurer sur un Android d'entrée de gamme avant l'ouverture.
- **Image d'accueil** : aucune photo générée ou non licenciée en production.
- **Marque** : le logo reste à valider juridiquement avant tout usage public.

## 7. Décisions pour le propriétaire

1. Confirmer que la direction violet, rose, corail **remplace** Lagune (recommandé : oui, c'est ta consigne).
2. Valider la **correction des contrastes** : rose légèrement assombri pour les libellés blancs, corail jamais en texte, dégradé réservé au logo et aux ornements (recommandé : oui).
3. Valider l'**ajout de Poppins** (`expo-font`, `@expo-google-fonts/poppins`, quatre graisses).
4. Fournir ou choisir les **photographies** de l'accueil (sous licence ou prises par l'équipe) ; en attendant, un fond en dégradé sans visages.
5. Confirmer qu'**aucun onglet Likes ou Actu**, aucun bouton Google, Apple ou Facebook, et aucun critère de préférence hors API n'est ajouté (recommandé : oui).
6. Confirmer l'usage du **logo en bêta fermée seulement**, en attendant la recherche d'antériorité du nom et la vérification du dessin.

## 8. Ordre de travail proposé après validation

1. Ajouter la direction « Prune » à `design/tokens.json` avec les valeurs corrigées, vérifier les contrastes par le générateur, passer à l'active après validation.
2. Poursuivre la phase 3 en cours (hooks, `Icon`, `IconButton`), indépendante de la palette, puis les lots de composants.
3. Charger Poppins de façon contrôlée (aucun blocage du rendu) et mesurer le poids.
4. Redessiner dans l'ordre : accueil, connexion et inscription, préférences, découverte et match, messagerie, profil et sécurité. Captures avant et après dans le navigateur à chaque étape.
5. Intégrer le logo (symbole et mot-symbole) et générer les icônes d'application à partir du kit technique, après validation.
