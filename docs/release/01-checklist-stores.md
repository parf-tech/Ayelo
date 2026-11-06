# Liste de contrôle de publication (Apple App Store et Google Play)

**Statut** : brouillon de l'équipe technique. Les règles des stores changent : chaque ligne marquée « à vérifier » doit être comparée à la politique officielle en vigueur **le jour de la soumission**. Aucun élément n'a été soumis.

Légende : [x] prouvé | [~] écrit, non vérifié | [ ] à faire

## Comptes et organisation (dépend du propriétaire)
- [ ] Entité juridique décidée (particulier ou société) avant d'ouvrir les comptes
- [ ] Apple Developer Program (99 $/an, source `docs/14b-COSTS.md`)
- [ ] Google Play Console (frais d'inscription à confirmer ; compte personnel neuf : test fermé de 12 testeurs pendant 14 jours consécutifs avant la production)
- [ ] Numéro D-U-N-S si compte société Apple (à vérifier)
- [ ] Déclaration du statut de professionnel (DSA) dans les stores si l'éditeur est dans l'UE (à vérifier)

## Contenu généré par les utilisateurs (Apple 1.2, Google UGC) — à vérifier dans les politiques
- [x] Signalement d'un profil, d'une conversation, d'un appel, d'une story — API (`POST /reports`)
- [x] Blocage d'un utilisateur — API (`POST /blocks`) ; [~] écrans mobiles à faire
- [~] Modération avant publication des photos (file humaine ; interface d'administration à faire, spec 009)
- [ ] Délais de traitement publiés et tenus (24 h ; 2 h mineur suspecté) — dépend de l'effectif de modération
- [ ] Coordonnées du support dans l'application et sur la fiche
- [ ] Filtre de contenu offensant (texte) — spec 011 T007

## Âge et classification
- [x] Âge minimal 18 ans contrôlé avant la création du compte (déclaratif)
- [ ] Questionnaire de classification d'âge rempli (contenu de rencontres, UGC, achats)
- [ ] Mentions de vigilance pour mineurs : aucun service aux mineurs

## Comptes et suppression
- [x] Suppression du compte dans l'application — API (`DELETE /me`) ; [~] écran à faire
- [x] Demande de suppression depuis le web — API ; [ ] page web publique à publier
- [ ] URL de suppression déclarée dans la fiche Google Play (à vérifier)
- [ ] Révocation des jetons « Se connecter avec Apple » à la suppression (à vérifier ; non implémentée)
- [x] « Se connecter avec Apple » proposé en même temps que Google (règle Apple : à vérifier)

## Achats intégrés
- [ ] Produits créés et approuvés : `premium_1m`, `premium_3m`, `premium_12m`, `conversation_1`, `conversation_5`, `conversation_10`
- [ ] Écran d'abonnement : prix, durée, renouvellement automatique, liens CGU et confidentialité, « Restaurer les achats »
- [ ] Achat testé en bac à sable (TestFlight / test interne) et reçu par le webhook
- [ ] Aucun lien vers un paiement externe pour des biens numériques consommés dans l'application

## Confidentialité
- [ ] Politique de confidentialité publiée (validée juridiquement : `docs/legal/`)
- [ ] Étiquettes de confidentialité Apple (données collectées : contact, contenu utilisateur, identifiants, usage, achats, position si activée)
- [ ] Section « sécurité des données » Google Play
- [ ] Textes d'autorisation (caméra, micro, photos, notifications, localisation si utilisée)

## Appels
- [ ] Prototype D0 validé sur iPhone et Android réels (`specs/008-calls`)
- [ ] Capacités d'arrière-plan déclarées (VoIP, audio) et justifiées
- [ ] Notice de confidentialité des appels (non enregistrés)

## Fiche
- [ ] Nom définitif (recherche d'antériorité professionnelle) ; domaine
- [ ] Captures d'écran (jamais de captures de l'application originale ni de ses images)
- [ ] Description et mots-clés en français et en anglais
- [ ] Identifiants de test pour la revue (compte de démonstration, sans données réelles)

## Pistes et déploiement
- [ ] TestFlight (interne) puis Google Play test interne puis **test fermé** (12 testeurs, 14 jours) puis production
- [ ] Builds signés en intégration continue (EAS ou local sur Mac)
- [ ] Plan de retour arrière
