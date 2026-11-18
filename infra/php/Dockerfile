# Image de l'application Laravel (API, worker, planificateur, Reverb). Non construite ni testée sur le poste de
# développement (Docker absent) : à valider sur le serveur ou en CI avant la première mise en production.
FROM php:8.4-fpm-alpine AS base

RUN apk add --no-cache icu-libs libpq libzip freetype libjpeg-turbo libpng libwebp git unzip fcgi \
 && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS icu-dev postgresql-dev libzip-dev freetype-dev libjpeg-turbo-dev libpng-dev libwebp-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
 && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl zip gd exif pcntl opcache bcmath \
 && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html

FROM base AS build
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader
COPY backend/ ./
# Le schéma de référence est lu par la migration (docs/schema/001_initial.sql ou database/sql/).
COPY docs/schema/001_initial.sql ./database/sql/001_initial.sql
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative \
 && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache \
 && cp -a public .public-dist
# `.public-dist` : copie de public/ telle que livrée par l'image. Le volume nommé `app-public` (partagé avec Caddy) masque
# public/ et n'est rempli qu'à sa première création : sans resynchronisation, une mise à jour de l'image laisserait un
# index.php périmé. infra/scripts/deploy.sh recopie `.public-dist` dans le volume (en root : public/ n'appartient pas à
# www-data, volontairement, pour qu'une faille applicative ne puisse pas y déposer de script servi par Caddy).

FROM base AS runtime
COPY --from=build /var/www/html /var/www/html
COPY infra/php/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY infra/php/php-fpm-pool.conf /usr/local/etc/php-fpm.d/zz-pool.conf
# Valeurs par défaut du pool (voir php-fpm-pool.conf) ; surchargeables par infra/.env.prod. Sans ces ENV, ${FPM_*} serait vide
# et FPM refuserait de démarrer.
ENV FPM_MAX_CHILDREN=24 \
    FPM_START_SERVERS=6 \
    FPM_MIN_SPARE_SERVERS=4 \
    FPM_MAX_SPARE_SERVERS=10 \
    FPM_MAX_REQUESTS=500 \
    FPM_REQUEST_TERMINATE_TIMEOUT=60s \
    FPM_SLOWLOG_TIMEOUT=5s
USER www-data
EXPOSE 9000
