# Mentions légales modifiables depuis le tableau de bord admin

Date : 2026-11-20. Statut : conception, en attente d'approbation du propriétaire.

## Intention

Le site de présentation (`ayelo.fr`) affiche aujourd'hui 46 marqueurs visibles « À COMPLÉTER » (société, adresse, hébergeur, durées de conservation, clauses des conditions, etc.). Ces textes ne peuvent être changés qu'en modifiant `web/tools/build.py`, en régénérant les pages, en commitant et en déployant. Le propriétaire n'est pas développeur, travaille à distance avec peu de saisie, et veut renseigner et corriger ces textes lui-même depuis le tableau de bord admin, à tout moment, sans développeur.

Le résultat attendu : une page « Mentions légales » dans le panneau Filament où l'administrateur saisit, en français et en anglais, chaque texte manquant, l'enregistre en brouillon, puis le publie. Le texte publié apparaît sur le site sans JavaScript.

## Objectifs

- Une page admin unique, réservée au rôle administrateur, listant chaque champ du site, regroupés par thème, avec FR et EN côte à côte.
- Deux états par champ : brouillon et publié. Le site n'affiche que le publié. Une action « Publier » explicite, avec confirmation listant les champs modifiés.
- Les pages publiques contiennent le vrai texte dans le HTML (pas de remplissage par JavaScript), dès la publication (délai de cache de quelques minutes au plus).
- Un champ vide ou non publié continue d'afficher le marqueur « À COMPLÉTER » actuel : le comportement d'aujourd'hui est la valeur par défaut.
- Chaque enregistrement de brouillon et chaque publication est inscrit au journal d'audit existant (avant/après).
- Si l'application est indisponible, le site reste servi à partir des fichiers statiques, avec les marqueurs.
- La bannière « Version provisoire, à valider par un juriste » peut être retirée depuis la même page, une fois la validation faite (sans cela le propriétaire aurait de nouveau besoin d'un développeur).

## Hors périmètre

- Le reste du contenu du site (textes marketing de la landing, titres, navigation) : inchangé, toujours dans `build.py`.
- Le fichier `/.well-known/security.txt` (modèle masqué par Caddy) : traité séparément.
- Les liens des stores (App Store, Google Play) : ils ne font pas partie des 46 marqueurs actuels. À ajouter plus tard comme champs si le propriétaire le demande.
- Texte riche, Markdown, liens ou HTML dans les valeurs : les valeurs sont du texte brut.
- Planification de publication, historique complet par champ (le journal d'audit garde l'avant/après), plus de deux langues.
- Rédiger le contenu juridique : le projet ne propose ni ne génère aucun texte juridique. Le propriétaire et son juriste restent responsables du contenu.

## Contre-objectifs (ce qui serait un échec même si ça marche techniquement)

- Un texte juridique non relu publié par accident (enregistrement = brouillon seulement, jamais en ligne).
- Du HTML ou un script saisi dans un champ qui s'exécute sur le site public.
- La page d'accueil du site indisponible parce que l'application est tombée.
- Un autre rôle que l'administrateur (modérateur, support) qui modifie les mentions légales.

## Contraintes constatées dans le projet

- Le site est du HTML statique généré par `web/tools/build.py` (bibliothèque standard Python, aucune dépendance), versionné, monté en lecture seule dans Caddy (`../web:/srv/web:ro`), cache `public, max-age=3600`. Le dossier `tools/` n'est jamais servi.
- Le serveur n'a que `backend/`, `infra/`, `web/`, `docs/schema/` (extraction partielle) : le code et le catalogue doivent y être, pas de dépendance à `docs/` hors schéma SQL.
- L'application PHP n'a ni Python ni accès au dossier `web/` aujourd'hui. L'image est commune à `app`, `worker`, `scheduler`.
- Caddy sert l'API, l'administration et le site sur trois hôtes distincts. Le bloc de l'API répond 404 sauf `/api/*` et `/up`. Le bloc admin est limité par IP. Le site a une politique de sécurité (CSP) `default-src 'self'` : tout ce qui est rendu doit rester compatible.
- Convention d'administration : toute écriture passe par un service qui fait `audited()` (droit vérifié, mutation et ligne d'audit dans une seule transaction), la matrice de droits est `App\Services\Admin\Permissions`, les politiques Filament refusent écriture directe. Le schéma SQL (`docs/schema/001_initial.sql`) a une migration miroir.
- Environ 36 champs distincts par langue (46 marqueurs, dont des doublons : `privacy@…` ×3, `security@…` ×2, durées comptables ×2). Certains sont des fragments dans une phrase ou une cellule de tableau (« durée à fixer »), d'autres sont des paragraphes entiers (limitation de responsabilité, droit applicable). Le marqueur `[Nom]` du nom de l'application est un reste : la marque est déjà « Ayelo » partout ailleurs.

## Approches envisagées

1. **JavaScript dans le navigateur** : les pages gardent les marqueurs, un script remplit depuis l'API. Le plus simple, mais le texte légal n'est pas dans le HTML (sans JavaScript, robots, relecteurs de stores, impression : « À COMPLÉTER »). Écartée.
2. **Régénération des fichiers statiques** : un bouton lance `build.py` dans l'application et écrit les pages dans un volume servi par Caddy. Pages statiques pures, mais Python à ajouter à l'image PHP, volume en écriture, Caddy qui change de racine, `deploy.sh` à adapter : le plus de pièces en production. Écartée.
3. **Remplissage côté serveur à la demande** (retenue par le propriétaire) : `build.py` place des emplacements nommés dans les pages ; Caddy fait passer les pages par l'application, qui remplace chaque emplacement par le texte publié de la base ; si l'application échoue, Caddy sert le fichier statique tel quel.

## Conception retenue (approche 3)

### Emplacements dans les pages

`build.py` remplace chaque `{{...}}` par un élément identifiable : `<mark class="todo" data-legal="<clé>">[À COMPLÉTER : …]</mark>`. Le contenu par défaut est exactement le marqueur actuel, donc servi tel quel il se comporte comme aujourd'hui. Les emplacements « paragraphe » (bloc entier) sont émis comme élément de niveau bloc (`<div data-legal-block="<clé>">`) pour que le remplissage produise des `<p>` valides ; la forme exacte du balisage est laissée au constructeur.

Deux genres de champs : **ligne** (texte brut inséré dans une phrase ou une cellule) et **paragraphes** (texte brut, lignes vides = nouveau paragraphe).

### Catalogue des champs

`build.py` est la source unique : il décide des clés et écrit à chaque génération un catalogue `web/tools/legal-slots.json` (versionné, non servi) : liste des clés, genre (ligne/paragraphes), groupe, libellé FR/EN, indication pour le propriétaire (reprise des textes entre accolades actuels : « à rédiger par un juriste », etc.), valeur par défaut (le marqueur), longueur maximale, liste des pages qui contiennent des emplacements. L'application lit ce fichier (montage en lecture seule) pour construire le formulaire et valider les clés. Ainsi les clés des pages et celles du formulaire ne peuvent pas diverger, et un test le vérifie.

Une même clé réutilisée sur plusieurs pages (par exemple l'e-mail de contact données personnelles) est un seul champ.

### Stockage

Table `site_legal_fields` : clé, langue (`fr`/`en`), brouillon, publié, dates de modification et de publication. Une ligne par couple clé/langue. Le drapeau « afficher la bannière provisoire » est conservé à part ; le stockage exact est laissé au constructeur. Le schéma est ajouté à `docs/schema/001_initial.sql` avec sa migration miroir.

### Service et droits

`App\Services\Admin\LegalContent` (même base que les autres services d'administration) :
- `saveDraft(acteur, valeurs)` : valide (clés connues, longueur, pas de caractères de contrôle), écrit les brouillons, audite `legal.draft_saved`.
- `publish(acteur)` : copie brouillon vers publié pour les champs modifiés, change la version de cache, audite `legal.published` avec avant/après des champs modifiés.
- `discard(acteur)` : abandonne les brouillons non publiés.
- `setBannerVisible(acteur, bool)` : audite `legal.banner_changed`.
- Nouveau droit `legal.manage`, accordé au seul rôle administrateur dans `Permissions::MATRIX`.

### Page d'administration

Une page Filament (pas une ressource : il n'y a pas de liste d'enregistrements), réservée à `legal.manage`, protégée comme le reste du panneau (2FA obligatoire, liste d'IP). Champs groupés par thème (éditeur et hébergeur, contacts, conservation, conditions, etc.), FR et EN côte à côte, indication « à rédiger par un juriste » affichée sous le champ, compteur « N champs non renseignés », actions : enregistrer le brouillon, publier (confirmation listant les champs modifiés), abandonner, interrupteur de la bannière. Libellés de l'interface du personnel dans les fichiers de langue existants.

### Rendu public

- Caddy, bloc du site : les requêtes qui correspondent à une page HTML du catalogue sont réécrites vers une route interne de l'application (`/_site/...`) par `php_fastcgi` ; les ressources (CSS, polices, images, scripts) restent servies directement. En cas d'erreur de l'application (5xx, délai dépassé), Caddy sert le fichier statique correspondant avec son marqueur. Le 404 du site reste `404.html`.
- Route Laravel `GET /_site/{page}` : sans état, sans session. N'accepte que les pages listées dans le catalogue (liste blanche : aucun chemin de fichier venant de l'utilisateur n'est jamais lu). Lit le fichier HTML dans le dossier monté, remplace chaque emplacement dont la valeur publiée existe (échappement HTML complet, retours à la ligne en `<br>` pour les lignes, `<p>` pour les paragraphes), retire la bannière si le drapeau le demande, ajoute `ETag` et `Cache-Control: public, max-age=300`.
- Les valeurs publiées sont gardées dans le cache applicatif ; la publication change la version et les invalide. Aucune requête SQL par affichage hors cache froid.
- Le dossier `web/` est monté en lecture seule dans le service `app` uniquement (chemin configurable par variable d'environnement). La route n'est atteignable que par le chemin réécrit par Caddy du bloc du site : sur l'hôte de l'API elle répond 404 (liste blanche existante), et sur l'hôte admin elle est inutile et sans effet de sécurité (page publique de toute façon) ; le constructeur peut la fermer en exigeant une variable d'environnement posée par Caddy.

### Sécurité

- Valeurs : texte brut, longueur maximale, échappement systématique à l'affichage ; aucun HTML n'est jamais interprété. Test dédié avec une valeur contenant `<script>` et des guillemets.
- Écriture : droit `legal.manage`, transaction avec audit, 2FA du panneau, jamais d'écriture par les formulaires génériques.
- Lecture publique : aucune donnée personnelle, seulement les textes publiés.
- La publication n'est jamais automatique.

### Tests

- Service : droits (seul l'administrateur), brouillon invisible côté public, publication, abandon, audit avec avant/après, validation (clé inconnue, longueur).
- Rendu : remplacement ligne et paragraphes, échappement, valeur vide = marqueur conservé, bannière retirée, liste blanche de pages (une page inconnue ou un chemin remonté renvoie 404), ETag.
- Cohérence : toute clé `data-legal` présente dans les pages HTML du dépôt figure dans le catalogue et inversement ; `build.py` régénère les fichiers sans changement (idempotent).
- Page Filament : accès refusé aux autres rôles, enregistrement et publication.
- Infrastructure : `caddy validate` sur le serveur, vérification en réel avant/après publication, et arrêt du conteneur `app` pour prouver le repli statique.

### Déploiement

Une seule mise en production : nouvelle migration (table), redéploiement de l'application (nouvelle route, nouveau montage du dossier `web/`), mise à jour de Caddy (`caddy validate` puis rechargement), régénération des pages (`--api-base https://api.ayelo.fr`). Retour arrière : retirer la réécriture dans le bloc Caddy du site ; les fichiers statiques continuent de servir les marqueurs.

## Choix du constructeur (à trancher pendant la planification)

- Forme exacte du balisage des emplacements ligne et paragraphes, et réutilisation du catalogue pour le formulaire.
- Stockage du drapeau de bannière.
- Durée exacte du cache public (cible : au plus 5 minutes) et valeurs d'expiration du cache applicatif.
- Remplacement du marqueur `[Nom]` par la marque « Ayelo » (hors champs : la marque est déjà connue).
- Doublons : regroupement des clés identiques (le catalogue final fixe la liste exacte des champs, environ 36).
- Longueurs maximales (proposition : 300 caractères pour une ligne, 5 000 pour des paragraphes).
- Correspondance entre l'adresse demandée et le fichier du catalogue : elle reproduit la règle actuelle de Caddy (`{path}`, `{path}.html`, `{path}/index.html`).
- Caddy distingue le repli sur erreur de l'application (servir le statique) du 404 normal (servir `404.html`), alors qu'un seul `handle_errors` existe aujourd'hui.
- Si seul le français est publié pour un champ, la page anglaise garde son marqueur (aucune obligation de renseigner les deux langues ensemble).

## Points ouverts

- Débit : la page d'accueil et les pages légales passent par PHP-FPM, partagé avec l'API. Pas de mesure à ce jour ; avec le cache applicatif et un `max-age` public, le coût attendu est faible. À mesurer après mise en production ; si nécessaire, passer un cache en tête ou précalculer les pages publiées.
