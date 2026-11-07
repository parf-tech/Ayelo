<?php

namespace Database\Seeders;

use App\Models\Profile;
use App\Models\StaffUser;
use App\Models\User;
use App\Services\Admin\StaffAccounts;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Jeu de données fictif réaliste pour le développement et les démonstrations : 40 membres répartis sur plusieurs
 * pays, genres et intentions, quelques affinités, conversations, signalements, sanctions et abonnements Premium,
 * et un compte de personnel par rôle (créé par le service StaffAccounts).
 *
 * Garde-fous : refuse de s'exécuter en production ; toutes les adresses sont en `@example.test` (domaine réservé,
 * jamais routable) ; aucun mot de passe n'est écrit, affiché ni versionné (mots de passe aléatoires, jetés). Pour se
 * connecter à la console avec un compte de personnel fictif, en définir un vrai avec `php artisan staff:create`.
 * Idempotent : ne fait rien si le jeu existe déjà.
 */
class DemoDataSeeder extends Seeder
{
    public const MEMBER_COUNT = 40;

    private const COUNTRIES = ['FR', 'BE', 'CH', 'CA', 'GB', 'SN', 'CI', 'CM', 'MA', 'DZ', 'TN', 'HT'];

    private const GENDERS = ['woman', 'man', 'other'];

    private const INTENTS = ['marriage', 'long_lasting_love', 'flirt', 'friendship', 'lets_find_out'];

    private const CITIES = ['Paris', 'Bruxelles', 'Genève', 'Montréal', 'Londres', 'Dakar', 'Abidjan', 'Douala', 'Casablanca', 'Alger', 'Tunis', 'Port-au-Prince'];

    private const NAMES = ['Aminata', 'Karim', 'Léa', 'Yanis', 'Fatou', 'Mehdi', 'Chloé', 'Ibrahim', 'Inès', 'Samir', 'Awa', 'Nadia', 'Moussa', 'Camille', 'Sofiane', 'Mariam',
        'Rayan', 'Salma', 'Omar', 'Jade', 'Idriss', 'Lina', 'Bilal', 'Nora', 'Cheikh', 'Sarah', 'Amine', 'Khadija', 'Louis', 'Zineb', 'Malik', 'Emma',
        'Youssef', 'Aïcha', 'Hugo', 'Maëlle', 'Tarik', 'Binta', 'Noah', 'Dina'];

    private const MESSAGES = ['Salut, comment vas-tu ?', 'Très bien, merci ! Et toi ?', "Ton profil m'a fait sourire.", "Tu viens d'où exactement ?",
        "On pourrait s'appeler ce week-end.", 'Avec plaisir, dis-moi quand tu es disponible.', 'Quel est ton plat préféré ?', 'Le mafé, sans hésiter !'];

    public function run(StaffAccounts $staffAccounts): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Le jeu de données fictif ne peut pas être chargé en production.');
        }

        if (User::where('email', $this->email(1))->exists()) {
            $this->command?->info('Jeu de données fictif déjà présent : rien à faire.');

            return;
        }

        DB::transaction(function () use ($staffAccounts) {
            $staff = $this->staff($staffAccounts);
            $users = $this->members();
            $this->swipesMatchesConversations($users);
            $this->reportsAndSanctions($users, $staff[StaffUser::ROLE_MODERATOR]);
            $this->premium($users, $staff[StaffUser::ROLE_ADMIN]);
        });

        $this->command?->info('Jeu de données fictif chargé ('.self::MEMBER_COUNT.' membres, 3 comptes de personnel @example.test).');
    }

    private function email(int $n): string
    {
        return sprintf('demo%02d@example.test', $n);
    }

    /** @return array<string, StaffUser> un compte par rôle ; mot de passe aléatoire jamais affiché. */
    private function staff(StaffAccounts $staffAccounts): array
    {
        $out = [];
        foreach (StaffUser::ROLES as $role) {
            $out[$role] = $staffAccounts->create("demo-{$role}@example.test", $role, $staffAccounts->generatePassword());
        }

        return $out;
    }

    /** @return list<User> */
    private function members(): array
    {
        // Un seul condensat pour tous : mot de passe aléatoire jeté, aucun compte fictif n'est utilisable pour se connecter.
        $hash = Hash::make(Str::random(40));
        $users = [];

        for ($i = 1; $i <= self::MEMBER_COUNT; $i++) {
            $origin = self::COUNTRIES[($i - 1) % count(self::COUNTRIES)];
            $residenceIndex = ($i * 5 + 2) % count(self::COUNTRIES);
            $residence = self::COUNTRIES[$residenceIndex];
            $gender = self::GENDERS[$i % 10 === 0 ? 2 : $i % 2];
            $intent = self::INTENTS[($i - 1) % count(self::INTENTS)];

            $user = User::create([
                'email' => $this->email($i),
                'password' => $hash,
                'birthdate' => now()->subYears(19 + ($i * 7) % 40)->subDays($i * 11 % 300)->toDateString(),
                'locale' => $i % 4 === 0 ? 'en' : 'fr',
            ]);
            $user->forceFill(['email_verified_at' => now(), 'last_seen_at' => now()->subMinutes($i * 37)])->save();

            Profile::create([
                'user_id' => $user->id,
                'display_name' => self::NAMES[$i - 1],
                'gender' => $gender,
                'origin_country' => $origin,
                'residence_country' => $residence,
                'city' => self::CITIES[$residenceIndex],
                'bio' => $i % 3 === 0 ? null : 'Profil fictif de démonstration n°'.$i.'.',
                'intent' => $intent,
                'is_visible' => $i % 13 !== 0,
            ]);
            DB::table('profiles')->where('user_id', $user->id)->update(['verification_status' => ['none', 'verified', 'none', 'pending'][$i % 4]]);

            DB::table('preferences')->insert([
                'user_id' => $user->id,
                'seeking_genders' => '{'.($gender === 'woman' ? 'man' : 'woman').'}',
                'age_min' => 18,
                'age_max' => 60,
                'countries' => '{'.$residence.'}',
                'origins' => '{'.$origin.'}',
                'intents' => '{'.$intent.'}',
                'verified_only' => false,
            ]);
            DB::table('notification_prefs')->insert(['user_id' => $user->id]);
            foreach (['terms', 'privacy'] as $kind) {
                DB::table('user_consents')->insert(['id' => (string) Str::uuid(), 'user_id' => $user->id, 'kind' => $kind, 'version' => 'demo', 'granted' => true]);
            }

            $users[] = $user;
        }

        return $users;
    }

    /** @param  list<User>  $users */
    private function swipesMatchesConversations(array $users): void
    {
        // Paires (1,2), (3,4)... : affinité réciproque, match actif, conversation avec quelques messages.
        for ($i = 0; $i + 1 < 24; $i += 2) {
            [$a, $b] = [$users[$i]->id, $users[$i + 1]->id];
            foreach ([[$a, $b], [$b, $a]] as [$from, $to]) {
                DB::table('swipes')->insert(['id' => (string) Str::uuid(), 'swiper_id' => $from, 'target_id' => $to, 'action' => 'like']);
            }

            [$low, $high] = strcmp($a, $b) < 0 ? [$a, $b] : [$b, $a];
            $matchId = (string) Str::uuid();
            DB::table('matches')->insert(['id' => $matchId, 'user_a' => $low, 'user_b' => $high, 'status' => 'active']);

            // Les affinités récentes (fin de liste) n'ont pas encore de conversation.
            if ($i < 18) {
                $conversationId = (string) Str::uuid();
                $count = 2 + ($i % 5);
                DB::table('conversations')->insert([
                    'id' => $conversationId, 'user_a' => $low, 'user_b' => $high, 'match_id' => $matchId, 'initiated_by' => $a,
                    'unlocked_by' => 'match', 'last_message_at' => now()->subMinutes(5),
                ]);
                for ($m = 0; $m < $count; $m++) {
                    DB::table('messages')->insert([
                        'id' => (string) Str::uuid(), 'conversation_id' => $conversationId, 'sender_id' => $m % 2 === 0 ? $a : $b,
                        'client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => self::MESSAGES[$m % count(self::MESSAGES)],
                        'delivered_at' => now()->subMinutes(30 - $m), 'read_at' => $m < $count - 1 ? now()->subMinutes(20 - $m) : null,
                        'created_at' => now()->subMinutes(40 - $m),
                    ]);
                }
            }
        }

        // Quelques appréciations à sens unique et des refus.
        for ($i = 24; $i < 34; $i++) {
            DB::table('swipes')->insert(['id' => (string) Str::uuid(), 'swiper_id' => $users[$i]->id, 'target_id' => $users[($i + 3) % 24]->id, 'action' => $i % 5 === 0 ? 'dislike' : 'like']);
        }

        // Un blocage.
        DB::table('blocks')->insert(['id' => (string) Str::uuid(), 'blocker_id' => $users[35]->id, 'blocked_id' => $users[36]->id]);
    }

    /** @param  list<User>  $users */
    private function reportsAndSanctions(array $users, StaffUser $moderator): void
    {
        // Signalement ouvert, avertissement après examen, suspension à durée limitée, signalement rejeté.
        DB::table('reports')->insert(['id' => (string) Str::uuid(), 'reporter_id' => $users[30]->id, 'reported_id' => $users[31]->id, 'reason' => 'fake_or_spam',
            'details' => 'Signalement fictif.', 'priority' => 0]);

        $warned = (string) Str::uuid();
        DB::table('reports')->insert(['id' => $warned, 'reporter_id' => $users[32]->id, 'reported_id' => $users[33]->id, 'reason' => 'harassment', 'priority' => 1,
            'status' => 'actioned', 'outcome' => 'warning', 'reviewed_by' => $moderator->id, 'reviewed_at' => now()->subDay()]);
        DB::table('sanctions')->insert(['id' => (string) Str::uuid(), 'user_id' => $users[33]->id, 'kind' => 'warning', 'reason' => 'Propos déplacés (donnée fictive).',
            'report_id' => $warned, 'created_by' => $moderator->id]);

        $suspended = (string) Str::uuid();
        DB::table('reports')->insert(['id' => $suspended, 'reporter_id' => $users[37]->id, 'reported_id' => $users[38]->id, 'reason' => 'money_request', 'priority' => 2,
            'status' => 'actioned', 'outcome' => 'suspension', 'reviewed_by' => $moderator->id, 'reviewed_at' => now()->subHours(2)]);
        DB::table('sanctions')->insert(['id' => (string) Str::uuid(), 'user_id' => $users[38]->id, 'kind' => 'suspension', 'reason' => "Demande d'argent (donnée fictive).",
            'report_id' => $suspended, 'starts_at' => now()->subHours(2), 'ends_at' => now()->addDays(7), 'created_by' => $moderator->id]);
        DB::table('users')->where('id', $users[38]->id)->update(['status' => 'suspended']);

        DB::table('reports')->insert(['id' => (string) Str::uuid(), 'reporter_id' => $users[34]->id, 'reported_id' => $users[39]->id, 'reason' => 'other', 'status' => 'dismissed',
            'outcome' => 'none', 'reviewed_by' => $moderator->id, 'reviewed_at' => now()->subDays(2)]);
    }

    /** @param  list<User>  $users */
    private function premium(array $users, StaffUser $admin): void
    {
        $subs = [
            [0, 'apple', 'premium_1m', 'active', now()->subDays(10), now()->addDays(20)],
            [1, 'google', 'premium_3m', 'active', now()->subDays(30), now()->addDays(60)],
            [2, 'apple', 'premium_12m', 'cancelled', now()->subMonths(2), now()->addMonths(10)],
            [3, 'google', 'premium_1m', 'expired', now()->subMonths(3), now()->subMonths(2)],
        ];
        foreach ($subs as $n => [$i, $store, $product, $status, $start, $end]) {
            DB::table('subscriptions')->insert([
                'id' => (string) Str::uuid(), 'user_id' => $users[$i]->id, 'store' => $store, 'product_id' => $product, 'status' => $status,
                'period_start' => $start, 'period_end' => $end, 'original_transaction_id' => 'demo-otx-'.($n + 1),
            ]);
        }

        // Premium offert par l'administration (sans transaction de boutique, comme l'impose le schéma).
        DB::table('subscriptions')->insert(['id' => (string) Str::uuid(), 'user_id' => $users[4]->id, 'store' => 'promotional', 'product_id' => 'premium_1m',
            'status' => 'active', 'period_start' => now(), 'period_end' => now()->addMonth(), 'granted_by' => $admin->id]);

        // Un pack de crédits acheté, avec son écriture au registre.
        DB::table('purchases')->insert(['id' => (string) Str::uuid(), 'user_id' => $users[5]->id, 'store' => 'apple', 'product_id' => 'conversation_5',
            'price_cents' => 499, 'currency' => 'EUR', 'transaction_id' => 'demo-tx-1', 'status' => 'completed']);
        DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $users[5]->id, 'credit_type' => 'conversation', 'delta' => 5,
            'reason' => 'purchase', 'ref_type' => 'purchase', 'idempotency_key' => 'purchase:demo-tx-1']);
    }
}
