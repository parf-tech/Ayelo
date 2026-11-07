<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Revue F-13 : horodatage (event_timestamp_ms RevenueCat) du dernier événement appliqué à l'abonnement,
 * pour ignorer un événement plus ancien livré après un plus récent (réessais).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('alter table subscriptions add column if not exists last_event_ms bigint');
    }

    public function down(): void
    {
        DB::statement('alter table subscriptions drop column if exists last_event_ms');
    }
};
