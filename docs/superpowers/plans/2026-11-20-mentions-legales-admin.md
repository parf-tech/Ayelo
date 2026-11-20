# Mentions légales modifiables depuis l'admin — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'administrateur saisit en FR et EN les textes manquants du site de présentation depuis le panneau Filament (brouillon puis publication) ; les pages publiques contiennent le vrai texte sans JavaScript.

**Architecture :** `web/tools/build.py` émet des emplacements nommés (`data-legal`) et un catalogue `web/tools/legal-slots.json`. Une table de brouillon/publié, un service d'administration audité et une page Filament éditent les textes. Caddy fait passer les pages HTML par une route Laravel sans état (`/_site/...`) qui remplace les emplacements par le texte publié ; en cas d'erreur de l'application, Caddy sert le fichier statique.

**Tech Stack :** Python 3 (stdlib, `build.py`), Laravel 12 + Filament 4.16 + Pest, PostgreSQL, Caddy 2.8, Docker Compose.

**Spec :** `docs/superpowers/specs/2026-11-20-mentions-legales-admin-design.md` (approuvée par le propriétaire le 2026-11-20).

## Global Constraints

- Valeurs en **texte brut** : jamais de HTML, de Markdown ni de lien ; échappement HTML complet à l'affichage ; longueur maximale **300** caractères (ligne), **5 000** (paragraphes) ; seul `\n` est accepté comme caractère de contrôle (CRLF normalisé en LF, valeur rognée).
- Droit **`legal.manage`**, accordé au **seul rôle administrateur** (`Permissions::MATRIX`) ; modérateur et support : 403.
- Actions d'audit : `legal.draft_saved`, `legal.published`, `legal.discarded`, `legal.banner_changed`. Toute écriture passe par `AdminService::audited()` (droit, mutation et audit dans une transaction).
- **Enregistrer = brouillon seulement.** Le site n'affiche que le publié. Publication toujours explicite, jamais automatique.
- Valeur par défaut d'un emplacement = le marqueur actuel (`[À COMPLÉTER : …]` / `[TO BE COMPLETED: …]`). Un champ vide, absent ou non publié garde le marqueur. FR et EN sont indépendants.
- Pages rendues : `Cache-Control: public, max-age=300` (**`no-store`** pour `confirm-deletion`), `ETag`, **aucun `Set-Cookie`**, en-tête `X-Site-Source: app` (preuve du passage par l'application). Repli statique si l'application renvoie 5xx ou ne répond pas.
- Le serveur n'a que `backend/`, `infra/`, `web/`, `docs/schema/` : rien d'autre ne doit être requis au runtime. `web/tools/` n'est jamais servi.
- Convention de schéma : SQL de référence `docs/schema/001_initial.sql` **et** migration miroir (`create table if not exists`). `SchemaTest` compte les tables.
- Libellés du personnel dans `lang/fr/admin.php` et `lang/en/admin.php` (clés identiques, test de parité existant).
- L'arbre de travail contient des modifications étrangères (`mobile/`, `docs/reviews/`) : ne `git add` que les fichiers de la tâche. Ne jamais pousser ni déployer sans feu vert explicite du propriétaire.
- Poste de développement : PHP via WinGet (`php -d memory_limit=1G vendor/bin/pest`), PostgreSQL jetable (`node tests/schema/pg16-dev.mjs`), pas de Docker ni de Caddy.

## Review Focus

Entrées ou conditions que la spec laisse sous silence, par ordre de probabilité. Chaque ligne a son test dans la tâche indiquée.

1. Valeur contenant `<script>`, `&`, guillemets, `$1`, `\1`, `{{` : affichée telle quelle, échappée, sans que le remplacement ne l'interprète (Tâche 4).
2. Valeur de plusieurs lignes (adresse collée), CRLF, espaces autour : `<br>` / paragraphes, rognée (Tâches 3 et 4).
3. Chemins hostiles ou voisins : `/_site/../.env`, `%2e%2e`, `legal/terms.html` avec extension, `/en` sans barre, page inconnue : seules les pages du catalogue répondent, le reste 404 (Tâche 4).
4. Réponse publique qui fuite un cookie de session ou devient non cachable (Tâche 4) ; application arrêtée (Tâche 6).
5. Clé inconnue dans le HTML (fichiers plus récents que l'image) ou valeur publiée vide : emplacement laissé intact, aucune exception (Tâche 4) ; publier deux fois de suite ou sans brouillon : sans effet ni bruit d'audit (Tâche 3).

---

## Plan des fichiers

| Fichier | Rôle |
|---|---|
| `web/tools/build.py` (modifié) | syntaxe `{{clé\|aide}}`, registre `SLOTS`, balisage `data-legal`, bannière marquée, écriture du catalogue |
| `web/tools/legal-slots.json` (généré, versionné) | catalogue : pages, groupes, clés, genre, libellés, aides, longueur |
| `web/tools/test_build.py` (nouveau) | tests `unittest` du générateur |
| `web/**/*.html` (régénérés) | pages avec emplacements |
| `docs/schema/001_initial.sql`, `backend/database/migrations/2026_11_20_000000_create_site_legal.php` | tables `site_legal_fields`, `site_legal_settings` |
| `backend/config/site.php` | `web_root`, `cache_seconds` |
| `backend/app/Services/Site/LegalCatalog.php` | lecture du catalogue |
| `backend/app/Services/Site/LegalPublished.php` | textes publiés + bannière, mis en cache |
| `backend/app/Services/Site/SitePageRenderer.php` | résolution de l'URL et remplissage |
| `backend/app/Http/Controllers/SiteController.php`, `backend/routes/web.php` | route `/_site/{page}` |
| `backend/app/Services/Admin/LegalContent.php` | brouillon, publication, abandon, bannière, audit |
| `backend/app/Services/Admin/Permissions.php` (modifié) | `LEGAL_MANAGE` |
| `backend/app/Filament/Pages/LegalContentPage.php` | page d'édition |
| `backend/app/Providers/AdminPanelProvider.php`, `backend/lang/{fr,en}/admin.php` (modifiés) | enregistrement, libellés |
| `infra/docker-compose.prod.yml`, `infra/caddy/Caddyfile` (modifiés) | montage de `web/` dans `app`, routage |
| `backend/tests/Feature/Site/*.php`, `backend/tests/Feature/Admin/LegalContent*.php` | tests |

---

### Task 1: générateur — emplacements nommés et catalogue

**Files :**
- Modify : `web/tools/build.py` (marqueurs `{{…}}` des chaînes `UI` et `{{{{…}}}}` des corps de page, `fill()`, `render()`, `main()`)
- Create : `web/tools/test_build.py`
- Generated : `web/tools/legal-slots.json` et tous les `web/**/*.html`

**Interfaces :**
- Produces : syntaxe source `{{clé|aide}}` (dans une chaîne formatée : `{{{{clé|aide}}}}`), l'aide change selon la langue, la clé non.
- Produces : `SLOTS: dict[str, dict]` avec, par clé, `group`, `kind` (`line`|`block`), `label` `{fr,en}`, `max` (300 ou 5000).
- Produces : balisage de sortie. Genre `line` : `<mark class="todo" data-legal="CLÉ">[À COMPLÉTER : aide]</mark>`. Genre `block` : `<div data-legal-block="CLÉ"><p><mark class="todo">[À COMPLÉTER : aide]</mark></p></div>`. Bannière : `<div class="banner" role="note" data-legal-banner>…</div>`.
- Produces : `legal-slots.json` = `{"version":1,"pages":[chemins .html à rendre],"groups":{groupe:[clés]},"slots":{clé:{group,kind,max,label:{fr,en},hint:{fr,en},pages:[clés de page]}}}`. `pages` couvre toutes les pages (FR et EN) sauf `404.html`.

- [ ] **Étape 1 : écrire les tests `unittest` dans `web/tools/test_build.py`** (charger `build.py` avec `importlib`, sans l'exécuter) :
  - `test_line_marker_is_tagged` : `fill("<p>x {{contact_privacy_email|a}} y</p>", 'fr', here)` contient `data-legal="contact_privacy_email"` et `[À COMPLÉTER : a]`.
  - `test_block_marker_is_wrapped` : `<p>{{terms_pricing|a}}</p>` devient `<div data-legal-block="terms_pricing"><p>` … `</p></div>`.
  - `test_unknown_key_fails` : une clé absente de `SLOTS` lève `SystemExit`/`ValueError`.
  - `test_block_marker_must_stand_alone` : un genre `block` hors d'un `<p>` seul lève une erreur.
  - `test_fr_en_pages_share_slot_keys` : pour chaque page, l'ensemble des clés `data-legal*` du rendu `fr` égale celui du rendu `en`.
  - `test_no_raw_braces_left` : aucun `{{` ni `}}` dans aucune page rendue.
  - `test_catalog_matches_pages` : l'ensemble des clés du catalogue égale l'union des clés trouvées dans les pages rendues ; chaque clé a `label`, `hint` fr/en non vides.
  - `test_banner_is_tagged` : chaque page rendue (hors 404) contient `data-legal-banner` exactement une fois.
  - `test_block_keys` : les clés de genre `block` sont exactement `terms_publisher`, `terms_pricing`, `terms_liability`, `terms_governing_law`, `terms_changes` (+ toute autre dont le marqueur occupe seul un `<p>`, le test calcule la règle depuis le rendu).
- [ ] **Étape 2 : lancer `python web/tools/test_build.py -v`** — attendu : échecs (syntaxe et registre absents).
- [ ] **Étape 3 : implémenter dans `build.py`** : registre `SLOTS` ; `fill()` accepte `{{clé|aide}}`, refuse une clé inconnue, applique le balisage ci-dessus ; règle `block` = le marqueur est l'unique contenu d'un `<p>`, sinon `line` ; `main()` écrit `legal-slots.json` (JSON indenté, clés triées, `ensure_ascii=False`, fin de ligne `\n`). Convertir **chaque** marqueur existant (≈38 par langue, FR et EN, hors l'exemple `[À COMPLÉTER]` de la bannière qui n'est pas un champ) : clé = `<page>_<sujet>` en minuscules, sauf quatre clés partagées entre pages : `contact_privacy_email`, `contact_security_email`, `contact_support_email`, `retention_accounting`. Le catalogue doit regrouper en environ 36 clés. Groupes : `publisher`, `contacts`, `terms`, `privacy`, `retention`, `safety`, `deletion`. Remplacer `<mark class="todo">[Nom]</mark>` par le nom de marque `Ayelo` (`UI['brand']`). Ajouter `data-legal-banner` à l'élément de la bannière.
- [ ] **Étape 4 : régénérer et vérifier** : `python web/tools/build.py --api-base https://api.ayelo.fr`, puis `python web/tools/test_build.py -v` (attendu : tout vert) et `python web/tools/check-links.py` (attendu : code de sortie 0). Relancer `build.py` : `git status --short web/` ne doit montrer aucun changement supplémentaire (idempotent).
- [ ] **Étape 5 : commit** — `git add web/` (les seuls changements de `web/` sont ceux de la tâche) puis `git commit -m "Site : emplacements nommés (data-legal) et catalogue legal-slots.json"`.

---

### Task 2: tables, configuration et lecture du catalogue

**Files :**
- Modify : `docs/schema/001_initial.sql` (après `email_suppressions`), `backend/tests/Feature/SchemaTest.php` (37 → 39 tables)
- Create : `backend/database/migrations/2026_11_20_000000_create_site_legal.php`, `backend/config/site.php`, `backend/app/Services/Site/LegalCatalog.php`
- Test : `backend/tests/Feature/Site/LegalCatalogTest.php`

**Interfaces :**
- Produces : tables `site_legal_fields(key text, lang text check in ('fr','en'), draft text null, published text null, updated_at timestamptz default now(), published_at timestamptz null, primary key (key, lang))` et `site_legal_settings(name text primary key, value text not null, updated_at timestamptz default now())`.
- Produces : `config('site.web_root')` (défaut `env('SITE_WEB_ROOT', base_path('../web'))`), `config('site.cache_seconds')` (défaut 300).
- Produces : `final class App\Services\Site\LegalCatalog` : `slots(): array<string, array{group:string, kind:string, max:int, label:array{fr:string,en:string}, hint:array{fr:string,en:string}, pages:list<string>}>`, `groups(): array<string, list<string>>`, `pages(): list<string>`, `has(string $key): bool`, `kind(string $key): string`, `max(string $key): int`. Lit `<web_root>/tools/legal-slots.json` ; fichier absent ou invalide : exception explicite (`RuntimeException`) dont le message nomme le chemin.

- [ ] **Étape 1 : écrire `LegalCatalogTest`** : (a) avec un catalogue minimal écrit dans un dossier temporaire (`config(['site.web_root' => $tmp])`) : `has`, `kind`, `max`, `pages`, `groups` ; (b) fichier absent → `RuntimeException` ; (c) **cohérence avec le dépôt réel** (`config('site.web_root')` laissé par défaut) : pour chaque page du catalogue le fichier existe ; toute valeur `data-legal="…"` et `data-legal-block="…"` trouvée dans ces fichiers est une clé du catalogue ; toute clé du catalogue apparaît dans au moins un fichier ; la liste `pages()` ne contient pas `404.html`.
- [ ] **Étape 2 : lancer** `cd backend && php -d memory_limit=1G vendor/bin/pest tests/Feature/Site/LegalCatalogTest.php` — attendu : échec (classe absente).
- [ ] **Étape 3 : écrire le SQL, la migration miroir (`create table if not exists`, `down()` : `drop table if exists` des deux tables), `config/site.php` et `LegalCatalog`** ; mettre le compte de `SchemaTest` à 39.
- [ ] **Étape 4 : lancer** `tests/Feature/Site/LegalCatalogTest.php` et `tests/Feature/SchemaTest.php` (base jetable) — attendu : verts. Vérifier aussi `node tests/schema/pg16-dev.mjs` selon la procédure habituelle si le SQL de référence est contrôlé par ce script.
- [ ] **Étape 5 : commit** — fichiers de la tâche, message « Mentions légales : tables, configuration et lecture du catalogue ».

---

### Task 3: droit, service et audit

**Files :**
- Modify : `backend/app/Services/Admin/Permissions.php` (constante `LEGAL_MANAGE = 'legal.manage'`, ajoutée au rôle administrateur seulement), `backend/lang/fr/admin.php` et `backend/lang/en/admin.php` (`audit.legal.{draft_saved,published,discarded,banner_changed}`)
- Create : `backend/app/Services/Site/LegalPublished.php`, `backend/app/Services/Admin/LegalContent.php`
- Test : `backend/tests/Feature/Admin/LegalContentTest.php`

**Interfaces :**
- Consumes : `LegalCatalog` (tâche 2), `Audit`, `AdminService::audited()`, `Seed::staff($role)` (`tests/Feature/Admin/Support/Seed.php`).
- Produces : `final class LegalPublished` : `values(): array<string, array<string, string>>` (`[clé][lang] => texte`, uniquement les textes non vides), `bannerVisible(): bool` (vrai si aucune ligne `site_legal_settings.name='banner_visible'`), `forget(): void`. Cache applicatif, clé `site_legal.published`, `Cache::rememberForever`.
- Produces : `final class LegalContent extends AdminService`, constructeur `(Audit $audit, LegalCatalog $catalog, LegalPublished $published)` :
  - `saveDraft(StaffUser $actor, array $values): int` — `$values` : `array<string, array<string, ?string>>` (`[clé][lang] => texte`). Retourne le nombre de brouillons modifiés. Une valeur égale au publié (après normalisation) supprime le brouillon (`draft = null`). `''` = effacement en attente. `DomainException` : clé inconnue, langue autre que `fr`/`en`, longueur dépassée, caractère de contrôle autre que `\n`.
  - `publish(StaffUser $actor): int` — pour chaque ligne à brouillon non nul : `published = nullif(draft,'')`, `draft = null`, `published_at = now()` ; invalide le cache ; retourne le nombre de champs publiés ; **0 sans écriture ni audit** s'il n'y a rien à publier.
  - `discard(StaffUser $actor): int` — met tous les brouillons à `null`, retourne leur nombre (0 sans audit).
  - `setBannerVisible(StaffUser $actor, bool $visible): void` — upsert de `banner_visible` = `'1'`/`'0'`, invalide le cache, audit `legal.banner_changed` (avant/après).
  - `state(): array<string, array<string, array{draft: ?string, published: ?string}>>` et `pending(): list<string>` (formes `clé.lang`) : lectures sans droit requis.
  - Audit `legal.draft_saved` (après : champs modifiés `{clé.lang: texte}`), `legal.published` (avant/après des champs publiés), `legal.discarded` (champs abandonnés).

- [ ] **Étape 1 : écrire `LegalContentTest`** (catalogue minimal en dossier temporaire) :
  - `seul l'administrateur peut écrire` : `moderator` et `support` → `AuthorizationException` sur chaque méthode d'écriture ; `Permissions::for('admin')` contient `legal.manage`, ceux des deux autres rôles non.
  - `un brouillon n'est pas publié` : après `saveDraft`, `LegalPublished::values()` est vide ; après `publish`, il contient la valeur.
  - `valeur égale au publié = pas de brouillon` ; `'' ` = effacement : après publication d'un effacement, la clé disparaît de `values()`.
  - `normalise` : `"  Rue A\r\nParis \n"` est stocké `"Rue A\nParis"`.
  - `refuse` : clé inconnue, langue `de`, 301 caractères sur une ligne, 5 001 sur un paragraphe, caractère `\x00` → `DomainException`, aucun brouillon écrit.
  - `idempotence` : `publish` deux fois de suite → second retour 0 et **une seule** ligne d'audit `legal.published` ; `discard` sans brouillon → 0, aucune ligne d'audit.
  - `audit` : une ligne `legal.draft_saved` avec l'acteur et `after` contenant les champs ; aucune clé secrète masquée par erreur.
  - `bannière` : par défaut visible ; `setBannerVisible(false)` puis `LegalPublished::bannerVisible()` faux ; une ligne d'audit.
  - `transaction` : si l'écriture d'audit échoue (simulée), le brouillon n'est pas écrit (comportement hérité de `audited()`, un test suffit).
- [ ] **Étape 2 : lancer** `tests/Feature/Admin/LegalContentTest.php` — attendu : échec.
- [ ] **Étape 3 : implémenter** `Permissions::LEGAL_MANAGE` (matrice administrateur), `LegalPublished`, `LegalContent`, les libellés d'audit FR/EN (test de parité `AdminUxTest` à garder vert).
- [ ] **Étape 4 : lancer** `tests/Feature/Admin/` (tout le dossier : la matrice et la parité de langues ne doivent pas régresser) — attendu : vert.
- [ ] **Étape 5 : commit** — « Mentions légales : droit legal.manage, brouillon, publication et audit ».

---

### Task 4: rendu public

**Files :**
- Create : `backend/app/Services/Site/SitePageRenderer.php`, `backend/app/Http/Controllers/SiteController.php`
- Modify : `backend/routes/web.php`
- Test : `backend/tests/Feature/Site/SitePageRendererTest.php`, `backend/tests/Feature/Site/SiteRouteTest.php`

**Interfaces :**
- Consumes : `LegalCatalog`, `LegalPublished` (tâche 3), `config('site.web_root')`, `config('site.cache_seconds')`.
- Produces : `final class SitePageRenderer` : `pageFor(string $urlPath): ?string` (fichier du catalogue pour une adresse, mêmes règles que Caddy : `{path}`, `{path}.html`, `{path}/index.html` ; `''` et `/` → `index.html` ; seule une page de `pages()` est renvoyée, jamais un chemin construit depuis l'entrée) ; `render(string $page): string` (page = valeur de `pageFor`).
- Produces : route `GET /_site/{page?}` (`where('page', '.*')`), `SiteController::show(Request $request, string $page = ''): Response`, **sans** les middlewares de session, de cookies, d'erreurs partagées ni de CSRF (`withoutMiddleware([...])`). Réponse 200 : `Content-Type: text/html; charset=utf-8`, `Cache-Control`, `ETag`, `X-Site-Source: app`, 304 sur `If-None-Match`. Inconnue : 404.
- Règles de remplissage : genre `line` : `<mark class="todo" data-legal="CLÉ">…</mark>` remplacé par `nl2br(e(valeur))` ; genre `block` : le `<div data-legal-block="CLÉ">…</div>` remplacé par un `<p>` par paragraphe (séparés par une ligne vide), `\n` simples → `<br>`, échappé. La langue vient du préfixe `en/` du fichier. Clé inconnue du catalogue ou valeur vide : élément laissé intact. Bannière : `data-legal-banner` retirée entièrement si `bannerVisible()` est faux. Remplacement par `preg_replace_callback` (jamais de référence `$1` dans la valeur).

- [ ] **Étape 1 : écrire `SitePageRendererTest`** (pages HTML minimales écrites dans un dossier temporaire, avec le balisage exact de la tâche 1) :
  - `remplace une ligne FR et conserve l'EN` ; `remplace un paragraphe` (3 paragraphes, un `\n` simple → `<br>`).
  - `échappe` : valeur `<script>alert(1)</script> & "x" $1 \1 {{k|a}}` → texte échappé littéral, aucun `<script>` dans la sortie, `$1` et `\1` intacts.
  - `valeur vide ou non publiée → marqueur d'origine` ; `clé inconnue dans le HTML → intact, sans exception`.
  - `bannière retirée / conservée` selon `bannerVisible()`.
  - `pageFor` : `/`, `/en/`, `/en`, `/legal/terms`, `/legal/terms/`, `/support` résolus ; refusés : `/legal/terms.html`, `/../.env`, `/%2e%2e/.env`, `/tools/legal-slots.json`, `/404`, `/assets/site.css`, chaîne vide avec `//`.
- [ ] **Étape 2 : écrire `SiteRouteTest`** : `GET /_site/legal/terms` → 200, `X-Site-Source: app`, `Cache-Control` contient `max-age=300`, **aucun en-tête `Set-Cookie`**, `ETag` présent, 304 au second appel avec `If-None-Match` ; `GET /_site/confirm-deletion` → `Cache-Control: no-store` ; `/_site/inconnue` → 404 ; après `publish`, le contenu change et l'`ETag` aussi.
- [ ] **Étape 3 : lancer** `tests/Feature/Site/` — attendu : échec.
- [ ] **Étape 4 : implémenter** renderer, contrôleur, route.
- [ ] **Étape 5 : lancer** `tests/Feature/Site/` puis toute la suite `php -d memory_limit=1G vendor/bin/pest` — attendu : tout vert (aucune régression sur `CorsTest`, `DeployReadinessTest`).
- [ ] **Étape 6 : commit** — « Mentions légales : rendu public côté serveur (/_site) ».

---

### Task 5: page d'administration

**Files :**
- Create : `backend/app/Filament/Pages/LegalContentPage.php`
- Modify : `backend/app/Providers/AdminPanelProvider.php` (`->pages([Dashboard::class, Pages\LegalContentPage::class])`), `backend/lang/fr/admin.php`, `backend/lang/en/admin.php` (`legal.*` : titre, groupes `publisher|contacts|terms|privacy|retention|safety|deletion`, boutons, notifications, compteur, texte de confirmation, mention « texte brut »)
- Test : `backend/tests/Feature/Admin/LegalContentPageTest.php`; modifier `PermissionsTest.php` (`PAGES` : `/admin/legal` → moderator false, support false, admin true) et le contrôle « 2FA requise » de `AccessTest.php`.

**Interfaces :**
- Consumes : `LegalContent`, `LegalCatalog`, `Staff::run(Closure, string)`, `Staff::can(...)`, `Staff::t(...)`.
- Produces : page Filament, slug `legal`, `canAccess()` = `Staff::can(Permissions::LEGAL_MANAGE)`, groupe de navigation du panneau, un `Section` par groupe du catalogue, deux champs par emplacement (FR et EN côte à côte ; `TextInput` pour `line`, `Textarea` pour `block`), `maxLength` du catalogue, indication d'aide du catalogue sous chaque champ (langue du personnel), champ pré-rempli avec `coalesce(draft, published, '')`.
- Actions : `saveDraft` (appelle `LegalContent::saveDraft`), `publish` (`requiresConfirmation()`, description listant `LegalContent::pending()` et désactivée s'il n'y en a pas), `discard` (confirmation), interrupteur de bannière (confirmation, immédiat). Compteur « N champs sans texte publié » calculé depuis `state()`.

- [ ] **Étape 1 : écrire `LegalContentPageTest`** (`Filament::setCurrentPanel('admin')`, `Livewire::test(LegalContentPage::class)`, catalogue en dossier temporaire) :
  - accès : administrateur 200 ; modérateur et support 403 ; anonyme redirigé vers `/admin/login`.
  - `enregistre un brouillon` : après `saveDraft`, la ligne existe avec `draft`, `published` nul, une ligne d'audit.
  - `publie` : après l'action `publish` confirmée, `LegalPublished::values()` contient le texte.
  - `publier sans brouillon` : bouton désactivé / action sans effet.
  - `abandonne` : les brouillons disparaissent, le publié reste.
  - `bannière` : l'interrupteur écrit `banner_visible='0'` et audite.
  - `valeur invalide` (trop longue) : notification d'erreur, rien d'écrit.
  - `parité de langues` : toutes les nouvelles clés `legal.*` existent en FR et EN (le test existant `AdminUxTest` couvre la parité globale).
- [ ] **Étape 2 : lancer** `tests/Feature/Admin/LegalContentPageTest.php` — attendu : échec.
- [ ] **Étape 3 : implémenter** la page, l'enregistrement dans le panneau, les libellés.
- [ ] **Étape 4 : lancer** `tests/Feature/Admin/` puis la suite complète — attendu : vert. Vérifier à l'écran sur l'environnement d'aperçu local (`scripts/dev-preview.ps1`) que la page s'affiche avec les ~36 champs groupés, en français et en anglais (capture d'écran ou description de ce qui est vu).
- [ ] **Étape 5 : commit** — « Mentions légales : page d'administration (brouillon, publication, bannière) ».

---

### Task 6: infrastructure (Caddy et montage)

**Files :**
- Modify : `infra/docker-compose.prod.yml` (service `app` : volume `../web:/srv/web:ro` et `environment: SITE_WEB_ROOT: /srv/web`), `infra/caddy/Caddyfile` (bloc `{$WEB_DOMAIN}`), `docs/runbooks/site-public.md`, `docs/runbooks/deploiement.md`

**Interfaces :**
- Consumes : route `/_site/{page?}` et en-têtes de la tâche 4.
- Produces : dans le bloc du site, les adresses de pages HTML (tout sauf `/assets/*`, `/favicon.svg`, `/robots.txt`, `/.well-known/*`, `/tools/*`) sont réécrites en `/_site{path}` et servies par `php_fastcgi app:9000` avec `root /var/www/html/public` propre à ce traitement ; erreur 5xx ou connexion refusée : repli sur `try_files {path} {path}.html {path}/index.html` + `file_server` ; adresse sans page : `404.html` avec statut 404 (comportement actuel conservé) ; le `Cache-Control: public, max-age=3600` global est restreint au traitement statique (les pages rendues gardent `max-age=300`) ; `no-store` de `@confirm` conservé ; `web_headers` (CSP, sécurité) appliqués dans tous les cas.

- [ ] **Étape 1 : modifier le compose et le Caddyfile** ; documenter dans le runbook : qui peut éditer, brouillon/publication, délai de 5 minutes, repli statique, retour arrière (retirer la réécriture du bloc), et l'obligation de régénérer les pages (`python web/tools/build.py --api-base https://api.ayelo.fr`) quand `build.py` change.
- [ ] **Étape 2 : contrôler la syntaxe** : `bash -n` ne suffit pas ; la validation réelle se fait sur le serveur (étape 5). Localement : relire le bloc, vérifier qu'aucune route ne dépend de `app-public` hors du bloc.
- [ ] **Étape 3 : commit** — « Infra : pages du site remplies par l'application, repli statique ».
- [ ] **Étape 4 : demander au propriétaire son feu vert** (push puis déploiement). Sans feu vert, s'arrêter ici.
- [ ] **Étape 5 : déployer** (après feu vert) : `git push`, puis sur le VPS en tant que `deploy` : `git pull --ff-only` dans `/srv/ayelo`, `bash infra/scripts/deploy.sh` (construction de l'image : la migration, la route et le volume sont nouveaux), puis `docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec -T caddy caddy validate --config /etc/caddy/Caddyfile` et `... exec -T caddy caddy reload --config /etc/caddy/Caddyfile`. Rappel : `git` sur `/srv/ayelo` se lance en tant que `deploy`.
- [ ] **Étape 6 : vérifier en réel** : `curl -sI https://ayelo.fr/legal/terms` → 200, `X-Site-Source: app`, `Cache-Control: public, max-age=300`, pas de `Set-Cookie` ; `curl -sI https://ayelo.fr/assets/site.css` → pas de `X-Site-Source` ; `https://ayelo.fr/inconnue` → 404 ; page identique à l'ancienne (aucune valeur publiée : marqueurs présents) ; `https://ayelo.fr/_site/legal/terms` sur le domaine nu → 404 (pas de chemin interne exposé : à corriger dans le Caddyfile s'il répond 200) ; `https://api.ayelo.fr/_site/legal/terms` → 404. **Repli** : `docker compose ... stop app`, `curl -sI https://ayelo.fr/legal/terms` → 200 **sans** `X-Site-Source` et page statique complète, puis `docker compose ... start app` et attendre l'état `healthy`.
- [ ] **Étape 7 : consigner** le résultat dans `docs/runbooks/deploiement.md` (ce qui a été vérifié et la date) et dans la mémoire du projet.

---

### Task 7: première publication réelle et clôture

**Files :**
- Modify : `docs/reviews/restant.md` (mentions légales : saisie via l'admin ; le contenu juridique reste à fournir), `docs/16-STATUS.md` si une ligne décrit ce chantier
- Mémoire : `project-refonte-landing.md` ou `project-vps-staging.md` (fonction en place, comment s'en servir)

- [ ] **Étape 1 : guider le propriétaire** : lui indiquer l'adresse du panneau (`https://admin.ayelo.fr/admin/legal`), son compte administrateur et la 2FA existants. Lui demander d'enregistrer **une vraie valeur** (ex. l'adresse de contact `support`) et de la publier.
- [ ] **Étape 2 : contrôler** : `curl -s https://ayelo.fr/support | grep` de la valeur publiée sous 5 minutes ; page anglaise toujours avec son marqueur tant que l'EN n'est pas publié ; ligne d'audit visible dans « Journal d'audit ».
- [ ] **Étape 3 : mettre à jour** `restant.md` et la mémoire ; **ne rien inventer** : les paragraphes juridiques restent à rédiger par le propriétaire et son juriste.
- [ ] **Étape 4 : commit** — « Doc : mentions légales saisies depuis l'admin ».

---

## Auto-revue

- **Couverture de la spec :** page admin réservée à l'administrateur (T3, T5) ; FR/EN côte à côte (T5) ; brouillon/publié, confirmation listant les champs (T3, T5) ; HTML réel sans JavaScript (T4) ; marqueur par défaut (T1, T4) ; audit avant/après (T3) ; repli statique (T6) ; bannière (T1, T3, T4, T5) ; échappement et texte brut (T3, T4) ; liste blanche des pages (T4) ; catalogue sans dérive (T1, T2) ; `caddy validate` et déploiement (T6) ; choix du constructeur tranchés : balisage (T1), bannière dans `site_legal_settings` (T2), cache 300 s (T4), `[Nom]` → `Ayelo` (T1), longueurs 300/5000 (Global Constraints), règle de correspondance d'adresse (T4), `handle_errors` distinguant 5xx et 404 (T6), FR/EN indépendants (T4).
- **Cohérence des noms :** `LegalCatalog`, `LegalPublished`, `LegalContent`, `SitePageRenderer`, `SiteController`, `LegalContentPage`, `Permissions::LEGAL_MANAGE`, actions d'audit `legal.*`, clé de cache `site_legal.published`, tables `site_legal_fields` / `site_legal_settings` : identiques d'une tâche à l'autre.
- **Point à mesurer après la mise en production :** débit de PHP-FPM sur la page d'accueil (non mesuré, risque signalé dans la spec).
