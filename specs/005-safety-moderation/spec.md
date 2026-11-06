# Spécification 005 : Sécurité et modération

**Statut** : API livrée ; interface de modération à faire (voir 009) | **Phase** : A/B | **Exigences** : FR-I-1 à I-7, I-10, I-11, FR-H-4, H-5 | **Origine** : blocage, signalement à 4 motifs, revue humaine, « zéro tolérance » = **confirmé** (page sécurité, CGU, site)

## Parcours
- **US1 (P1)** Signaler un profil, une conversation, un appel ou une story : motifs argent / harcèlement / comportement en rencontre / faux profil / mineur suspecté / autre ; 20 par jour ; pas de doublon.
- **US2 (P1)** Signalement « mineur suspecté » : priorité maximale et **suspension préventive immédiate** du compte signalé, revue sous 2 h.
- **US3 (P2)** 3 signalements de personnes différentes en 7 jours : revue prioritaire et score de risque.
- **US4 (P1)** Voir ses sanctions et contester une fois.
- **US5 (P1)** Un modérateur traite la file : avertir, suspendre, bannir, classer, lever une suspension préventive, accepter ou rejeter une contestation. **À faire (009).**
- **US6 (P2)** Média refusé par la modération : supprimé, jamais public. **À faire (009).**

## Cas limites
Signalements abusifs pour faire suspendre un concurrent (la suspension préventive d'un mineur suspecté en est une cible : mitigation = revue sous 2 h, quota, score de risque ; risque accepté et à surveiller) ; utilisateur supprimé avec sanctions (preuves conservées).

## Exigences non satisfaites
FR-I-3 modération automatique des images, FR-I-4 détection de faux profils, FR-I-10 filtre de texte : prestataire non choisi ; **aucune ressource humaine de modération budgétée**.
