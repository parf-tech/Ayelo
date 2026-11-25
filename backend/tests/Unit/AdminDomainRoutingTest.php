<?php

/*
 | Revue N-01 : avec ADMIN_DOMAIN, le panneau n'est routé que sur son domaine. Le domaine est lu au démarrage de l'application,
 | d'où le redémarrage dans le test (sans base de données : la page de connexion n'en a pas besoin).
 */

use Tests\TestCase;

uses(TestCase::class);

/** Pose (ou retire, avec null) une variable d'environnement avant le redémarrage de l'application. */
function setAdminDomainEnv(?string $domain): void
{
    if ($domain === null) {
        putenv('ADMIN_DOMAIN');
        unset($_ENV['ADMIN_DOMAIN'], $_SERVER['ADMIN_DOMAIN']);

        return;
    }
    putenv('ADMIN_DOMAIN='.$domain);
    $_ENV['ADMIN_DOMAIN'] = $_SERVER['ADMIN_DOMAIN'] = $domain;
}

afterEach(fn () => setAdminDomainEnv(null));

it('N-01 : avec ADMIN_DOMAIN, la page de connexion répond sur ce domaine et 404 sur celui de l’API', function () {
    setAdminDomainEnv('admin.example.test');
    $this->refreshApplication();

    $this->get('http://api.example.test/admin/login')->assertNotFound();
    $this->get('http://api.example.test/admin')->assertNotFound();
    $this->get('http://admin.example.test/admin/login')->assertOk();
});
