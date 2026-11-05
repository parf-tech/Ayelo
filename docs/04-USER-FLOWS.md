# 04 : Parcours utilisateur

Les identifiants d'écran (S01…) renvoient à `05-SCREEN-INVENTORY.md`. Les clics sont ceux du chemin nominal : c'est le chiffre à battre.

## F00 Connexion d'un compte existant (phase A)

```
S01 Accueil -> « Se connecter » -> S02 (mode connexion, email ou Google/Apple/TikTok) -> S10 Découverte
```
- Clics nominaux : 2 (hors saisie). **Pas de S63 ni S68** : le contrôle d'âge et les consentements ont déjà eu lieu à l'inscription.
- OAuth : `age_token` exigé seulement si le compte n'existe pas encore ; sinon connexion directe.
- Cas limites : mot de passe oublié (F15) ; nouvel appareil (session ajoutée, alerte) ; compte suspendu (F18) ; 5 échecs (429) ; compte supprimé ou banni (message neutre, `banned_identifiers`).

## F01 Inscription et onboarding (phase A)

```
S01 Accueil -> S63 Consentements -> S68 Date de naissance (contrôle d'âge, jeton signé)
 -> S02 Inscription (email/Google/Apple, exige le jeton) -> S03 Vérif. email
 -> S04 Profil de base -> S05 Intention -> S06 Photos -> S07 Préférences -> S10 Découverte
```
- Clics nominaux : environ 11 (hors saisie).
- Cas limites : âge < 18 (blocage, message neutre) ; email déjà pris ; lien de vérification expiré ; upload photo échoué (nouvel essai) ; permission photos refusée (accès via sélecteur système) ; abandon à mi-parcours (reprise au bon écran).
- Règle : le profil n'est visible qu'une fois ≥ 1 photo approuvée.

## F02 Découverte et match (phase A)

```
S10 Découverte -> (swipe like) -> S12 Match -> S14 Conversation
S10 -> tap carte -> S11 Détail profil -> like / dislike / bloquer / signaler
```
- Clics nominaux : 1 (swipe) jusqu'au match.
- Cas limites : plus de profils (état vide avec suggestion d'élargir les filtres) ; limite de likes atteinte (S30 offre Premium) ; profil supprimé pendant l'affichage ; hors ligne (cartes mises en cache, actions en file).

## F03 Filtrer la découverte (phase A)

```
S10 -> S09 Filtres -> appliquer -> S10
```
- Filtres : âge, pays de résidence (y compris autre pays), origine, intention, vérifié uniquement.
- Cas limites : combinaison sans résultat ; changement de pays par un non-Premium (si restreint).

## F04 Messagerie (phase A)

```
S13 Liste conversations -> S14 Conversation -> envoyer texte
```
- Clics nominaux : 2 pour écrire.
- Cas limites : message en échec (renvoi manuel, même `client_id`) ; utilisateur bloqué (champ désactivé) ; conversation débloquée seulement par crédit (S31) ; message long > 2 000 caractères.

## F05 Envoyer image / note vocale (phases B et C)

```
S14 -> bouton pièce jointe -> choisir image/enregistrer vocal -> envoyer
```
- Cas limites : permission micro refusée ; enregistrement interrompu par un appel ; image refusée par la modération (message « contenu non autorisé »).

## F06 Appel audio / vidéo (phase D)

```
S14 -> bouton appel -> S15 Appel sortant -> (l'autre accepte) -> S17 En appel -> raccrocher -> S14
Appel manqué : S14 affiche S18 (résumé d'appel manqué) ; appelé occupé : état `busy`
Côté appelé : notification/écran S16 Appel entrant -> accepter/refuser
```
- Clics nominaux : 1 pour appeler, 1 pour accepter.
- Cas limites : permissions refusées ; sans réponse (30 s → appel manqué) ; réseau instable (bannière « reconnexion », échec après 30 s) ; occupé ; utilisateur bloqué ; app tuée (notification push haute priorité).

## F07 Stories (phase C)

```
S20 Fil de stories -> S21 Visionneuse (tap pour avancer) -> réagir
S20 -> Ajouter -> S22 Création -> S23 Visibilité -> publier
```
- Cas limites : expiration à 24 h pendant le visionnage ; suppression par l'auteur ; vidéo trop longue (coupée à 15 s).

## F08 Invitation vidéo (phase C)

```
S24 Fil des invitations -> S25 Créer une invitation (vidéo, activité, ville, date) -> publier
```
- Cas limites : date passée ; vidéo en cours de modération (invisible) ; invitation expirée (retirée automatiquement).

## F09 Passer Premium / acheter des crédits (phase B)

```
S30 Offres Premium -> choisir plan -> feuille d'achat du store -> S32 Confirmation
Historique : S50 -> S34 Historique des transactions
S31 Achat de crédits -> choisir pack -> feuille d'achat -> S32
```
- Clics nominaux : 3.
- Cas limites : achat annulé ; paiement en attente ; déjà abonné ; restauration d'achat ; remboursement ultérieur (crédits repris) ; webhook en retard (écran « en cours de validation »).

## F10 Cadeaux virtuels (phase E)

```
S14 -> bouton cadeau -> S33 Catalogue -> choisir -> confirmer (débit de crédits) -> animation dans S14
```
- Cas limites : crédits insuffisants (renvoi vers S31) ; double tap (idempotence) ; destinataire bloqué.

## F11 Bloquer / signaler (phase A)

```
S11 ou S14 -> menu -> Bloquer (confirmer) | Signaler -> motif -> détails -> envoyer
```
- Clics nominaux : 3.
- Cas limites : signalement d'un mineur suspecté (priorité maximale) ; déjà signalé (message neutre) ; bloquer pendant un appel.

## F12 Vérification de profil (phase B)

```
S40 Vérifier mon profil -> selfie guidé (pose aléatoire) -> envoi -> S41 En attente -> badge ou refus
```
- Cas limites : mauvaise lumière ; refus avec motif et nouvelle tentative (max 3 par 24 h).

## F13 Paramètres et suppression de compte (phase A)

```
S50 Paramètres -> S51 Confidentialité (masquer profil) | S52 Notifications | S53 Sessions | S54 Bloqués | S57 Mentions légales | S55 Supprimer le compte -> ré-authentification (mot de passe, ou jeton frais du fournisseur)
```
- Cas limites : abonnement actif (rappel d'annuler dans le store) ; suppression pendant une revue de signalement (données conservées le temps légal).

## F14 Administration (Filament, phase A)

```
Connexion admin + 2FA -> File de signalements -> ouvrir dossier -> décision -> journal d'audit
Connexion admin -> File de médias -> approuver / rejeter
```
- Cas limites : deux modérateurs ouvrent le même dossier (verrou optimiste) ; décision contestée (réouverture avec traçabilité).

## Parcours ajoutés après la relecture indépendante (2026-11-05)

```
F15 Mot de passe oublié (phase A)
    S02 -> S61 (email) -> lien reçu -> S61 (nouveau mot de passe) -> S02
    edge : lien expiré, email inconnu (réponse identique), trop de demandes (429)

F16 Vérifier son téléphone (phase B)
    S50 ou onboarding -> S62 (saisie du code) -> confirmé
    edge : code expiré (10 min), 5 essais, plafond de SMS par pays

F17 Consentements et refus d'âge (phase A)
    S01 -> S63 (consentements) -> S68 (date de naissance) -> si < 18 ans : S64 (refus neutre, rien n'est créé, refus mémorisé par hash)
    edge : retour arrière puis autre date (bloqué par le refus mémorisé)

F18 Compte suspendu et contestation (phase A)
    ouverture -> S65 (motif, durée) -> S66 (contester, une seule fois) -> décision notifiée
    edge : sanction expirée pendant la saisie

F19 Exporter mes données (phase A)
    S50 -> S67 (demander) -> notification quand prêt -> télécharger (lien signé, expire)
    edge : une demande par jour

F20 Compléments aux parcours existants
    F13 suppression de compte : ré-authentification par fournisseur pour les comptes sociaux
    F11 signalement : accessible aussi depuis S21 (story) ; cible 3 taps
    S08 : atteint depuis S59 (Mon profil) -> S08 -> enregistrer -> S06/S59
    S51 à S54, S56, S58, S60 : atteints depuis S50 / S59 (voir F13) et leur propre flux de réglage
```
