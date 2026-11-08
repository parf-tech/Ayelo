<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adresses en rebond définitif ou en plainte : plus aucun e-mail de compte ne leur est envoyé (App\Services\MailSuppression).
 * Miroir : docs/schema/001_initial.sql (sur une base neuve le fichier SQL crée déjà la table et cette migration ne fait rien).
 * Pas de clé étrangère vers users : une adresse reste supprimée même si le compte est effacé ou si elle sert à une inscription future.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            create table if not exists email_suppressions (
              email citext primary key,
              reason text not null check (reason in ('hard_bounce','complaint')),
              provider text not null,
              created_at timestamptz not null default now()
            )
            SQL);
    }

    public function down(): void
    {
        DB::statement('drop table if exists email_suppressions');
    }
};
