<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Soldes de crédits (revue CTO 1 : GET /me additionnait tout le registre à chaque démarrage de l'application).
 *
 * `credit_balances` est tenue à jour par un déclencheur sur `credit_ledger` : le registre reste la source de vérité (ajout
 * seulement) et aucun écrivain (achat, dépense, ajustement administrateur) ne peut désynchroniser le solde. L'insertion de la ligne
 * de solde est un « upsert » : deux écritures simultanées pour un même compte se sérialisent sur cette ligne. La reprise des
 * comptes existants recalcule les soldes depuis le registre ; la migration est rejouable sans rien dupliquer.
 *
 * Un TRUNCATE du registre ou un chargement avec déclencheurs désactivés ne passent pas par le déclencheur : `counters:reconcile`
 * détecte et corrige l'écart.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
create table if not exists credit_balances (
  user_id uuid not null references users(id) on delete cascade,
  credit_type text not null check (credit_type in ('conversation','proposal','coin')),
  balance integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, credit_type)
);

create or replace function credit_balances_apply() returns trigger language plpgsql as $fn$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update credit_balances set balance = balance - old.delta, updated_at = now() where user_id = old.user_id and credit_type = old.credit_type;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into credit_balances (user_id, credit_type, balance, updated_at) values (new.user_id, new.credit_type, new.delta, now())
    on conflict (user_id, credit_type) do update set balance = credit_balances.balance + excluded.balance, updated_at = now();
  end if;
  return null;
end
$fn$;

drop trigger if exists credit_ledger_balance on credit_ledger;
create trigger credit_ledger_balance after insert or update of user_id, credit_type, delta or delete on credit_ledger
  for each row execute function credit_balances_apply();

-- Reprise : solde recalculé depuis le registre (remplace une valeur éventuelle), puis nettoyage des soldes sans registre.
insert into credit_balances (user_id, credit_type, balance, updated_at)
select user_id, credit_type, sum(delta)::int, now() from credit_ledger group by user_id, credit_type
on conflict (user_id, credit_type) do update set balance = excluded.balance, updated_at = now();
delete from credit_balances b where not exists (select 1 from credit_ledger l where l.user_id = b.user_id and l.credit_type = b.credit_type);
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
drop trigger if exists credit_ledger_balance on credit_ledger;
drop function if exists credit_balances_apply();
drop table if exists credit_balances;
SQL);
    }
};
