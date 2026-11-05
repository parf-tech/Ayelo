# Recon map : Chat&Yamo (iOS / Android, site web léger en complément)

Périmètre : inscription et profil (photos et vidéo), matching par origine / intention / culture, chat, appel vidéo, invitations vidéo, "Explore", abonnement Premium.
Pour : le produit propre de l'utilisateur (niche diaspora à préciser).
Date : 2026-11-05

Limites de cette recon : faite uniquement à partir de sources publiques (fiches stores, site, CGU). Aucun écran n'a été vu directement et aucune capture n'est dans `screens/`. Les écrans ci-dessous sont donc **déduits** (confiance indiquée). Pour une recon fiable, l'utilisateur doit parcourir sa propre version de l'app et fournir des captures.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | App Store (US) | https://apps.apple.com/us/app/id1339782074 | description, achats intégrés, historique de versions |
| 2 | AppGoblin | https://appgoblin.info/apps/com.chatetyamo | stack technique, installs, revenus estimés |
| 3 | Site : conseils de sécurité | https://www.chat-yamo.com/?p=529 | "Show my profile", blocage, signalement |
| 4 | Site : CGU | https://www.chat-yamo.com/?p=626 | règles de compte, UGC, abonnements, login TikTok |
| 5 | CB Insights | https://www.cbinsights.com/company/chatyamo | société, fondation, siège |
| 6 | Pages Premium / Subscription / Testimonials du site | chat-yamo.com | liées depuis la navigation, **non lues** |

## Core loop

Un célibataire de la diaspora découvre des profils filtrés par origine et intention, discute, passe en appel vidéo avant d'échanger son numéro, et paie un abonnement Premium pour débloquer plus de conversations et de propositions.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen | confiance |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | Accueil / connexion | ouverture de l'app | entrée | boutons Chat&Yamo, TikTok, Google/Apple (à confirmer) | non connecté | high (TikTok login), medium (reste) |
| S02 | Inscription / onboarding | après S01 | créer le compte, âge 18+ | formulaire, âge, origine, pays | erreur âge < 18 | medium |
| S03 | Choix de l'intention | onboarding | Marriage, Long-lasting love, Flirt, Friendship, Let's Find Out | liste de choix | choisi | high |
| S04 | Création du profil | onboarding | photos, vidéo, bio, origine | upload photo/vidéo, champs | vide, rempli | medium |
| S05 | Accueil (home) | tab 1 | liste de profils, bouton "Show my profile" en haut à droite | cartes profil, toggle visibilité | vide, rempli | high (toggle) |
| S06 | Explore | tab | découverte swipe, profils vérifiés | cartes swipeables | vide, rempli | high |
| S07 | Recherche / filtres | depuis S05 | filtrer par pays (y compris autre pays), origine, intention | sélecteurs pays/origine | filtres actifs | high |
| S08 | Profil d'un autre utilisateur | tap sur carte | voir détails, bloquer, signaler | galerie, vidéo, boutons bloquer/signaler | normal, bloqué | high |
| S09 | Invitations vidéo (fil) | tab | voir/poster des invitations (film, concert, dîner) | cartes vidéo, bouton publier | vide, rempli | high |
| S10 | Publier une invitation vidéo | depuis S09 | enregistrer/envoyer une vidéo | caméra, titre, lieu/date | enregistrement, envoi, erreur | medium |
| S11 | Liste de conversations | tab | messages | liste, badge non lu | vide, rempli | high |
| S12 | Conversation | tap | chat texte, bouton appel vidéo, bloquer/signaler | bulles, champ, bouton vidéo | vide, envoi, quota atteint | high (chat/vidéo), medium (quota) |
| S13 | Appel vidéo | depuis S12 | appel avant échange de numéro | flux vidéo, boutons micro/caméra/raccrocher | appel entrant, sortant, échec | high |
| S14 | Singles à proximité | notification | alerte quand des utilisateurs sont proches | notification push, liste | permission refusée | medium |
| S15 | Boutique / Premium | depuis quotas ou profil | abonnements et achats | offres, prix, restaurer achats | actif, expiré | high |
| S16 | Achat ponctuel "Conversation" / "Propositions" | depuis S12 / S05 | débloquer à l'unité (0,99 $) | modal d'achat | succès, échec | medium |
| S17 | Paramètres | profil | notifications, visibilité, suppression du compte | liste réglages | normal | high |
| S18 | Suppression du compte | S17 | masque le profil, rappel d'annuler l'abonnement | confirmation | confirmé | high |
| S19 | Support client | S17 | contacter le support in-app | formulaire/chat | envoyé | medium |
| S20 | Coaching et événements | menu | coachs, événements en personne | liste d'événements | vide, rempli | guess |

## Flows

```
F01 Nouvel utilisateur crée son compte
    S01 -> S02 -> S03 -> S04 -> S05
    happy path clicks : ~8 (à mesurer sur l'app réelle)
    edge : âge < 18, email déjà pris, login TikTok annulé, vidéo trop lourde

F02 Trouver et contacter une personne
    S05 -> S07 -> S08 -> S12
    happy path clicks : 4
    edge : aucun résultat dans le pays, utilisateur bloqué, quota de conversations atteint -> S16/S15

F03 Passer en appel vidéo
    S12 -> S13
    happy path clicks : 1 depuis la conversation
    edge : permission caméra/micro refusée, interlocuteur hors ligne, connexion faible

F04 Poster une invitation vidéo
    S09 -> S10 -> S09
    happy path clicks : 3
    edge : permission caméra refusée, vidéo refusée par modération

F05 Passer Premium
    S12 (ou S05) -> S15 -> achat store -> retour
    happy path clicks : 3
    edge : achat annulé, déjà abonné, restauration d'achat

F06 Signaler ou bloquer
    S08 (ou S12) -> bloquer/signaler -> choix du motif
    happy path clicks : 3
    motifs : demande d'argent, harcèlement/menaces, comportement inapproprié en rencontre, faux profil/spam

F07 Supprimer son compte
    S17 -> S18
    edge : abonnement actif non annulé (à rappeler)

F08 Masquer son profil
    S05 -> toggle "Show my profile"
    happy path clicks : 1
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, pressed, disabled, loading | all |
| Carte profil | liste, plein écran swipe (Explore) | normal, vérifié, bloqué | S05, S06 |
| Sélecteur pays / origine | liste recherchable | vide, sélectionné | S02, S07 |
| Sélecteur d'intention | 5 choix | choisi, non choisi | S03, S07 |
| Lecteur vidéo | profil, invitation | chargement, lecture, erreur | S04, S08, S09 |
| Bulle de message | envoyé, reçu | envoi, envoyé, échec | S12 |
| Interface d'appel vidéo | entrant, sortant | sonnerie, connecté, échec | S13 |
| Carte d'offre | abonnement, achat ponctuel | actif, populaire | S15, S16 |
| Modal | confirmation, permission, achat | | S10, S15, S18 |
| Toast / bannière | succès, erreur | | all |
| Barre d'onglets | 4-5 onglets | actif, badge | S05, S06, S09, S11, S17 |
| Toggle | visibilité du profil, notifications | on, off | S05, S17 |

## Inferred data model

```
User         id, email, password_hash/provider (email|tiktok|google|apple), birthdate, gender,
             origin_country, residence_country, bio, intent, is_visible, is_verified,
             status (active|suspended|deleted), created_at
             evidence: CGU (18+, login TikTok), App Store (filtre par origine), page sécurité
             confidence: high

Media        id, user_id, type (photo|video), url, kind (profile|invite), moderation_status
             evidence: App Store (profils vidéo, invitations vidéo), CGU (UGC)
             confidence: high

Intent       enum : marriage, long_lasting_love, flirt, friendship, lets_find_out
             evidence: AppGoblin / App Store
             confidence: high

VideoInvite  id, user_id, media_id, title, activity (film|concert|dinner|autre), city, date, created_at
             evidence: App Store
             confidence: medium

Conversation id, user_a, user_b, created_at, unlocked_by (premium|purchase|free)
Message      id, conversation_id, sender_id, body, media_id?, sent_at, read_at
             evidence: App Store (chat), achats "Conversation" et "Propositions"
             confidence: medium (quotas = guess)

Call         id, conversation_id, caller_id, started_at, ended_at, status
             evidence: App Store (appels vidéo)
             confidence: medium

Block        id, blocker_id, blocked_id, created_at          confidence: high
Report       id, reporter_id, reported_id, reason (money|harassment|meeting_behavior|fake_spam), status, outcome (warning|ban)
             evidence: page sécurité                          confidence: high

Subscription id, user_id, plan (1m|6m|12m...), store (apple|google), status, started_at, renews_at
             evidence: App Store IAP, RevenueCat (AppGoblin)  confidence: high
Purchase     id, user_id, product (conversation|propositions), store, created_at
             evidence: App Store IAP                          confidence: medium

NearbyAlert  user_id, nearby_user_id, notified_at              confidence: guess
Event        id, title, city, date, coach?                     confidence: guess
```

Relationships : User 1-n Media, User 1-n VideoInvite, User n-n User via Conversation, Conversation 1-n Message, Conversation 1-n Call, User 1-n Block, User 1-n Report, User 1-n Subscription, User 1-n Purchase.

## Stack observée (indice, pas à copier)

Flutter + Kotlin, Firebase (analytics), RevenueCat (abonnements), Square, Google/Facebook (pubs), 100 % revenus IAP. Source : AppGoblin.

## Feature matrix

Voir `features.csv` (comptage par commande à jour : must 20, should 13, could 11 dont 4 skip).

## Out of scope (cannot or should not be cloned)

- La base d'utilisateurs et la communauté de la diaspora : c'est l'effet de réseau qui fait la valeur.
- Le programme de "profils certifiés" : le processus de certification n'est pas documenté publiquement.
- Les coachs de rencontre et les événements en personne : opérations humaines, pas du logiciel.
- La marque, le nom, le logo, les textes et les photos de Chat&Yamo.
- Les accords de paiement et la conformité des stores (à refaire côté clone).

## Size

Screens 20, flows 8, entités 13 (dont l'énumération `Intent`). Hard parts : appels vidéo temps réel, modération des vidéos et photos (UGC et sécurité des rencontres), abonnements et achats intégrés (stores + RevenueCat). Autres difficultés : notifications de proximité (géolocalisation et vie privée), messagerie temps réel. Taille : **L** (un trimestre pour un MVP solide ; M possible si on exclut appels vidéo et proximité en V1).

## Points à confirmer avec l'utilisateur

1. Niche ciblée du clone (diaspora d'origine ?).
2. Captures de sa propre version de l'app pour valider les écrans déduits.
3. Contenu des pages Premium / Subscription du site (non lues).
