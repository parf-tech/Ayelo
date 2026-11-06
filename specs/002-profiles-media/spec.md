# Spécification 002 : Profils et médias

**Statut** : livré côté serveur | **Phase** : A | **Exigences** : FR-B-1 à B-9 | **Origine** : profil, pays d'origine/résidence, intention, profil vidéo = **confirmé** (App Store, site) ; photos multiples = choix produit

## Parcours
- **US1 (P1)** Créer son profil : nom d'affichage, genre, pays d'origine et de résidence, ville, bio (500), intention parmi 5. Le changement de pays de résidence est limité à une fois par semaine.
- **US2 (P1)** Ajouter 1 à 6 photos : URL présignée, dépôt direct, relecture réelle de l'objet (type, taille), passage en file de modération. Jamais publique avant approbation. Réordonner, supprimer.
- **US3 (P1)** Régler sa confidentialité : masquer son profil, sa distance, sa dernière connexion.
- **US4 (P2)** Régler ses préférences de recherche (genres, âge ≥ 18, pays, origines, intentions, vérifiés seulement).
- **US5 (P1)** Voir le profil d'un autre : visible seulement s'il est actif, affiché, non bloqué (dans les deux sens), et si le demandeur a lui-même un profil ; sinon 404 identique.

## Cas limites
Fichier plus gros que déclaré (supprimé, refusé) ; type MIME falsifié ; 7e photo ; réordonner avec des identifiants étrangers ; média d'autrui.

## Hors périmètre ici
Profil vidéo et transcodage (B6, 012) ; vérification du profil (voir 005/008) ; modération automatique (ADR 005, prestataire non choisi).

## Critères de réussite
Aucun média non approuvé visible par un tiers ; aucune fuite d'e-mail, date de naissance exacte ou position.
