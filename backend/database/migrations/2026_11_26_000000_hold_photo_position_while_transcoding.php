<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Ré-encodage des photos de profil hors de la requête : une photo « transcoding » garde sa position. Sans cela, l'index unique
 * ne la comptait plus, et le passage en « processing » pouvait heurter une photo déposée entre-temps à la même place.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
drop index if exists media_photo_position_unique;
create unique index media_photo_position_unique on media (user_id, position)
  where kind = 'profile_photo' and status in ('pending_upload','transcoding','processing','approved');
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
update media set status = 'processing' where status = 'transcoding' and kind = 'profile_photo';
drop index if exists media_photo_position_unique;
create unique index media_photo_position_unique on media (user_id, position)
  where kind = 'profile_photo' and status in ('pending_upload','processing','approved');
SQL);
    }
};
