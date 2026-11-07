<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    /** Données fictives uniquement : jamais en production. */
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Le jeu de données fictif ne peut pas être chargé en production.');
        }

        $this->call(DemoDataSeeder::class);
    }
}
