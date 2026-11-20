<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Mentions légales du site de présentation, modifiables depuis le panneau d'administration (App\Services\Admin\LegalContent).
 * Miroir : docs/schema/001_initial.sql (sur une base neuve le fichier SQL crée déjà les tables et cette migration ne fait rien).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            create table if not exists site_legal_fields (
              key text not null,
              lang text not null check (lang in ('fr','en')),
              draft text,
              published text,
              updated_at timestamptz not null default now(),
              published_at timestamptz,
              primary key (key, lang)
            )
            SQL);
        DB::statement(<<<'SQL'
            create table if not exists site_legal_settings (
              name text primary key,
              value text not null,
              updated_at timestamptz not null default now()
            )
            SQL);
    }

    public function down(): void
    {
        DB::statement('drop table if exists site_legal_settings');
        DB::statement('drop table if exists site_legal_fields');
    }
};
