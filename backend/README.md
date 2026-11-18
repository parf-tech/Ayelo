<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework. You can also check out [Laravel Learn](https://laravel.com/learn), where you will be guided through building a modern Laravel application.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com)**
- **[Tighten Co.](https://tighten.co)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## Administration

Back-office Filament 4 (version épinglée) sur `/admin`, séparé de l'API. Spécification : `specs/009-admin-backoffice/`.

- **Authentification** : garde `staff` sur la table `staff_users` (jamais `users`). La double authentification (application TOTP) est **obligatoire** : un compte sans 2FA est redirigé vers l'écran de configuration et ne voit rien d'autre. Un compte `is_active = false` ne peut pas se connecter ; sa session ouverte est refusée à la requête suivante.
- **Rôles** : `moderator` (médias, signalements, contestations, vérifications), `support` (tickets, lecture seule des utilisateurs), `admin` (tout, y compris ajustement de crédits et Premium offert). Matrice unique : `app/Services/Admin/Permissions.php`, lue par les politiques Filament et par les services.
- **Journal d'audit** : toute action passe par un service de `app/Services/Admin/` (hérite de `AdminService`), qui écrit la mutation et la ligne `audit_logs` dans la même transaction ; sans écriture du journal, l'action est annulée. Connexions, échecs de connexion, consultation de selfie et changements de 2FA y figurent aussi. La table est en ajout seulement (déclencheur SQL) et l'interface est en lecture seule.

### Créer le premier administrateur

```bash
php artisan staff:create admin@exemple.test admin          # mot de passe généré, affiché UNE seule fois
php artisan staff:create admin@exemple.test admin --prompt # ou saisie masquée (12 caractères minimum)
php artisan staff:reset-2fa admin@exemple.test             # téléphone perdu : efface la 2FA (journalisé)
```

Rôles : `moderator`, `support`, `admin`. Le mot de passe n'est jamais passé en argument, ni écrit dans les journaux. À la première connexion sur `/admin`, scanner le QR code avec une application TOTP et **noter les codes de secours**.

### Déploiement

- `SESSION_DRIVER` doit être un vrai pilote de session (`redis` ou `file`) pour le panneau ; `.env.example` utilise `array` pour l'API sans état (le panneau retombe sur `file` si `array` est détecté hors tests).
- Planifier `php artisan sanctions:expire` (chaque minute) : réactive les comptes dont la suspension à durée limitée est terminée. Sans cela, une suspension expirée resterait bloquante (l'API refuse la connexion tant que le statut n'est pas `active`).
- Après chaque déploiement : `php artisan filament:assets` (publie les ressources statiques du panneau dans `public/`). En production, `infra/scripts/deploy.sh` le fait (en root, `public/` n'appartient pas à `www-data`) avec les migrations, `php artisan deploy:preflight` et les caches : voir `docs/runbooks/deploiement.md`.
- En production : sous-domaine dédié et accès réseau restreint (docs/11), à configurer côté infrastructure ; le panneau n'a pas de restriction de domaine ou d'IP intégrée.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
