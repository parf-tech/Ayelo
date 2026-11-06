# BROUILLON : Politique de confidentialité (non validée juridiquement)

> Brouillon technique à faire valider par un juriste. Les durées de conservation sont celles du **code actuel** ; elles ne sont pas des choix juridiques validés.

## 1. Responsable du traitement
[Identité, adresse, délégué à la protection des données, représentant dans l'UE/UK si nécessaire.]

## 2. Données que nous traitons et pourquoi

| donnée | finalité | base légale (à valider) | conservation actuelle du code |
| --- | --- | --- | --- |
| e-mail, mot de passe (haché), date de naissance | créer et sécuriser le compte, vérifier l'âge | contrat, obligation légale | jusqu'à anonymisation (30 jours après suppression) |
| nom d'affichage, genre, genre recherché, pays d'origine et de résidence, ville, intention, bio | profil et mise en relation | contrat ; **consentement explicite** pour les données sensibles | idem |
| photos | profil, après examen | contrat | supprimées à l'anonymisation |
| messages | échanges entre membres | contrat | contenu effacé à l'anonymisation du compte de l'expéditeur |
| selfie de vérification | vérifier le profil | **consentement explicite** | supprimé dès la décision |
| signalements, sanctions, journal d'audit | sécurité, modération, obligations légales | intérêt légitime, obligation légale | signalements et preuves : 1 an ; sanctions et hash d'e-mail d'un compte sanctionné : [durée à fixer] |
| appareil (empreinte), adresse IP | limites de débit, sécurité, mémoire d'un refus d'âge | intérêt légitime | IP : non stockée durablement, sauf refus d'âge (2 h) ; appareil : 90 jours pour un refus d'âge |
| achats | fournir l'accès Premium, comptabilité | contrat, obligation légale | [durée comptable — juriste] |
| position approximative (phase ultérieure) | rencontres à proximité | **consentement** | non applicable pour le lancement |

## 3. Données sensibles
Le genre et le genre recherché peuvent révéler une orientation sexuelle ; l'origine peut révéler une origine ethnique ; l'usage d'un service de rencontres peut révéler la vie sentimentale. Nous les traitons **uniquement avec votre consentement explicite**, que vous pouvez retirer (le profil est alors masqué).

## 4. Destinataires et sous-traitants
Les autres membres voient votre profil public (nom d'affichage, âge, pays, ville, bio, intention, photos approuvées, badge). Sous-traitants : [hébergeur], Cloudflare (stockage), RevenueCat, Apple, Google (paiements et notifications), LiveKit (appels), [fournisseur d'e-mail], [prestataire de modération]. [Transferts hors UE, garanties, accords de traitement : juriste.]

## 5. Vos droits
Accès et export (dans l'application), rectification, suppression (dans l'application ou sur [page web]), opposition, limitation, retrait du consentement, réclamation auprès de l'autorité de contrôle. [Adresse de contact.]

## 6. Mineurs
Le service est réservé aux personnes de 18 ans et plus. Un compte soupçonné d'appartenir à un mineur est suspendu et examiné.

## 7. Sécurité
Chiffrement des communications, mots de passe hachés, accès restreints, journalisation des actions d'administration. Aucune mesure n'est infaillible.

## 8. Sauvegardes
Des sauvegardes chiffrées sont conservées [14 jours + 3 mois] ; une donnée supprimée peut y subsister jusqu'à leur rotation, sans être restaurée en production. [À valider.]

Version : brouillon 0.1 (2026-11-06).
