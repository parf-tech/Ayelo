# 14b : Tableau de coûts mensuels (tâche P0-8)

Lecture des tarifs officiels : **2026-11-05**. Prix en dollars US tels qu'affichés. Le taux de change n'est pas vérifié : pour comparer au budget de 30 à 80 €, l'hypothèse de travail est **1 USD ≈ 0,9 €** (80 € ≈ 89 $), à confirmer. Les tarifs changent : relire avant tout achat.

## Tarifs relevés (sources)

| poste | tarif relevé | source |
| --- | --- | --- |
| VPS Hostinger KVM 2 (2 vCPU, 8 Go, 100 Go NVMe) | 8,79 $/mois sur 24 mois, **210,96 $ payés d'avance** ; renouvellement 14,99 $/mois | https://www.hostinger.com/vps-hosting |
| VPS Hostinger KVM 4 (4 vCPU, 16 Go, 200 Go NVMe) | 12,99 $/mois sur 24 mois, 311,76 $ d'avance ; renouvellement 28,99 $/mois | idem |
| Cloudflare R2 | stockage 0,015 $/Go-mois ; opérations A 4,50 $/million, B 0,36 $/million ; sortie de données gratuite ; gratuit : 10 Go, 1 M opérations A, 10 M opérations B | https://developers.cloudflare.com/r2/pricing/ |
| LiveKit Cloud | Build 0 $ : 5 000 minutes-participant, 50 Go, 100 connexions simultanées. Ship à partir de 50 $ : 150 000 min, 250 Go, 1 000 connexions ; dépassement 0,0005 $/min et 0,12 $/Go. Scale à partir de 500 $ | https://livekit.com/pricing |
| RevenueCat | gratuit jusqu'à 2 500 $ de revenu suivi par mois, puis 1 % | https://www.revenuecat.com/pricing/ |
| Sentry | Developer gratuit (1 utilisateur, 5 000 erreurs) ; Team 29 $/mois (26 $ en annuel), 50 000 erreurs | https://sentry.io/pricing/ |
| Resend (e-mail) | gratuit 3 000 e-mails/mois et 100/jour ; Pro 20 $/mois pour 50 000 ; dépassement 0,90 $ les 1 000 | https://resend.com/pricing |
| Expo EAS | gratuit : 15 builds Android + 15 iOS, file d'attente lente (attentes de 90 min et plus) ; Starter 19 $/mois | https://expo.dev/pricing |
| SMS (Twilio, France) | 0,0798 $ par SMS ; **tarifs Afrique non relevés** | https://www.twilio.com/en-us/sms/pricing/fr |
| Apple Developer Program | 99 $/an | https://developer.apple.com/programs/whats-included/ |
| Google Play | frais d'inscription **non vérifiés** (25 $ une fois selon ma connaissance générale, non confirmé par la page lue) ; compte personnel neuf : test fermé avec **12 testeurs pendant 14 jours consécutifs** avant la production | https://support.google.com/googleplay/android-developer/answer/14151465 |

## Hypothèses de volume

| | scénario bas (lancement) | scénario haut (croissance) |
| --- | --- | --- |
| Utilisateurs actifs par mois | 1 000 | 10 000 |
| Appels par mois (20 min max, 2 participants) | 100 (4 000 min-participant) | 3 000 (120 000 min-participant) |
| Stockage médias | 50 Go | 1 To |
| E-mails par mois | 2 500 | 40 000 |
| SMS par mois | 200 | 3 000 |
| Débit vidéo 480p | environ 0,5 Mbit/s (hypothèse) | idem : 450 Go sortants pour 120 000 min |

Ce sont des hypothèses, pas des mesures. Le scénario haut suppose aussi des revenus que je n'ai pas estimés.

## Coût mensuel

| poste | bas | haut | remarque |
| --- | --- | --- | --- |
| VPS | 8,79 $ (KVM 2) | 12,99 $ (KVM 4) | paiement d'avance sur 24 mois ; puis 14,99 $ ou 28,99 $ par mois |
| Cloudflare R2 | 0,60 $ | 14,85 $ | (50 − 10) Go et (1 000 − 10) Go à 0,015 $ ; opérations dans la gratuité supposées |
| LiveKit | 0 $ (Build) | 74 $ (Ship 50 $ + environ 200 Go de dépassement à 0,12 $) | calcul du dépassement basé sur l'hypothèse de débit |
| Sentry | 0 $ | 29 $ | |
| E-mail (Resend) | 0 $ | 20 $ | |
| SMS | 15,96 $ | 239,40 $ | tarif France ; l'Afrique peut coûter plus |
| Expo EAS | 0 $ | 19 $ | optionnel : un Mac permet de compiler en local |
| RevenueCat | 0 $ | 0 $ | si le revenu suivi reste sous 2 500 $/mois |
| Apple Developer (99 $/an) | 8,25 $ | 8,25 $ | |
| **Total** | **33,60 $ (≈ 30 €)** | **417,49 $ (≈ 376 €)** | |
| Total sans SMS | 17,64 $ | 178,09 $ | |

Après les 24 premiers mois, le VPS passe à 14,99 $ (bas) ou 28,99 $ (haut) : +6,20 $ et +16,00 $ par mois.

## Non chiffré (à ajouter avant décision)

- Domaine (`ayelo.app` / `ayelo.io`) : prix non relevé.
- Compte Google Play (frais d'inscription à confirmer).
- **Modération automatique d'images** : fournisseur non choisi, tarif inconnu.
- **Modération humaine** (deux langues, plusieurs fuseaux) : probablement le plus gros poste réel ; non budgété.
- FCM / APNs (notifications) : considérés comme gratuits, non vérifié ici.
- Sauvegardes hors VPS (R2 : quelques Go, négligeable).
- TVA, impôts, commissions des stores (15 à 30 % du chiffre d'affaires), frais de paiement.

## Conclusions

1. **Le scénario bas tient dans le budget** de 30 à 80 € (≈ 30 € contre 80 €), mais seulement si les SMS restent marginaux, si LiveKit reste sur l'offre gratuite et si la modération humaine est assurée gratuitement (par vous).
2. **Le scénario haut dépasse le budget** de plus de quatre fois. Les deux causes : les **SMS** (239 $) et **LiveKit** (74 $). Cette croissance devrait s'accompagner de revenus, mais ils ne sont pas estimés ici.
3. **Décisions de réduction de coût proposées** (à valider par le propriétaire) :
   - Vérification de l'e-mail obligatoire ; **vérification du téléphone optionnelle et plafonnée** (par pays et par jour), réservée au badge de vérification. Cela supprime la plus grande dépense du scénario haut.
   - Appels réservés aux matchs, 20 min, 480p (déjà décidé), et appels vidéo réservés aux comptes vérifiés si la facture LiveKit dérive.
   - Compiler les applications en local sur votre Mac, pas d'abonnement EAS tant que les 15 builds gratuits suffisent.
4. **Le VPS** : l'ADR 001 parlait de « 8 Go / 4 vCPU ». La formule à 8 Go (KVM 2) n'a que **2 vCPU**. Pour 4 vCPU, il faut KVM 4 (16 Go). À trancher après mesure de la charge en phase A.
5. **Trésorerie** : le prix annoncé suppose un engagement de 24 mois payé d'avance (**210,96 $** pour KVM 2). Ce n'est pas un coût mensuel. Le prix « au mois » n'est pas affiché sur la page lue.

## Statut

Tâche P0-8 : tableau produit, tarifs datés, **non validé par le propriétaire**. Reste à chiffrer : domaine, modération, Google Play, SMS Afrique.
