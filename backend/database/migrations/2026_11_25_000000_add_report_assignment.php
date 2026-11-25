<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Signalements : attribution (« Prendre ») avec verrou de décision. `assigned_to` : membre du personnel qui l'a pris (nul si libre ou
 * si ce membre est supprimé) ; `assigned_at` : début du verrou, qui expire (`admin.assignment_ttl_minutes`).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
alter table reports
  add column if not exists assigned_to uuid references staff_users(id) on delete set null,
  add column if not exists assigned_at timestamptz;
create index if not exists reports_assigned_to_idx on reports (assigned_to) where assigned_to is not null;
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
drop index if exists reports_assigned_to_idx;
alter table reports drop column if exists assigned_at, drop column if exists assigned_to;
SQL);
    }
};
