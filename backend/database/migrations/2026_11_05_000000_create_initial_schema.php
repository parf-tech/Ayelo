<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Applique le schéma de référence (docs/schema/001_initial.sql), source de vérité unique.
 * Le même fichier est testé sur PostgreSQL 16 par tests/schema.
 */
return new class extends Migration
{
    private function sqlPath(): string
    {
        foreach ([base_path('../docs/schema/001_initial.sql'), database_path('sql/001_initial.sql')] as $path) {
            if (is_file($path)) {
                return $path;
            }
        }

        throw new RuntimeException('Fichier de schéma introuvable (docs/schema/001_initial.sql).');
    }

    public function up(): void
    {
        DB::unprepared(file_get_contents($this->sqlPath()));
    }

    public function down(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Retour arrière du schéma initial interdit hors local et testing.');
        }

        DB::unprepared('drop schema public cascade; create schema public;');
    }
};
