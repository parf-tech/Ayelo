<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Revue F-06 (résiduel) : la date de naissance complète restait sur la ligne anonymisée. Le déclencheur d'origine
 * (docs/schema/001_initial.sql) interdit tout changement ; on autorise UNIQUEMENT le passage d'un compte à « deleted »
 * avec une date ramenée au 1er janvier de la même année (la contrainte « 18 ans » reste vraie).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
create or replace function lock_birthdate() returns trigger language plpgsql as $$
begin
  if new.birthdate is distinct from old.birthdate then
    if new.status = 'deleted' and old.status is distinct from 'deleted'
       and new.birthdate = date_trunc('year', old.birthdate)::date then
      return new;
    end if;
    raise exception 'birthdate cannot be changed';
  end if;
  return new;
end $$;
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
create or replace function lock_birthdate() returns trigger language plpgsql as $$
begin
  if new.birthdate is distinct from old.birthdate then
    raise exception 'birthdate cannot be changed';
  end if;
  return new;
end $$;
SQL);
    }
};
