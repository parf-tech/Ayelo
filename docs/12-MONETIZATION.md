# 12 : Monétisation

## Ce que l'original expose publiquement (App Store US)

- Abonnement ou « Premium » à 1, 6 et 12 mois.
- Achats ponctuels « Conversation » et « Propositions » à 0,99 $.
- Paliers d'abonnement de 2,99 $ à 54,99 $.
- 100 % des revenus viennent des achats intégrés, sans publicité (AppGoblin, estimation tierce).
- Possibilité d'obtenir du Premium gratuitement via réseaux sociaux, invitations et défis (fiche coréenne, non relue).

Les prix de notre application seront **fixés par l'étude de marché** et non copiés. Ils servent seulement de repère.

## Modèle proposé

| produit | type | usage | phase |
| --- | --- | --- | --- |
| Premium 1 / 3 / 12 mois (l'original montre 1 et 3 mois en France) | abonnement auto-renouvelé | likes illimités, annulation du dernier dislike (FR-C-6), message avant match sans crédit (FR-D-11 : sans Premium, il consomme un crédit « Conversation »), badge. « Filtres avancés » et « vu par » : **non spécifiés**, hors lancement tant qu'ils n'ont ni FR ni écran | B |
| Pack « Conversation » | achat consommable | débloque une conversation avec un non-match | B |
| Pack « Propositions » | achat consommable | **à spécifier** : l'original l'expose sans le décrire. Hypothèse : permet d'envoyer une demande de contact à un profil non compatible. Si non spécifié avant la phase B, retiré du lancement. Motif de dépense : `spend_proposal` | B (à confirmer) |
| Pièces (coins) | achat consommable | monnaie pour cadeaux virtuels | E |
| Cadeaux virtuels | dépense de pièces | envoyés dans une conversation | E |

Gratuit : inscription, profil, découverte limitée par jour, matchs, messagerie entre matchs, signalement, blocage. **La sécurité n'est jamais payante.**

## Règles des stores

1. Abonnements, crédits et cadeaux consommés dans l'app **doivent** être vendus via l'achat intégré d'Apple et de Google. Pas de lien vers un paiement externe pour ces biens dans l'app.
2. Apple exige l'option « Restaurer les achats », une description claire de l'abonnement (prix, durée, renouvellement) et un moyen de gérer ou annuler l'abonnement.
3. Les cadeaux virtuels sont des biens numériques : pas de conversion en argent réel pour les destinataires.
4. Pas de gains monétaires pour les utilisateurs (éviter tout schéma pouvant ressembler à du jeu d'argent ou à de la rémunération sexuelle).
5. Les commissions des stores s'appliquent (à vérifier selon le programme : taux réduit pour petites entreprises).

## Architecture de paiement

```
App (RevenueCat SDK) -> achat via store -> RevenueCat valide le reçu
 -> webhook POST /webhooks/revenuecat (authentifié par un en-tête secret configuré dans RevenueCat ; à vérifier dans leur documentation) -> Laravel
 -> table webhook_events (idempotence) -> subscriptions / purchases / credit_ledger
 -> événement temps réel `billing.updated` -> l'app rafraîchit
```

- La source de vérité pour l'état Premium est le **serveur** (reçu validé par RevenueCat), pas l'app.
- Les crédits sont un **registre en ajout seulement** (`credit_ledger`) : jamais de solde modifié à la main.
- Une dépense de crédit est faite dans une transaction : verrouillage de la ligne utilisateur, vérification du solde, écriture du registre, création de la ressource (conversation ou cadeau).

## Protection contre les doubles transactions

| cas | protection |
| --- | --- |
| Webhook envoyé deux fois | `webhook_events.id` unique |
| Même achat synchronisé par l'app et par webhook | `purchases.transaction_id` unique |
| Double tap sur « envoyer le cadeau » | `Idempotency-Key` + `gift_sends.idempotency_key` unique |
| Deux appareils dépensent le dernier crédit | verrou de ligne + vérification du solde dans la transaction |
| Webhook en retard | écran « validation en cours » + `POST /billing/sync` |

## Remboursements

1. Les remboursements Apple / Google arrivent par webhook RevenueCat. Les noms exacts des types d'événements (annulation, remboursement) sont **à lire dans la documentation officielle de RevenueCat** avant l'implémentation.
2. Le serveur écrit une ligne `refund_reversal` dans `credit_ledger` et passe l'achat en `refunded`.
3. Si le solde est insuffisant (crédits déjà dépensés), le solde passe à zéro et le cas est signalé à l'administration ; pas de solde négatif.
4. Abus récurrents de remboursement : signal de risque (`risk_events`).
5. Remboursements directs : renvoyés vers le store (nous ne les traitons pas nous-mêmes pour les achats in-app).

## Administration (Filament)

- Consulter abonnements, achats, historique de crédits d'un utilisateur.
- Ajuster des crédits (motif obligatoire, journal d'audit).
- Offrir du Premium (promo) avec date de fin.
- Tableaux de bord : revenus, conversion, désabonnements, remboursements.

## Indicateurs

| indicateur | cible initiale |
| --- | --- |
| Conversion gratuit → payant | à mesurer, hypothèse 2–4 % |
| Rétention à 30 jours des abonnés | à mesurer |
| Taux de remboursement | < 3 % |
| Revenu par utilisateur payant | à mesurer |

Ces cibles sont des **hypothèses** à valider avec les premières données.

## Points à valider avec le propriétaire

1. Pays de facturation et devises visées (Afrique : moyens de paiement limités, achats via opérateur mobile).
2. Faut-il un paiement local (Mobile Money) pour le web, hors app ? Hors stores, soumis à d'autres règles et au prestataire choisi.
3. Entité juridique qui vend (compte Apple Developer, fiscalité).
4. Politique de prix par pays.
