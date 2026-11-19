# 07 : Refonte de la landing d'Ayelo, temps 1 (plan, aucun fichier du site modifié)

Date : 2026-11-19. Brief : [`PROMPT-LANDING.md`](PROMPT-LANDING.md). Décisions Q1 à Q8 : toutes validées selon les recommandations du brief (positionnement inclusif, texte honnête « Bientôt sur les magasins », seulement ce qui existe, formulations factuelles, tout en code, thème selon l'appareil, Poppins 700, publication après validation des captures).

## 1. Audit de la page actuelle (https://ayelo.fr, mesuré le 2026-11-19)

**Mesures** (Lighthouse mobile, navigation) : accessibilité 100, bonnes pratiques 100, SEO **92**, agentique 100. Un seul échec : `hreflang` non valide (les liens `hreflang` sont relatifs, il faut des URL absolues `https://ayelo.fr/...`). Performance et poids transféré : à mesurer au temps 2 (trace de performance), avant et après.

**Constat visuel** (captures 1440 px clair, 390 px clair) :

| # | Défaut | Gravité |
|---|---|---|
| 1 | Ce n'est pas une landing : c'est un **index de pages légales** (six lignes « Conditions, Confidentialité… ») sous un titre. Aucune section de valeur, aucune preuve de confiance, aucun produit montré. | P0 |
| 2 | Le visuel du héros est le **logo sur un aplat violet** : le logo apparaît déjà dans l'en-tête, donc la zone la plus grande de la page ne dit rien de nouveau. | P0 |
| 3 | Le sous-titre parle depuis le système (« Ce site rassemble les informations publiques du service ») et promet « s'appeler », une fonction **non livrée**. | P0 |
| 4 | L'unique action est un marqueur jaune « [À COMPLÉTER : liens App Store et Google Play] ». Aucun appel à l'action réel. | P1 |
| 5 | L'en-tête met cinq liens légaux au premier plan et aucun bouton : la navigation sert la conformité, pas la page. Ces liens iront dans le pied de page. | P1 |
| 6 | `hreflang` relatif (SEO 92 au lieu de 100). | P1 |
| 7 | Une seule typographie utilisée en un seul poids de texte courant et deux de titre ; aucun rythme d'espacement entre sections (une section, un pied de page). | P2 |
| 8 | **À garder** : bandeau provisoire (obligation), bloc « 18+ » (bonne idée, à intégrer à la confiance), lien d'évitement, menu sans JavaScript, polices locales, contrastes AA, aucune ressource externe, thème sombre déjà présent dans les jetons. | n/a |

## 2. Contrastes calculés (formule WCAG 2.2) pour la palette retenue

| Paire | Rapport | Seuil |
|---|---|---|
| Clair : texte `#28152F` / fond `#FFFFFF` | 16,96 | 4,5 |
| Clair : texte `#28152F` / surface `#F5F0FF` | 15,17 | 4,5 |
| Clair : texte atténué `#6B5C70` / fond, surface | 6,19 et 5,54 | 4,5 |
| Clair : bouton, texte blanc / primaire `#C2006B` | 5,99 | 4,5 |
| Clair : lien primaire `#C2006B` / fond, surface | 5,99 et 5,36 | 4,5 |
| Héros violet : blanc / `#4B0F5B` | 13,83 | 4,5 |
| Héros violet : rose pâle `#FFE1EB` / `#4B0F5B` | 11,34 | 4,5 |
| Héros violet : corail `#FF7A3D` / `#4B0F5B` | 5,34 | 3 (décoratif) |
| Héros violet : magenta `#E6007A` / `#4B0F5B` | **3,06** | 3 : juste, **décoratif seulement** |
| Sombre : texte `#F7EEF9` / fond `#1A0B20` | 16,67 | 4,5 |
| Sombre : atténué `#C2B0C9` / surface `#2A1633` | 8,21 | 4,5 |
| Sombre : lien et bouton `#FF6FB0` (texte `#2A0A1E`) | 7,33 et 7,02 | 4,5 |

Conséquence de conception : **le magenta `#C2006B` ne sert pas de bouton sur le fond violet** (contraste de contour insuffisant). Sur le héros violet, l'action principale prend le rose clair `#FF6FB0` (jeton sombre) avec un texte violet très foncé ; partout ailleurs, le bouton est `#C2006B` avec texte blanc.

## 3. Plan de jetons

- **Couleur (4 à 6 valeurs nommées)** : *Prune* `#4B0F5B` (structure, héros, pied de page) ; *Encre* `#28152F` (texte) ; *Magenta* `#C2006B` (action principale, liens) ; *Rose pâle* `#FFE1EB` (fonds doux, aire de preuve) ; *Lavande* `#F5F0FF` (surface) ; *Corail* `#FF7A3D` (une touche dans le héros seulement). Aucune nouvelle valeur : tout existe dans `tokens.css`.
- **Typographie** : Poppins seule, rôles par poids : 700 pour le titre du héros et la marque, 600 pour les titres de section et les boutons, 400 pour le texte. Échelle (rem) : 3,25 / 2,25 / 1,5 / 1,125 / 1 / 0,875. Interlignes serrés pour les titres (1,08 à 1,15), 1,6 pour le texte. Largeur de ligne maximale : 62 caractères. 0 Ko de plus : les quatre fichiers existent.
- **Mise en page** : conteneur 1160 px, gouttière 24 px (mobile 20), rythme vertical de 96 px entre sections au bureau, 64 px sur mobile ; grille de 12 colonnes au bureau, une colonne sur mobile ; texte aligné à gauche partout.
- **Mouvement** : un seul moment, les deux bulles qui se rapprochent pour former le cœur (CSS ou SVG, une fois, 900 ms, courbe `cubic-bezier(0.2, 0.8, 0.2, 1)` de la charte), coupé par `prefers-reduced-motion`. Pour le reste : survols de couleur seulement, 120 ms.
- **Principes** : une section, une fonction ; la richesse est dans le héros, le reste est calme ; la preuve de confiance est un *mécanisme existant*, jamais un chiffre ; les trois points sont l'unique motif décoratif.

## 4. Les trois héros comparés

```
A. Violet plein cadre (scène)          B. Clair, téléphone à droite        C. Éventail de cartes de profil
+-------------------------------+      +-------------------------------+   +-------------------------------+
| header        [FR] [Menu]     |      | header        [FR] [Menu]     |   | header        [FR] [Menu]     |
|  PRUNE  PRUNE  PRUNE  PRUNE   |      |                               |   |                               |
|  Rencontrez,        ( )( )    |      | Rencontrez,       +---------+ |   | Rencontrez,        +--+      |
|  échangez, aimez   bulles     |      | échangez, aimez   | conver- | |   | échangez, aimez  +--+  |      |
|  texte         se rejoignent  |      | texte             | sation  | |   | texte          +--+ Vérifié    |
|  [Découvrir]      en coeur    |      | [Comment ça...]   | ... (•••)| |   | [Comment ça...]  cartes      |
|  PRUNE  +------------+ PRUNE  |      |                   +---------+ |   |                  fictives    |
|  PRUNE  | téléphone  | PRUNE  |      |  bulles pâles derrière        |   |                               |
+---------+ monte du bas +------+      +-------------------------------+   +-------------------------------+
```

| Critère | A. Violet plein cadre | B. Clair + téléphone | C. Éventail de cartes |
|---|---|---|---|
| Confiance | Haute (sérieux, marque forte) | Haute (on voit le produit) | Moyenne (cartes = « catalogue ») |
| Chaleur | Très haute | Haute | Moyenne |
| Mémorisation (le « moment ») | **Très haute** : le symbole devient la scène | Haute | Moyenne |
| Risque d'effet « gabarit » | Faible | Moyen (téléphone à droite = très courant) | Moyen |
| Poids | Faible (SVG + CSS) | Faible | Faible |
| Contraste et thème sombre | Violet déjà foncé : thème sombre sans surprise | Deux thèmes à tenir | Deux thèmes à tenir |

**Recommandation : A.** Elle prolonge l'idée du symbole (les bulles qui forment un cœur) jusqu'à devenir la scène, elle se démarque du téléphone-à-droite qui signe la plupart des pages d'application, et elle utilise la couleur de marque là où elle compte, le reste restant calme.

## 5. Revue du plan contre le brief

- *Ce qui ressemblait à un gabarit* : « le téléphone à droite sur fond clair » (héros B) est ce que ferait n'importe quelle page d'application de rencontres. **Changé** : le héros recommandé met le symbole en scène et fait *monter* l'aperçu du bas du cadre, au lieu de l'encadrer.
- *Trois cartes identiques pour la confiance* : **changé** : une preuve large (la vérification et sa limite), trois preuves plus courtes dans une rangée de largeurs inégales.
- *Numéros 01/02/03* : conservés **uniquement** pour « Comment ça marche », qui est une suite réelle.
- *Étiquettes en majuscules espacées, flèches « → », puces en pilule* : écartées ; la signature (trois points) remplace les puces décoratives.
- *Preuve sociale* : aucune, car rien n'existe (pas de membres, pas de note, pas d'avis).

## 6. Contenu proposé (fr ; l'anglais suit la même structure)

1. **Héros** : « Rencontrez, échangez, aimez » ; sous-titre : « Ayelo est une application de rencontres pour personnes majeures. Dites ce que vous cherchez, découvrez des profils qui y répondent, échangez après un match. » ; action principale « Voir comment ça marche » (ancre), action secondaire « Sécurité et signalement » (page existante) ; mention « Bientôt sur l'App Store et Google Play ».
2. **Confiance** : « Des protections dès le premier message ». *Profils vérifiés* (une photo comparée au profil ; ce n'est pas une garantie d'identité, restez vigilant) ; *Signaler et bloquer* (depuis une carte, un profil ou une conversation, en quelques touches) ; *Un rappel contre les arnaques* (« Ne versez jamais d'argent à une personne rencontrée en ligne ») ; *Réservé aux adultes* (18 ans et plus).
3. **Comment ça marche** : « Trois étapes » (créer son profil et son intention ; découvrir selon l'origine, le pays de résidence et l'intention ; échanger après un match).
4. **Pour chacun** : « Chacun cherche quelque chose de différent » : Mariage, Relation durable, Flirt, Amitié, On verra bien ; Homme, Femme, Autre.
5. **Questions fréquentes** : âge minimum ; ce que veut dire « vérifié » ; comment signaler ; comment supprimer son compte (délai de 30 jours).
6. **Pied de page** : toutes les pages légales (déplacées de l'en-tête), mentions éditeur et marqueurs « À COMPLÉTER » inchangés, suppression de compte.

## 7. Choix du propriétaire (2026-11-19)

Héros A (violet plein cadre) ; aperçu « conversation » ; sections Confiance, Comment ça marche, Pour chacun (intentions) et Questions fréquentes ; fond clair, violet seulement dans le héros et le pied de page. Toutes les recommandations.

## 8. Temps 2 : construction locale (résultats)

**Fichiers modifiés** : `web/tools/build.py` (nouvelle landing fr et en, rendu spécifique de l'accueil, `hreflang` et `canonical` absolus, Open Graph, préchargement de deux polices), `web/assets/site.css` (anciennes règles de l'accueil remplacées), `web/tools/check-links.py` (les `<link rel="canonical|alternate">` ne sont pas des ressources chargées), `web/assets/brand/ayelo-og.png` (image de partage 1200 × 630, 100 Ko). Les 17 pages sont régénérées par `python web/tools/build.py --api-base https://api.ayelo.fr` ; seul l'en-tête `<head>` des 16 autres pages change (SEO), leur contenu et leur mise en page sont identiques.

**Moment du héros** : le symbole de la charte, découpé en trois groupes SVG (bulle arrière, bulle avant, cœur) ; les deux bulles se rejoignent en 900 ms, le cœur apparaît, puis l'aperçu de conversation monte. CSS seulement, joué une fois, **entièrement désactivé sous `prefers-reduced-motion`** (l'état final est l'état par défaut). Aucun JavaScript. Aperçu fictif : prénom « Amina », avatar à initiale, aucune photo.

**Mesures (version locale, mobile)** :

| Mesure | Avant (ayelo.fr, 2026-11-19) | Après (local) | Objectif |
|---|---|---|---|
| Lighthouse accessibilité | 100 | **100** | 100 |
| Lighthouse bonnes pratiques | 100 | **100** | 100 |
| Lighthouse SEO | 92 (`hreflang` relatif) | **100** | ≥ 95 |
| LCP (4G rapide, processeur ralenti 4×) | non mesuré | **995 ms** | < 2,5 s |
| CLS | non mesuré | **0,00** | < 0,1 |
| Poids transféré, première vue (estimé, texte compressé) | non mesuré | **≈ 40 Ko**, 8 requêtes | < 150 Ko |
| Style ou script en ligne (CSP `default-src 'self'`) | 0 | **0** | 0 |
| `check-links.py` (HTML, liens, ressources externes, contrastes AA) | OK | **OK** | OK |

**Vérifications visuelles** (captures dans `docs/design/captures/`) : [`landing-1440-clair.webp`](captures/landing-1440-clair.webp), [`landing-1440-sombre.webp`](captures/landing-1440-sombre.webp), [`landing-390-clair.webp`](captures/landing-390-clair.webp). Contrôlés : bureau 1440 px clair et sombre, mobile 390 px, version anglaise, une page légale (inchangée), focus clavier visible (anneau blanc sur le violet), console sans erreur.

**Défauts trouvés et corrigés pendant la critique** : (1) le téléphone cachait le cœur du symbole : le symbole est maintenant entier en haut, le téléphone monte dessous ; (2) le titre passait sur trois lignes : deux lignes ; (3) le pied de page était illisible, une règle générique l'emportait : spécificité corrigée ; (4) en thème sombre, le texte secondaire du héros et du pied de page disparaissait (`--color-surface` devient sombre) : remplacé par une teinte dérivée de `--color-on-brand`, claire dans les deux thèmes.

**Limites** : mesures faites en local (le serveur de production ajoute de la latence et compresse avec Caddy) ; performance en ligne à remesurer après publication. Aucun essai sur un vrai appareil ni avec un lecteur d'écran. Les marqueurs « À COMPLÉTER » et le bandeau provisoire sont conservés (éditeur, directeur de la publication, hébergeur dans le pied de page).

## 9. Suite

Temps 3 seulement après un « go » écrit : commit, push, `git pull --ff-only` sur le VPS (le dossier `web/` est monté en lecture seule, aucun redéploiement), vérification en ligne (200, `www` en 301, CSP intacte, polices et image de partage en 200, Lighthouse en ligne), mise à jour de `docs/runbooks/site-public.md`.
