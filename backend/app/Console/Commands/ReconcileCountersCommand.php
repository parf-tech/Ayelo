<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Compare les compteurs dénormalisés à leur source et, avec --fix, les corrige :
 *  - `conversations.unread_a`, `unread_b`, `last_message_id` contre la table `messages` ;
 *  - `credit_balances` contre la somme de `credit_ledger`.
 * Des déclencheurs les tiennent à jour ; cette commande rattrape ce qu'ils ne voient pas (TRUNCATE, chargement avec déclencheurs
 * désactivés, intervention manuelle). Code de sortie 1 s'il reste un écart (sans --fix : détecté, rien changé).
 */
class ReconcileCountersCommand extends Command
{
    protected $signature = 'counters:reconcile {--fix : corriger les écarts}';

    protected $description = 'Détecte (et avec --fix corrige) les écarts entre les compteurs stockés et leur source';

    private const CONVERSATION_DRIFT = <<<'SQL'
select c.id from conversations c where
  c.unread_a <> (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> c.user_a and m.read_at is null and m.deleted_at is null)
  or c.unread_b <> (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> c.user_b and m.read_at is null and m.deleted_at is null)
  or c.last_message_id is distinct from (select m.id from messages m where m.conversation_id = c.id and m.deleted_at is null order by m.created_at desc, m.id desc limit 1)
SQL;

    private const CREDIT_DRIFT = <<<'SQL'
select coalesce(l.user_id, b.user_id) as user_id, coalesce(l.credit_type, b.credit_type) as credit_type, coalesce(l.total, 0) as total
from (select user_id, credit_type, sum(delta)::int as total from credit_ledger group by user_id, credit_type) l
full join credit_balances b on b.user_id = l.user_id and b.credit_type = l.credit_type
where coalesce(l.total, 0) <> coalesce(b.balance, 0)
SQL;

    public function handle(): int
    {
        $conversations = collect(DB::select(self::CONVERSATION_DRIFT))->pluck('id')->all();
        $credits = DB::select(self::CREDIT_DRIFT);

        if ($conversations === [] && $credits === []) {
            $this->info('Aucun écart.');

            return self::SUCCESS;
        }

        $this->warn('Écarts détectés');
        $this->line('  conversations : '.count($conversations));
        $this->line('  soldes de crédits : '.count($credits));

        if (! $this->option('fix')) {
            return self::FAILURE;
        }

        DB::transaction(function () use ($conversations, $credits) {
            foreach (array_chunk($conversations, 500) as $ids) {
                DB::table('conversations')->whereIn('id', $ids)->update([
                    'unread_a' => DB::raw('(select count(*) from messages m where m.conversation_id = conversations.id and m.sender_id <> conversations.user_a and m.read_at is null and m.deleted_at is null)'),
                    'unread_b' => DB::raw('(select count(*) from messages m where m.conversation_id = conversations.id and m.sender_id <> conversations.user_b and m.read_at is null and m.deleted_at is null)'),
                    'last_message_id' => DB::raw('(select m.id from messages m where m.conversation_id = conversations.id and m.deleted_at is null order by m.created_at desc, m.id desc limit 1)'),
                ]);
            }
            foreach ($credits as $row) {
                if ((int) $row->total === 0) {
                    DB::table('credit_balances')->where('user_id', $row->user_id)->where('credit_type', $row->credit_type)->delete();

                    continue;
                }
                DB::table('credit_balances')->updateOrInsert(['user_id' => $row->user_id, 'credit_type' => $row->credit_type], ['balance' => (int) $row->total, 'updated_at' => now()]);
            }
        });

        // Traces : un écart signifie qu'un déclencheur a été contourné ; à comprendre, pas seulement à corriger.
        Log::warning('Compteurs corrigés par counters:reconcile', ['conversations' => count($conversations), 'credit_balances' => count($credits)]);
        $this->info('Écarts corrigés : '.count($conversations).' conversation(s), '.count($credits).' solde(s).');

        return self::SUCCESS;
    }
}
