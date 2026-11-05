# 01 : Vision du projet

## Énoncé

Une application de rencontres sérieuses et sûres pour les communautés de la diaspora, avec des profils vérifiés, une découverte par origine et intention, et des échanges qui passent du texte à la vidéo avant tout échange de coordonnées.

Le nom, le logo, les textes et les visuels sont **originaux** et à définir (voir `replica-brand`). Le nom Chat&Yamo n'est pas utilisé.

## Public cible (à confirmer)

- Célibataires de 18 ans et plus, d'origine africaine ou de la diaspora, vivant à l'étranger ou au pays.
- Intentions : mariage, amour durable, flirt, amitié, « on verra ».

## Proposition de valeur

1. **Confiance** : profils vérifiés, signalement en trois taps (cible unique, testée en E2E), modération réelle.
2. **Pertinence** : filtres par origine, pays de résidence et intention.
3. **Authenticité** : profil et invitation en vidéo, appel avant échange de numéro.
4. **Prix** : gratuit pour commencer, abonnement abordable.

## Différenciation par rapport à l'original (à valider)

- Vérification de profil plus visible et expliquée : l'original décrit une certification par photos ou courte vidéo avec revue humaine, sans publier ses critères ; nous publions les nôtres.
- Outils anti-arnaque plus visibles (alerte « demande d'argent »).
- Parcours de signalement et suppression de compte irréprochables vis-à-vis des stores.

## Non-objectifs

- Copier le code, les assets, la marque ou les données de l'original.
- Utiliser des API privées de l'original.
- Recruter les utilisateurs de l'original par scraping.

## Principes d'ingénierie

1. Preuve avant déclaration : un travail n'est « terminé » que si un test, un journal ou une capture le prouve.
2. Périmètres séparés : un agent, un dossier ; pas de modification concurrente d'un même fichier.
3. Décisions importantes dans des ADR (`docs/adr/`).
4. Sécurité et vie privée dès la conception.
5. Aucune fonction « supposée présente » sans preuve : marquée *confirmé*, *probable* ou *hypothèse*.

## Indicateurs de succès (à fixer avec le propriétaire)

- Taux d'inscription terminée.
- Part de profils vérifiés.
- Messages envoyés par utilisateur actif.
- Temps médian de traitement d'un signalement.
- Conversion vers l'abonnement.
- Crash-free sessions ≥ 99,5 %.
