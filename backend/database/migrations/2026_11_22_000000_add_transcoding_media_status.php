<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Notes vocales et vidéos de conversation : entre la fin du dépôt et la revue humaine, le média est « transcoding » (réencodé
 * sans métadonnées par le conteneur `transcode`). Il n'est ni listé en modération ni servi tant qu'il est dans cet état.
 * L'API le présente comme « processing » (le client n'a pas à connaître l'étape interne).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
alter table media drop constraint if exists media_status_check;
alter table media add constraint media_status_check
  check (status in ('pending_upload','transcoding','processing','approved','rejected','purged'));
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
update media set status = 'processing' where status = 'transcoding';
alter table media drop constraint if exists media_status_check;
alter table media add constraint media_status_check
  check (status in ('pending_upload','processing','approved','rejected','purged'));
SQL);
    }
};
