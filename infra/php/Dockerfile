# Image de l'application Laravel (API, worker, planificateur, Reverb). Non construite ni testée sur le poste de
# développement (Docker absent) : à valider sur le serveur ou en CI avant la première mise en production.
FROM php:8.4-fpm-alpine AS base

RUN apk add --no-cache icu-libs libpq libzip freetype libjpeg-turbo libpng libwebp git unzip \
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
 && chown -R www-data:www-data storage bootstrap/cache

FROM base AS runtime
COPY --from=build /var/www/html /var/www/html
COPY infra/php/php.ini /usr/local/etc/php/conf.d/zz-app.ini
USER www-data
EXPOSE 9000
