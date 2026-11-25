<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Compteurs de non lus et dernier message stockés sur `conversations` (revue CTO 1, risque 9 : la liste des conversations
 * parcourait les messages pour chaque conversation).
 *
 *  - unread_a / unread_b : messages non lus et non supprimés envoyés par l'AUTRE personne (unread_a = ceux que `user_a` n'a pas lus) ;
 *  - last_message_id : dernier message non supprimé (ordre created_at desc, id desc), sans clé étrangère : le déclencheur le tient
 *    à jour et `counters:reconcile` rattrape un écart.
 *
 * Un déclencheur sur `messages` (insertion, lecture, suppression douce, rétablissement, suppression définitive) tient les trois
 * colonnes : aucun écrivain (envoi, accusé de lecture, anonymisation) ne peut les désynchroniser. La table `messages` reste la
 * source de vérité. La reprise recalcule tout depuis `messages` ; la migration est rejouable sans rien dupliquer. Sur une base déjà
 * volumineuse, la reprise est une seule transaction : à lancer hors pic.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
alter table conversations
  add column if not exists unread_a integer not null default 0,
  add column if not exists unread_b integer not null default 0,
  add column if not exists last_message_id uuid;

-- Ajoute (+1) ou retire (-1) un message non lu du compteur de la personne qui ne l'a pas écrit.
create or replace function conversation_unread_add(p_conv uuid, p_sender uuid, p_delta integer) returns void language sql as $fn$
  update conversations set
    unread_a = unread_a + case when p_sender <> user_a then p_delta else 0 end,
    unread_b = unread_b + case when p_sender <> user_b then p_delta else 0 end
  where id = p_conv;
$fn$;

-- Le message devient le dernier s'il est plus récent que l'actuel (ou si celui-ci a disparu).
create or replace function conversation_bump_last(p_conv uuid, p_id uuid, p_at timestamptz) returns void language sql as $fn$
  update conversations c set last_message_id = p_id
  where c.id = p_conv and (
    c.last_message_id is null
    or not exists (select 1 from messages m where m.id = c.last_message_id)
    or (p_at, p_id) > (select m.created_at, m.id from messages m where m.id = c.last_message_id)
  );
$fn$;

-- Recalcule le dernier message non supprimé (suppression du dernier message).
create or replace function conversation_refresh_last(p_conv uuid) returns void language sql as $fn$
  update conversations set last_message_id = (
    select m.id from messages m where m.conversation_id = p_conv and m.deleted_at is null order by m.created_at desc, m.id desc limit 1
  ) where id = p_conv;
$fn$;

create or replace function messages_counters_apply() returns trigger language plpgsql as $fn$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      if new.read_at is null then
        perform conversation_unread_add(new.conversation_id, new.sender_id, 1);
      end if;
      perform conversation_bump_last(new.conversation_id, new.id, new.created_at);
    end if;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      if old.read_at is null then
        perform conversation_unread_add(old.conversation_id, old.sender_id, -1);
      end if;
      if exists (select 1 from conversations where id = old.conversation_id and last_message_id = old.id) then
        perform conversation_refresh_last(old.conversation_id);
      end if;
    end if;
  else
    -- « Compté » = non supprimé et non lu : le compteur suit chaque changement de cet état.
    if (old.deleted_at is null and old.read_at is null) is distinct from (new.deleted_at is null and new.read_at is null) then
      if new.deleted_at is null and new.read_at is null then
        perform conversation_unread_add(new.conversation_id, new.sender_id, 1);
      else
        perform conversation_unread_add(old.conversation_id, old.sender_id, -1);
      end if;
    end if;
    if (old.deleted_at is null) is distinct from (new.deleted_at is null) then
      if new.deleted_at is null then
        perform conversation_bump_last(new.conversation_id, new.id, new.created_at);
      elsif exists (select 1 from conversations where id = new.conversation_id and last_message_id = new.id) then
        perform conversation_refresh_last(new.conversation_id);
      end if;
    end if;
  end if;
  return null;
end
$fn$;

drop trigger if exists messages_counters on messages;
create trigger messages_counters after insert or update of read_at, deleted_at or delete on messages
  for each row execute function messages_counters_apply();

-- Reprise : tout est recalculé depuis `messages`.
update conversations c set
  unread_a = (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> c.user_a and m.read_at is null and m.deleted_at is null),
  unread_b = (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> c.user_b and m.read_at is null and m.deleted_at is null),
  last_message_id = (select m.id from messages m where m.conversation_id = c.id and m.deleted_at is null order by m.created_at desc, m.id desc limit 1);
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
drop trigger if exists messages_counters on messages;
drop function if exists messages_counters_apply();
drop function if exists conversation_refresh_last(uuid);
drop function if exists conversation_bump_last(uuid, uuid, timestamptz);
drop function if exists conversation_unread_add(uuid, uuid, integer);
alter table conversations drop column if exists last_message_id, drop column if exists unread_b, drop column if exists unread_a;
SQL);
    }
};
