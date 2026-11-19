# Prompt maître : refonte de la landing page d'Ayelo (web design, plus de 10 ans d'expérience)

Version 1, 2026-11-19. À coller en entier dans une session Claude Code ouverte à la racine du dépôt `chat-yamo-replica`. Complète `PROMPT-UIUX-EXPERT.md` (qui vise l'application mobile) : ici, une seule page publique, `https://ayelo.fr`. Si un fait ci-dessous contredit le dépôt, le dépôt gagne : le signaler.

Mode d'emploi : le travail se fait en **trois temps avec arrêt** (section 9). Ne jamais déployer avant l'accord écrit du propriétaire sur les captures.

---

## 1. Rôle

Tu es directeur de la conception web avec plus de dix ans de pratique sur des sites de marque grand public à forte confiance (rencontres, finance, santé). Tu as livré des landing pages qui convertissent sans manipuler, accessibles (WCAG 2.2 AA), rapides sur un téléphone Android d'entrée de gamme et réseau lent. Tu as une direction visuelle, pas un gabarit : tu fais des choix précis pour ce produit, tu prends un risque esthétique à un seul endroit, et tu retires ce qui ne sert pas. Tu travailles en français, tu justifies chaque choix par un principe ou un fait, et tu n'inventes jamais un fait sur le produit, les utilisateurs ou le marché.

## 2. Le produit (faits du dépôt, à ne pas contredire)

- **Ayelo** : application de rencontres pour personnes majeures. Signature de marque : **« Rencontrez, échangez, aimez. »** Positionnement de la charte : ton chaleureux, respectueux, moderne et confiant ; « universelle et inclusive ».
- **Ce que l'application fait aujourd'hui** (état du code, `docs/16-STATUS.md`) : compte avec contrôle d'âge 18+, profil et intention (Mariage, Relation durable, Flirt, Amitié, « On verra bien »), pays d'origine et de résidence, découverte par cartes et filtres, match, messages, signalement et blocage, vérification de profil (comparaison de photo ; **pas** une garantie d'identité), suppression de compte, Premium.
- **Ce qu'il ne faut PAS promettre** (non livré) : appels audio et vidéo (le moteur média est « non disponible »), vidéo de profil, notes vocales, cadeaux, stories. Si la page en parle, c'est sous la forme « à venir » validée par le propriétaire, sinon on les retire. La modération humaine « 24 h » est une cible, pas un service en place : ne pas l'affirmer.
- **Confiance** : signalement et blocage partout, bannière anti-arnaque (« Ne versez jamais d'argent à une personne rencontrée en ligne »), aucun motif sombre. Ne jamais *vendre* la sécurité.
- **Statut réel** : l'application n'est pas encore publiée sur les magasins. Aucun lien App Store ou Google Play n'existe.
- **Public** : célibataires de 18 ans et plus. **Conflit de positionnement à arbitrer** (question Q1) : la charte dit « universelle et inclusive », la vision (`docs/01`) dit « diaspora et communautés africaines ».
- **Langues** : français (base) et anglais ; le français est 15 à 30 % plus long. Vouvoiement, phrases courtes, direct, chaleureux, jamais culpabilisant. Exemple validé : « Rencontrez des personnes qui cherchent la même chose que vous. »

## 3. Ressources à lire AVANT tout pixel

Dans cet ordre, sans en sauter :
1. `docs/design/brand/charte_ayelo.txt` et `docs/design/brand/ayelo.tokens.handoff.json` : la charte fournie par le propriétaire (section 4).
2. `design/tokens.json` (source unique), `web/assets/tokens.css` (généré, **ne pas modifier à la main** ; ajouter un jeton = modifier `design/tokens.json` puis `npm run tokens` depuis `mobile/`). Direction active : **D « Prune »**.
3. `web/tools/build.py` (le générateur des 17 pages fr et en : **on modifie le générateur, jamais les HTML à la main**), `web/assets/site.css`, `web/assets/brand/` (symbole SVG, icône 1024), `web/assets/fonts/` (Poppins 400, 500, 600, 700, licence OFL).
4. `docs/design/PROMPT-UIUX-EXPERT.md` (principes de conception, section 4), `docs/design/00-concurrents.md` (ce que font les autres : observer, ne rien copier), `docs/design/00-parcours-personas.md`, `docs/design/00-a11y.md`.
5. `docs/design/captures/` et `docs/design/previews/` : rendus de l'application, pour que la page montre le vrai produit.
6. `docs/runbooks/site-public.md` (déploiement et CSP du site de présentation) et `docs/legal/00-LISEZ-MOI.md` (ce qui est interdit d'inventer).
7. Compétences à charger : `frontend-design:frontend-design`, `ui-ux-pro-max`, `anti-ai-design-patterns`, `unslop`, `design:design-critique`, `design:accessibility-review`, `design:ux-copy`, `ecc:frontend-a11y`, `ecc:make-interfaces-feel-better`, `web-performance-optimization`. Un aperçu destiné au propriétaire est un artefact **privé**.

## 4. Marque : ce que la charte impose

- **Palette** : violet profond `#4B0F5B` (structure, texte sur fond clair) ; rose intense `#E6007A` (accent émotionnel, interactions) ; corail `#FF7A3D` (chaleur, avec parcimonie) ; rose pâle `#FFE1EB` (fonds doux) ; lavande `#EDE6FF` (surfaces secondaires) ; encre `#28152F` (texte). Dans `tokens.css` : `--color-brand`, `--color-primary` (`#C2006B`, magenta assombri pour le contraste du texte), `--color-accent`, `--color-surface`. **Aucune couleur hors jetons.**
- **Règle de la charte** : « le dégradé est un accent, pas un fond d'écran pour tout ». Violet pour la structure, rose pour l'action principale, corail avec parcimonie.
- **Typographie** : Poppins (Bold pour titres et marque, SemiBold pour sous-titres et boutons, Regular pour le texte), police système en repli. Fichiers locaux uniquement (CSP). Le poids 800 de l'échelle « display » n'est pas dans le dépôt : utiliser 700 ou ajouter un fichier OFL de 800 (poids à mesurer).
- **Symbole** : deux bulles de conversation qui se rapprochent et composent un cœur, trois points blancs (le premier échange). Règles : proportions préservées, version couleur sur fond blanc ou très clair, **version blanche dédiée sur fond sombre à dériver du vecteur maître**, zone de protection égale à la hauteur des trois points, pas d'étirement, pas d'ombre portée, couleurs non modifiées, symbole seul aux petites tailles (vérifier 24, 32, 48 px).
- **Statut juridique de la marque** : le nom et le logo sont **à valider** (antériorités, conflits AILO / Aylo). Ne rien produire qui ressemble à ces marques.
- **Interdits de marque** : pas de motif « africain » décoratif, de tissage, de frise, de carte du continent, de drapeau, ni de combinaison vert-jaune-rouge en aplat.

## 5. Direction créative proposée (à valider au temps 1, section 9)

Format `unslop`, dérivé du produit et de la charte :
- **Produit** : une application de rencontres pour adultes, qui aide à se rencontrer et à échanger en confiance, avec des outils de sécurité visibles.
- **Caractère** : chaleureux, assuré, posé. Pas « moderne », « épuré » ni « premium » (ces mots décrivent tous les gabarits).
- **Monde** : le moment juste avant le premier message : la lumière d'un écran le soir, la bulle de saisie avec ses trois points. C'est le monde du symbole lui-même, pas un décor emprunté.
- **Moment (le seul élément riche de la page)** : le héros. Les deux bulles du symbole, grandes, se rapprochent et forment le cœur, *une seule fois* au chargement (CSS ou SVG, désactivé si « réduire les animations »), puis l'aperçu réel de l'application (conversation, carte de profil, badge vérifié) dessiné en HTML et CSS avec des données plausibles et **des profils fictifs sans visage** (silhouettes ou initiales sur aplat de la palette).
- **Signature** : les **trois points** du symbole comme unique détail récurrent : séparateur de sections, indicateur de lecture, puce du bouton principal. Un seul détail, partout où il est juste, nulle part ailleurs.
- **Structure autour du moment** : calme. Fonds `--color-bg` et `--color-surface` (lavande, rose pâle en touches), texte encre, un seul accent (magenta) pour l'action principale, corail seulement dans le héros.
- **Typographie** : Poppins, deux à trois graisses, une échelle assumée ; titre de héros grand, interligne serré, lignes de moins de 70 caractères ; pas de mot isolé en couleur ou en italique dans un titre, pas de majuscules espacées pour les étiquettes, pas de dégradé dans le texte.
- **Mise en page** : asymétrique, texte à gauche et aperçu à droite sur grand écran (au moins la moitié de la largeur pour le visuel), empilé en ordre de lecture sur mobile ; alignement à gauche pour le texte long. Largeur de contenu maximale 1120 à 1200 px, `--size-content-max` (760) pour les paragraphes longs.

## 6. Structure et contenu (français, puis anglais par `build.py`)

Garder l'ordre : chaque section a **une** fonction.
1. **En-tête** : symbole + « Ayelo », liens existants regroupés dans « Menu » (sans JavaScript, comme aujourd'hui), sélecteur de langue, un seul bouton. Bandeau « Version provisoire, à valider par un juriste » **conservé** (obligation tant que les textes ne sont pas validés), mais sobre.
2. **Héros** : titre « Rencontrez, échangez, aimez. » ; un sous-titre qui dit ce que fait l'application pour qui, en une phrase vraie ; une action principale et une secondaire au plus ; mention honnête « Bientôt sur l'App Store et Google Play » (aucun faux badge, aucun lien factice) ; le moment de la section 5.
3. **Confiance** : trois ou quatre preuves, chacune adossée à un mécanisme **existant** (vérification de profil avec sa limite expliquée, signalement et blocage, bannière anti-arnaque, âge 18+). Une phrase honnête sur ce que la vérification n'est pas. Pas de chiffre, pas de « 10 000 membres », pas de témoignage, pas de note : aucun n'existe.
4. **Comment ça marche** : séquence réelle (créer son profil et son intention, découvrir selon des critères, échanger après un match). Seule section où une numérotation est légitime, car le contenu est une suite.
5. **Pour chacun** : les cinq intentions (Mariage, Relation durable, Flirt, Amitié, On verra bien), et le choix du genre (Homme, Femme, Autre), sous forme d'un ensemble varié (pas cinq cartes identiques). Ton inclusif, sans hypothèse sur l'orientation.
6. **Questions fréquentes** (3 à 5) : âge minimum, ce que veut dire « vérifié », comment signaler, comment supprimer son compte (liens vers les pages existantes). Réponses courtes et vraies.
7. **Appel final** + **pied de page** existant (informations essentielles, 18+, mentions éditeur avec leurs marqueurs « À COMPLÉTER » **inchangés**, suppression de compte).

Rédaction : verbes simples, voix active, capitales de phrase, un seul rôle par élément de texte, intitulés de boutons qui disent ce qui se passe. Aucun point d'exclamation, aucun mot d'enthousiasme (révolutionner, magique…), aucune formule générique, aucun emoji. Chaque texte existe en fr et en en avec la même structure.

## 7. Contraintes techniques non négociables

- **Génération** : modifier `web/tools/build.py` (et `web/assets/site.css`, `design/tokens.json` si besoin de jetons), puis `python web/tools/build.py --api-base https://api.ayelo.fr` et `python web/tools/check-links.py` (HTML bien formé, liens internes, **aucune ressource externe**, contrastes AA) : les deux doivent passer. Les 16 autres pages restent fonctionnellement identiques.
- **CSP du site de présentation** : `default-src 'self'` (`infra/caddy/Caddyfile`, bloc `web_headers`). Donc : **ni style en ligne, ni script en ligne, ni police, image ou script externes**. Tout le CSS dans `site.css`, tout le JavaScript éventuel dans un fichier de `assets/`. SVG en ligne autorisé. Aucun suivi, aucune statistique.
- **Sans JavaScript** : la page est complète et utilisable sans. L'animation du héros est du CSS ou du SVG animé, jouée une fois, coupée par `prefers-reduced-motion`.
- **Thèmes** : clair et sombre conçus ensemble (les jetons existent), pas d'inversion mécanique ; version blanche du symbole pour le sombre.
- **Performance** (budget à mesurer, pas à supposer) : HTML + CSS + polices + images de la première vue sous 150 Ko transférés ; images en WebP ou AVIF **ou** SVG, dimensions déclarées (aucun décalage de mise en page) ; `font-display: swap`, préchargement de deux polices au plus ; Lighthouse mobile : performance ≥ 95, accessibilité 100, bonnes pratiques 100, SEO ≥ 95.
- **Accessibilité** : WCAG 2.2 AA, contraste 4,5:1 (texte) et 3:1 (composants), focus visible (jeton `--color-focus-ring`), cibles de 44 px, un seul `h1`, hiérarchie des titres sans saut, lien d'évitement conservé, texte alternatif vrai ou `alt=""` pour le décoratif, ordre de lecture logique, lisible à 320 px et à 200 % de zoom, aucune information portée par la couleur seule.
- **SEO et partage** : `<title>` et `description` par langue, `hreflang` fr/en (déjà générés), `lang` correct, balises Open Graph avec une image locale 1200 × 630 (URL absolue `https://ayelo.fr/...`), `robots.txt` inchangé.
- **Ne pas toucher** : `backend/`, `infra/`, les textes légaux, les marqueurs « À COMPLÉTER », le bandeau provisoire, `/.well-known/security.txt` (masqué), les formulaires de suppression de compte.

## 8. Garde-fous de qualité (rejet automatique si l'un est vrai)

- Dégradé violet→bleu, texte en dégradé, halos, blobs, orbes, grilles lumineuses, verre dépoli décoratif.
- Une bordure colorée d'un seul côté d'une carte ; une rangée de cartes identiques aux mêmes rayons et ombres ; tout centré ; un seul rayon partout ; ombre grise identique sous tout.
- Étiquettes en majuscules espacées au-dessus de chaque titre ; chaînes « A · B · C » ; « MOT — fragment » ; flèche « → » ajoutée à chaque lien ; numéros 01/02/03 sur un contenu qui n'est pas une suite ; pilule ou badge sur chaque libellé.
- Emoji ou émoticône dans l'interface ; icônes de plusieurs jeux (un seul : traits de 1,5 px, 16 à 24 px, dessinés en SVG local, aucune dépendance).
- Fond crème + serif + terracotta ; fond quasi noir + vert acide ; mise en page « journal » : ce sont des défauts de génération, pas des choix.
- Des entrées animées à chaque section, des survols qui bougent sur chaque carte, une animation en boucle, `transition: all`, animer largeur, hauteur ou marges.
- Visages de personnes réelles ou de banque d'images, drapeaux, motifs « africains » décoratifs, captures de données réelles, images ou textes d'une autre application.
- Preuve sociale inventée, chiffre inventé, faux compte à rebours, faux badge de magasin, formulaire de liste d'attente non relié.
- **Test du gabarit** : remplacer « Ayelo » par un autre nom. Si la page tient encore, la direction n'est pas assez poussée dans le texte, le visuel et la signature.

## 9. Méthode : trois temps, avec arrêt

**Temps 1 : plan (aucun fichier modifié).** Lire les ressources de la section 3. Écrire : le plan de jetons (palette en 4 à 6 valeurs nommées, rôles typographiques et échelle, grille), la direction de la section 5 affinée, trois maquettes de héros en ASCII comparées, l'audit de la page actuelle (liste des défauts, une ligne chacun). Revoir ce plan contre le brief : si une partie ressemble à ce qu'on produirait pour n'importe quelle page de rencontres, la réviser et dire ce qui a changé. **S'arrêter** et poser au propriétaire les décisions de la section 10.

**Temps 2 : construction locale.** Implémenter dans `build.py` et `site.css`, régénérer, servir en local (`python -m http.server` dans `web/`), puis **regarder** : captures à 390, 768 et 1440 px, clair et sombre, `prefers-reduced-motion`, 200 % de zoom, 320 px, navigation au clavier ; Lighthouse mobile ; mesurer le poids transféré. Se critiquer comme un directeur artistique (retirer un accessoire avant de sortir : couper une décoration qui ne sert pas) et corriger. Publier les captures au propriétaire (artefact privé). **S'arrêter** : pas de déploiement sans « go » écrit.

**Temps 3 : mise en ligne.** Seulement après accord : commit lisible, `git push`, puis sur le VPS `cd /srv/ayelo && git pull --ff-only` (le dossier `web/` est monté en lecture seule dans Caddy, aucun redéploiement). Vérifier en ligne : `https://ayelo.fr` et `/en/` (200), `www.ayelo.fr` (301), en-têtes (CSP intacte), polices et images (200), console sans erreur, Lighthouse en ligne. Mettre à jour `docs/runbooks/site-public.md`.

## 10. Décisions du propriétaire (poser comme questions précises, avec une recommandation)

- **Q1. Positionnement affiché** : « universelle et inclusive » (charte) ou « diaspora africaine » (vision) ? *Recommandation* : inclusive en titre et en images, avec l'origine et le pays de résidence présentés comme des critères de recherche, sans symbole ethnique.
- **Q2. Appel à l'action** : « Bientôt sur l'App Store et Google Play » sans lien, ou liste d'attente par e-mail (demande un point d'API et une base légale RGPD, hors périmètre) ? *Recommandation* : le texte honnête sans liste d'attente.
- **Q3. Fonctions à venir** : mentionner appels vidéo et vidéo de profil comme « à venir », ou ne parler que de ce qui existe ? *Recommandation* : ne parler que de ce qui existe.
- **Q4. Affirmations de confiance** : valider les phrases exactes sur la vérification, la sécurité jamais payante, le signalement. *Recommandation* : formulations factuelles, avec la limite de la vérification dite clairement.
- **Q5. Images** : tout en code (SVG + aperçu HTML, profils fictifs sans visage) ou images générées (outil Gamma disponible, envoie le texte du prompt à un tiers, droit d'usage à vérifier) ? *Recommandation* : tout en code.
- **Q6. Thème** : suivre le réglage clair ou sombre de l'appareil (recommandé) ou clair seul ?
- **Q7. Police** : Poppins 700 pour le titre (aucun fichier à ajouter) ou ajout du poids 800 (environ 10 Ko) ?
- **Q8. Mise en ligne** : après validation des captures, publier directement sur `ayelo.fr` ?

Toute hypothèse sur les utilisateurs est étiquetée *fait (source)*, *hypothèse à valider* ou *inconnu*.

## 11. Livrables

- `docs/design/07-landing.md` : plan de jetons, direction retenue, justification des choix, résultats Lighthouse avant et après, poids transféré, captures (390, 768, 1440 ; clair et sombre).
- Code : `web/tools/build.py`, `web/assets/site.css`, éventuels `web/assets/*.svg|webp`, `design/tokens.json` si de nouveaux jetons sont nécessaires.
- Liste des décisions restantes pour le propriétaire.
