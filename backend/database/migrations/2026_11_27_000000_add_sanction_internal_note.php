<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Note interne d’une sanction (pentest P-09) : séparée du motif communiqué à la personne, lue par le personnel seulement. */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared('alter table sanctions add column if not exists internal_note text check (char_length(internal_note) <= 1000)');
    }

    public function down(): void
    {
        DB::unprepared('alter table sanctions drop column if exists internal_note');
    }
};
