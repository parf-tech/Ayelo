<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Langue du back-office choisie par chaque membre du personnel (« fr » ou « en ») ; nul = réglage du serveur (ADMIN_LOCALE).
 * Jamais déduite de l'en-tête Accept-Language (voir App\Filament\Support\StaffLocale).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared("alter table staff_users add column if not exists locale text check (locale in ('fr','en'))");
    }

    public function down(): void
    {
        DB::unprepared('alter table staff_users drop column if exists locale');
    }
};
