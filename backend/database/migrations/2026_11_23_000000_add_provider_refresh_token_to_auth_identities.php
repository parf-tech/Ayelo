<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Jeton de rafraîchissement du fournisseur (Apple), gardé CHIFFRÉ (Crypt) pour pouvoir le révoquer quand le compte est supprimé :
 * Apple l'exige pour « Se connecter avec Apple ». Nul pour Google et pour un compte Apple connecté sans code d'autorisation.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared('alter table auth_identities add column if not exists provider_refresh_token text');
    }

    public function down(): void
    {
        DB::unprepared('alter table auth_identities drop column if exists provider_refresh_token');
    }
};
