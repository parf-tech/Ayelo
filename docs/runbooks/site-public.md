# Site public statique (`web/`) : publication avec Caddy

Réponse au constat P0-1 de `docs/reviews/design-1.md` (pages web publiques absentes). Le dossier `web/` contient un site statique : HTML et CSS simples, un seul petit script facultatif (`assets/deletion.js`, formulaires de suppression), aucune police ni ressource externe, aucun suivi, fonctionne hors ligne. Français à la racine, anglais sous `/en/`.

**État : version provisoire.** Chaque page porte le bandeau « Version provisoire, à valider par un juriste » et des marqueurs visibles `[À COMPLÉTER : ...]` (société, adresse, e-mails, hébergeur, durées non fixées). Aucune entité, adresse ni e-mail n'est inventée : les adresses sont en `example.invalid` (jamais routable). Le texte vient de `docs/legal/*` (brouillons 0.1 et 0.2) et n'est pas validé. Ne pas retirer le bandeau avant la validation du juriste (`docs/legal/00-LISEZ-MOI.md`).

## Contenu

| URL (français) | Fichier | Remarque |
| --- | --- | --- |
| `/` | `index.html` | accueil |
| `/legal/terms` | `legal/terms.html` | conditions d'utilisation |
| `/legal/privacy` | `legal/privacy.html` | politique de confidentialité |
| `/legal/community` | `legal/community.html` | règles de la communauté |
| `/safety` | `safety.html` | sécurité et signalement |
| `/support` | `support.html` | contact et questions fréquentes |
| `/account/delete` | `account/delete.html` | suppression de compte (URL à déclarer dans Google Play) |
| `/confirm-deletion` | `confirm-deletion.html` | cible du lien envoyé par e-mail (`noindex`) |
| `/en/...` | `en/...` | mêmes pages en anglais |
| `/404.html`, `/robots.txt`, `/.well-known/security.txt` | | erreur, robots, modèle RFC 9116 |

Les chemins `/legal/terms`, `/legal/privacy`, `/legal/community`, `/account/delete`, `/support` sont ceux de la revue de design. Les valeurs à mettre dans l'application : `EXPO_PUBLIC_TERMS_URL=https://<WEB_DOMAIN>/legal/terms`, `EXPO_PUBLIC_PRIVACY_URL=https://<WEB_DOMAIN>/legal/privacy`, `EXPO_PUBLIC_COMMUNITY_RULES_URL=https://<WEB_DOMAIN>/legal/community`.

## Suppression de compte : ce que la page fait vraiment

Faits relevés dans `backend/routes/api/account.php` et `AccountController` :

- `POST /api/account-deletion-requests` (corps `email`) : répond toujours 202 ; si un compte actif existe, un e-mail contient `{APP_WEB_URL}/confirm-deletion?token=...` (code à usage unique valable 60 minutes).
- `POST /api/account-deletion-requests/confirm` (corps `token`) : 202 puis demande de suppression (profil masqué, sessions fermées, anonymisation après 30 jours par `accounts:purge`), ou 422 `invalid_token`.

Aucune page web n'existait pour cela. `web/account/delete.html` (formulaire d'e-mail) et `web/confirm-deletion.html` (confirmation) la fournissent. `assets/deletion.js` envoie la requête en JSON et affiche la réponse ; sans JavaScript, le formulaire s'envoie en `application/x-www-form-urlencoded` (accepté par la validation Laravel) et le navigateur affiche la réponse brute (page vide, code 202).

À faire par l'exploitant :

1. **`APP_WEB_URL=https://<WEB_DOMAIN>`** dans `infra/.env.prod`. Sans cela, le lien de l'e-mail pointe vers `APP_URL`, qui n'a pas de page.
2. **Relier les formulaires à l'API** : les formulaires pointent par défaut vers `https://api.example.invalid`, et la page affiche alors « non relié au service ». Régénérer les pages : `python web/tools/build.py --api-base https://<API_DOMAIN>`, puis `python web/tools/check-links.py`.
3. **CORS** : l'appel part du domaine du site vers le domaine de l'API. `backend/config/cors.php` n'ouvre CORS que pour `api/v1/account-deletion-requests*` (et la forme sans `v1`), méthodes `POST` et `OPTIONS`, en-tête `Content-Type`, sans identifiants, et seulement pour l'origine du site : `CORS_ALLOWED_ORIGINS` (origines complètes séparées par des virgules) ou, à défaut, l'origine de `APP_WEB_URL`. Tout le reste de l'API répond sans en-tête CORS. Test : `backend/tests/Feature/CorsTest.php`. À vérifier une fois avec un vrai navigateur après la mise en ligne. La CSP ci-dessous autorise `connect-src` et `form-action` vers `{$API_DOMAIN}` et rien d'autre.
4. Les comptes créés uniquement par connexion sociale n'ont pas de mot de passe : la voie e-mail ne les exclut pas, mais leur cas n'a pas été testé. La page renvoie vers le support (voir la checklist stores, révocation Apple ouverte).
5. **Annulation pendant le délai de 30 jours** : non vérifiée dans le code (la page ne la promet pas, elle renvoie au support). À trancher côté produit.

## Valeurs de conservation affichées

Reprises de `backend/config/retention.php` et `AccountDeletion::GRACE_DAYS`, **copiées à la main** dans `web/tools/build.py` (constantes `GRACE_DAYS`, `REPORT_DAYS`, `SANCTION_DAYS`) : délai 30 jours, texte libre des signalements 365 jours (`RETENTION_REPORT_DETAILS_DAYS`), motif des sanctions 365 jours (`RETENTION_SANCTION_REASON_DAYS`). Si `.env.prod` change ces variables, modifier les constantes et relancer `python web/tools/build.py`.

## Caddy : bloc à ajouter à `infra/caddy/Caddyfile`

Ajouter un snippet et un bloc d'hôte (le snippet `security_headers` existe déjà dans le fichier).

```caddyfile
# En-têtes du site public. `security_headers` fournit déjà HSTS, nosniff, X-Frame-Options, Referrer-Policy no-referrer, etc.
# Le site n'a ni script externe, ni police, ni image tierce : CSP default-src 'self'.
# connect-src et form-action autorisent seulement l'API, pour les formulaires de suppression de compte.
(web_headers) {
	import security_headers
	header Content-Security-Policy "default-src 'self'; connect-src 'self' https://{$API_DOMAIN}; form-action 'self' https://{$API_DOMAIN}; frame-ancestors 'none'; base-uri 'none'; object-src 'none'"
}

# Site public statique (conditions, confidentialité, règles, sécurité, support, suppression de compte).
{$WEB_DOMAIN} {
	root * /srv/web
	encode zstd gzip
	import web_headers
	header Cache-Control "public, max-age=3600"

	# Le dossier tools/ (scripts de génération et de contrôle) n'est jamais servi.
	@private path /tools /tools/* /.git /.git/*
	respond @private 404

	# Les liens de la version anglaise sont relatifs : /en doit se terminer par une barre oblique.
	redir /en /en/ permanent

	# Page contenant un jeton dans l'URL : jamais mise en cache.
	@confirm path /confirm-deletion /confirm-deletion.html /en/confirm-deletion /en/confirm-deletion.html
	header @confirm Cache-Control "no-store"

	# URL propres : /legal/terms sert legal/terms.html, /en/ sert en/index.html.
	try_files {path} {path}.html {path}/index.html
	file_server

	# 404 : la même page, avec le code 404 conservé.
	handle_errors {
		rewrite * /404.html
		import web_headers
		file_server
	}
}
```

Notes :

- `WEB_DOMAIN` doit être un nom DNS (enregistrement A/AAAA vers le serveur) comme `API_DOMAIN` ; Let's Encrypt émet le certificat tout seul.
- Le fichier `/.well-known/security.txt` est servi tel quel par `file_server` (Caddy ne masque pas les dossiers commençant par un point). C'est un **modèle** : remplacer les valeurs `[A COMPLETER]` avant la mise en ligne, ou le retirer.
- `robots.txt` interdit seulement `/confirm-deletion`. Ajouter la ligne `Sitemap:` quand le domaine est connu.
- Valider avec `caddy validate --config /etc/caddy/Caddyfile` sur le serveur (non exécuté ici : Caddy n'est pas installé sur le poste de développement).

## Compose : variable et volume (déjà en place)

`infra/docker-compose.prod.yml`, service `caddy` : variable `WEB_DOMAIN: ${WEB_DOMAIN}` et volume `../web:/srv/web:ro`. `infra/.env.prod.example` porte `WEB_DOMAIN=www.example.invalid`, `APP_WEB_URL=https://www.example.invalid` et `CORS_ALLOWED_ORIGINS=` (vide : repli sur `APP_WEB_URL`). Les deux valeurs `WEB_DOMAIN` et `APP_WEB_URL` doivent désigner le même hôte. Seul Caddy utilise `WEB_DOMAIN` (l'application utilise `APP_WEB_URL`). Le dossier `web/tools/` est monté mais jamais servi (bloc `@private` du Caddyfile). Les blocs `(web_headers)` et `{$WEB_DOMAIN}` sont dans `infra/caddy/Caddyfile` : l'extrait ci-dessus en est la référence, ne pas l'ajouter une seconde fois.

## Production en ligne (2026-11-19)

Site publié sur le **domaine nu** : `WEB_DOMAIN=ayelo.fr`, `APP_WEB_URL=https://ayelo.fr` (même origine pour l'e-mail de suppression et pour CORS), `REVERB_ALLOWED_ORIGINS=ayelo.fr,ws.ayelo.fr`. `www.ayelo.fr` redirige en 301 vers `https://ayelo.fr` (dernier bloc du Caddyfile, `www.{$WEB_DOMAIN}`). DNS : A `ayelo.fr` et A `www.ayelo.fr` vers le VPS, en DNS seul (pas de proxy Cloudflare : Caddy obtient lui-même les certificats). Pages régénérées avec `--api-base https://api.ayelo.fr`. `/.well-known/security.txt` (modèle « NE PAS PUBLIER ») est masqué par le bloc `@private` jusqu'à ce qu'une vraie adresse soit renseignée. Les marqueurs « À COMPLÉTER » et la bannière « Version provisoire, à valider par un juriste » restent affichés tant que le propriétaire n'a pas fourni les valeurs.

## Landing (refonte du 2026-11-19)

L'accueil est une vraie landing (héros violet avec le symbole animé, confiance, trois étapes, intentions, questions fréquentes), générée par `web/tools/build.py` (`PAGES['index']`, rendu propre à `key == 'index'` dans `render()`) et stylée dans `web/assets/site.css` (section « Landing »). Brief : `docs/design/PROMPT-LANDING.md` ; plan, mesures et captures : `docs/design/07-landing.md`. Les pages légales gardent leur mise en page ; toutes les pages ont désormais `hreflang`, `canonical` et Open Graph en URL absolues (`SITE` dans `build.py`) et l'image de partage `assets/brand/ayelo-og.png` (1200 × 630). Ne jamais utiliser `--color-surface` comme texte clair sur le violet de marque (il devient sombre en thème sombre) : utiliser `--on-brand-muted`.

## Commande de production

Depuis la racine du dépôt, une fois `API_DOMAIN` connu (même valeur que dans `infra/.env.prod`), avec le schéma `https://` et sans barre finale :

```sh
python web/tools/build.py --api-base "https://$API_DOMAIN" && python web/tools/check-links.py
```

Exemple : `python web/tools/build.py --api-base https://api.mondomaine.tld`. Sans `--api-base`, la valeur par défaut est `https://api.example.invalid` (les formulaires affichent « non relié au service »). Les `.html` régénérés sont versionnés : les valider et les déployer avec le dépôt (le volume `../web` est lu par Caddy sans redémarrage).

## Modifier le site et le contrôler

- Les pages HTML sont **générées** par `web/tools/build.py` (textes français et anglais dans le même fichier, pour garder les deux synchrones) puis versionnées. Modifier le texte dans `build.py`, relancer `python web/tools/build.py`, ne pas éditer les `.html` à la main.
- `python web/tools/check-links.py` (option `-v` pour le détail) vérifie : HTML bien formé (balises, doctype, `lang`, `title`, un seul `h1`), liens et ressources internes résolus, aucune ressource externe, parité fr/en, contraste WCAG AA des jetons en clair et en sombre. À brancher en CI avec les autres contrôles.
- Jetons : `web/assets/tokens.css` recopie `mobile/src/theme/tokens.ts` (couleurs, espacement, rayons, typographie ; spécification `docs/reviews/design-1.md` 8.3). Mettre les deux à jour ensemble.

## Limites connues

- `hreflang` : les liens alternatifs sont relatifs ; les moteurs de recherche attendent des URL absolues. À corriger quand le domaine est connu (aussi `canonical` et `Sitemap`).
- Textes juridiques : aucune validation. Les sections signalées `[À COMPLÉTER]` (éditeur, hébergeur, durées comptables, hash d'e-mail d'un compte sanctionné, journaux, sauvegardes, rétractation, droit applicable) restent à rédiger par un juriste ; la matrice `docs/legal/04-matrice-marches.md` liste les questions ouvertes par marché.
- Les engagements de délai de traitement (signalements, support) ne sont pas affichés : aucun budget de modération n'est arrêté (`docs/DECISIONS-PROPRIETAIRE.md`, Q2).
- Nom de l'application : `[Nom de l'application]` partout (le nom « Ayelo » est provisoire, recherche d'antériorité non faite).
- Rendu visuel non contrôlé dans un navigateur par l'auteur du dossier : ouvrir `web/index.html` hors ligne (double-clic) en clair et en sombre avant mise en ligne. Les liens relatifs fonctionnent aussi en `file://`, sauf `/404.html` (liens racine).
