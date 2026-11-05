# 05 : Inventaire des écrans

Inventaire **déduit** des fonctions documentées et du master prompt. Aucune capture de l'original n'a été analysée. Les identifiants sont stables.

Colonnes : phase (A à E), états à construire (V = vide, C = chargement, R = rempli, E = erreur, H = hors ligne, P = permission refusée).

| ID | écran | accès | but | composants clés | états | phase |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | Accueil | ouverture | entrée, valeur du produit | logo, boutons de connexion, liens CGU | R | A |
| S02 | Inscription / connexion | S01 (mode **connexion**, sans S63 ni S68) ; S68 (mode **inscription**, après contrôle d'âge) | créer ou ouvrir un compte | champs email/mot de passe, boutons Google/Apple | R, E | A |
| S03 | Vérification email | après S02 | confirmer l'email | message, renvoyer le lien | R, E | A |
| S04 | Profil de base | onboarding | nom, genre, pays, ville (la date de naissance est saisie en S68, avant le compte) | champs, sélecteur pays | R, E | A |
| S05 | Intention | onboarding | choisir l'intention | 5 cartes de choix | R | A |
| S06 | Photos | onboarding | ajouter 1 à 6 photos | grille, bouton d'ajout, état « en revue » | V, C, R, E, P | A |
| S07 | Préférences | onboarding / réglages | genre, âge, pays, origine | curseurs, sélecteurs | R | A |
| S08 | Vidéo de profil | profil | enregistrer une vidéo (60 s) | caméra, minuteur, aperçu | C, R, E, P | B |
| S09 | Filtres | S10 | filtrer la découverte | sélecteurs, bascule « vérifiés » | R | A |
| S10 | Découverte (swipe) | onglet 1 | voir et liker des profils | pile de cartes, boutons like/dislike | V, C, R, E, H | A |
| S11 | Détail du profil | tap sur carte | profil complet, actions | galerie, vidéo, bio, menu bloquer/signaler | C, R, E | A |
| S12 | Match | après like réciproque | célébrer le match | animation, boutons « Écrire » / « Continuer » | R | A |
| S13 | Liste de conversations | onglet 2 | accéder aux discussions | lignes avec avatar, aperçu, badge non lu, présence | V, C, R, E, H | A |
| S14 | Conversation | S13 | échanger | bulles, champ, pièces jointes, boutons appel/cadeau, accusés | V, C, R, E, H | A |
| S15 | Appel sortant | S14 | appeler | avatar, état « sonne… », raccrocher | R, E, P | D |
| S16 | Appel entrant | push / app ouverte | accepter ou refuser | avatar, accepter, refuser | R | D |
| S17 | En appel | S15/S16 | communiquer | vidéo, micro, caméra, haut-parleur, signaler, raccrocher | R, E (reconnexion) | D |
| S18 | Résumé d'appel manqué | S14 | informer | ligne dans la conversation | R | D |
| S20 | Fil de stories | onglet 3 | voir les stories | barre de cercles, bouton « + » | V, C, R, E | C |
| S21 | Visionneuse de story | S20 | regarder, réagir | plein écran, barre de progression, réactions | C, R, E | C |
| S22 | Création de story | S20 | publier | caméra / galerie, texte, minuteur 15 s | R, E, P | C |
| S23 | Visibilité de la story | S22 | choisir qui voit | liste d'options | R | C |
| S24 | Fil des invitations | onglet 4 | découvrir des invitations | cartes vidéo, filtre pays | V, C, R, E | C |
| S25 | Créer une invitation | S24 | publier | vidéo, titre, activité, ville, date | R, E | C |
| S30 | Offres Premium | profil / quota atteint | vendre l'abonnement | plans 1/3/12 mois, avantages, restaurer, prix, durée, renouvellement automatique, liens CGU et confidentialité | R, E | B |
| S31 | Achat de crédits | S14 / S30 | packs de crédits | cartes de packs | R, E | B |
| S32 | Confirmation d'achat | après achat | confirmer | message, solde | R, E (validation en cours) | B |
| S33 | Catalogue de cadeaux | S14 | choisir un cadeau | grille, prix en crédits | R, E | E |
| S34 | Historique des transactions | réglages | consulter | liste datée | V, R | B |
| S40 | Vérifier mon profil | profil | lancer la vérification | consignes, caméra | R, E, P | B |
| S41 | État de la vérification | S40 | suivre | en attente / approuvé / refusé + motif | R | B |
| S50 | Paramètres | profil | réglages généraux | liste | R | A |
| S51 | Confidentialité | S50 | masquer profil, distance, dernière connexion | bascules | R | A |
| S52 | Notifications | S50 | choisir les notifications | bascules par type | R | A |
| S53 | Sessions et appareils | S50 | voir et fermer les sessions | liste d'appareils | V, R | A |
| S54 | Utilisateurs bloqués | S50 | débloquer | liste | V, R | A |
| S55 | Supprimer mon compte | S50 | suppression | avertissements, ré-authentification (mot de passe, ou jeton frais du fournisseur pour un compte social) | R, E | A |
| S56 | Support / aide | S50 | contacter le support | formulaire, FAQ | R, E | B |
| S57 | Mentions légales | S50 / S01 | CGU, confidentialité, règles de la communauté | texte | R | A |
| S58 | Signalement | S11 / S14 / S17 / S21 | signaler | motifs, détails | R, E | A |
| S59 | Mon profil | onglet 5 | voir et modifier son profil | aperçu, boutons | R, E | A |
| S60 | Édition du profil | S59 | modifier bio, photos, infos | champs | R, E | A |
| S61 | Mot de passe oublié | S02 | demander puis saisir un nouveau mot de passe | champ email, lien, nouveau mot de passe | R, E | A |
| S62 | Saisie du code SMS | onboarding / réglages | valider le téléphone | 6 cases, renvoi du code | R, E | B |
| S63 | Consentements | onboarding | CGU, confidentialité, données sensibles, localisation | cases distinctes, textes bilingues | R | A |
| S64 | Refus d'âge | S68 | informer sans détailler | message neutre | R | A |
| S65 | Compte suspendu | ouverture | motif, durée, contester | message, bouton « contester » | R | A |
| S66 | Contestation d'une sanction | S65 | écrire à l'équipe | champ de texte | R, E | A |
| S67 | Export de mes données | S50 | demander et télécharger | bouton, état | R, E | A |
| S68 | Date de naissance | S63 | saisir la date **avant** la création du compte | sélecteur de date, message d'âge minimum | R, E | A |

Écrans d'administration (Filament, hors mobile) : tableau de bord, utilisateurs, médias à modérer, signalements, vérifications de profil, abonnements, crédits, journaux d'audit, statistiques. Voir `03-FUNCTIONAL-SPECIFICATIONS.md` section H.

## Navigation

Barre d'onglets : **Découvrir** (S10), **Messages** (S13), **Stories** (S20, phase C), **Invitations** (S24, phase C), **Profil** (S59). Avant la phase C, on garde 3 onglets : Découvrir, Messages, Profil.

## Totaux

Écrans mobiles : 50 (comptés par commande). Phase A : 30. Phase B : 9. Phase C : 6. Phase D : 4. Phase E : 1 (S33, cadeaux). Stories et invitations (phase C) arrivent après le lancement.
