# Image du banc en mode profil (PERF_PROFILE=1) : celle de l'application plus l'extension excimer (profil par
# échantillonnage). Construite et détruite par run.sh. JAMAIS utilisée en production.
FROM ayelo-perf-app:local
USER root
RUN apk add --no-cache --virtual .profil-deps $PHPIZE_DEPS \
 && pecl install excimer \
 && docker-php-ext-enable excimer \
 && apk del .profil-deps
COPY prepend.php requetes.php resume.php /srv/perf/profil/
RUN echo 'auto_prepend_file=/srv/perf/profil/prepend.php' > /usr/local/etc/php/conf.d/zz-profil.ini
USER www-data
