<?php

namespace Database\Seeders;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Jeu de données de l'aperçu local (docs/runbooks/apercu-local.md) : un membre actif connectable, `apercu@example.test`,
 * entouré des membres fictifs de DemoDataSeeder, avec 2 affinités et 3 conversations.
 *
 * Garde-fous : refuse de s'exécuter hors APP_ENV=local. Le mot de passe du membre vient de PREVIEW_PASSWORD (12 caractères
 * au moins), jamais du dépôt. Aucune vraie photo : les lignes `media` pointent vers des illustrations SVG générées
 * (initiales sur fond de couleur) écrites dans PREVIEW_MEDIA_DIR, que le script d'aperçu sert en local. Sans
 * PREVIEW_MEDIA_DIR, les lignes `media` existent mais leurs adresses ne mènent à rien (la découverte exige une photo approuvée).
 * Idempotent : un second lancement ne recrée rien.
 */
class PreviewSeeder extends Seeder
{
    public const EMAIL = 'apercu@example.test';

    /** Les six membres fictifs mis en avant : demo01 à demo06. Affinités avec les deux premiers, conversations avec les trois premiers. */
    private const FEATURED = 6;

    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException("Le jeu de données d'aperçu ne peut être chargé qu'avec APP_ENV=local.");
        }

        $password = (string) env('PREVIEW_PASSWORD', '');
        if (strlen($password) < 12) {
            throw new RuntimeException('PREVIEW_PASSWORD (12 caractères au moins) est obligatoire : définissez-le dans l\'environnement, il n\'est jamais écrit dans le dépôt.');
        }

        $this->call(DemoDataSeeder::class);

        if (! User::where('email', self::EMAIL)->exists()) {
            DB::transaction(fn () => $this->seed($password));
            $this->command?->info("Membre d'aperçu créé : ".self::EMAIL);
        } else {
            $this->command?->info("Membre d'aperçu déjà présent : rien à recréer.");
        }

        $this->writeMediaFiles();
    }

    private function seed(string $password): void
    {
        $me = User::create([
            'email' => self::EMAIL,
            'password' => $password,
            'birthdate' => now()->subYears(29)->subDays(40)->toDateString(),
            'locale' => 'fr',
        ]);
        $me->forceFill(['email_verified_at' => now(), 'last_seen_at' => now()])->save();

        Profile::create([
            'user_id' => $me->id,
            'display_name' => 'Aperçu',
            'gender' => 'woman',
            'origin_country' => 'SN',
            'residence_country' => 'FR',
            'city' => 'Paris',
            'bio' => "Profil fictif de l'aperçu local. J'aime la cuisine, les longues marches et les bonnes conversations.",
            'intent' => 'long_lasting_love',
            'is_visible' => true,
        ]);
        DB::table('profiles')->where('user_id', $me->id)->update(['verification_status' => 'verified']);

        // Préférences larges : la découverte montre tous les membres fictifs qui ont une photo.
        DB::table('preferences')->insert([
            'user_id' => $me->id,
            'seeking_genders' => '{man,woman,other}',
            'age_min' => 18,
            'age_max' => 70,
            'countries' => '{}',
            'origins' => '{}',
            'intents' => '{}',
            'verified_only' => false,
        ]);
        DB::table('notification_prefs')->insert(['user_id' => $me->id]);
        foreach (['terms', 'privacy'] as $kind) {
            DB::table('user_consents')->insert(['id' => (string) Str::uuid(), 'user_id' => $me->id, 'kind' => $kind, 'version' => 'preview', 'granted' => true]);
        }

        // Trois photos approuvées (SVG générés, voir writeMediaFiles).
        foreach ([0, 1, 2] as $position) {
            $this->photo($me->id, $position);
        }

        // Un peu de crédit pour que les écrans de solde ne soient pas vides.
        DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $me->id, 'credit_type' => 'conversation', 'delta' => 3,
            'reason' => 'promo', 'idempotency_key' => 'preview:welcome-conversation', 'note' => 'Aperçu local']);

        $partners = User::where('email', 'like', 'demo0_@example.test')->orderBy('email')->limit(self::FEATURED)->get()->values();
        if ($partners->count() < self::FEATURED) {
            throw new RuntimeException('Les membres fictifs demo01 à demo06 sont introuvables.');
        }

        // Deux affinités réciproques (demo01, demo02) : la première avec conversation active, la seconde aussi.
        foreach ([0, 1] as $i) {
            $this->match($me, $partners[$i]);
        }

        // Trois conversations : deux issues d'une affinité, une ouverte par demo03 avec un crédit (sans affinité).
        $this->conversation($me, $partners[0], true, [
            [false, 'Salut ! Ton profil m\'a fait sourire.', 95],
            [true, 'Merci, le tien aussi. Tu viens d\'où exactement ?', 90],
            [false, 'De Dakar, et toi ?', 60],
            [false, 'On pourrait s\'appeler ce week-end.', 5],
        ]);
        $this->conversation($me, $partners[1], true, [
            [true, 'Bonjour, comment vas-tu ?', 300],
            [false, 'Très bien, merci ! Quel est ton plat préféré ?', 240],
        ]);
        $this->conversation($me, $partners[2], false, [
            [false, 'Bonsoir, enchanté(e). Avec plaisir de faire connaissance.', 20],
        ], $partners[2]->id);
    }

    private function photo(string $userId, int $position): void
    {
        $id = (string) Str::uuid();
        DB::table('media')->insert([
            'id' => $id, 'user_id' => $userId, 'kind' => 'profile_photo', 'status' => 'approved',
            'storage_key' => "u/preview/{$userId}/{$position}.svg", 'mime_type' => 'image/svg+xml', 'size_bytes' => 1024, 'position' => $position,
        ]);
    }

    private function match(User $me, User $other): void
    {
        foreach ([[$me->id, $other->id], [$other->id, $me->id]] as [$from, $to]) {
            DB::table('swipes')->insertOrIgnore(['id' => (string) Str::uuid(), 'swiper_id' => $from, 'target_id' => $to, 'action' => 'like']);
        }

        [$low, $high] = strcmp($me->id, $other->id) < 0 ? [$me->id, $other->id] : [$other->id, $me->id];
        DB::table('matches')->insert(['id' => (string) Str::uuid(), 'user_a' => $low, 'user_b' => $high, 'status' => 'active']);
    }

    /**
     * @param  list<array{0: bool, 1: string, 2: int}>  $messages  [envoyé par le membre d'aperçu ?, texte, il y a N minutes]
     */
    private function conversation(User $me, User $other, bool $matched, array $messages, ?string $initiatedBy = null): void
    {
        [$low, $high] = strcmp($me->id, $other->id) < 0 ? [$me->id, $other->id] : [$other->id, $me->id];
        $matchId = $matched ? DB::table('matches')->where('user_a', $low)->where('user_b', $high)->value('id') : null;
        $id = (string) Str::uuid();

        DB::table('conversations')->insert([
            'id' => $id, 'user_a' => $low, 'user_b' => $high, 'match_id' => $matchId, 'initiated_by' => $initiatedBy ?? $me->id,
            'unlocked_by' => $matched ? 'match' : 'credit', 'last_message_at' => now()->subMinutes(end($messages)[2]),
        ]);

        foreach ($messages as $n => [$mine, $body, $minutesAgo]) {
            $last = $n === count($messages) - 1;
            DB::table('messages')->insert([
                'id' => (string) Str::uuid(), 'conversation_id' => $id, 'sender_id' => $mine ? $me->id : $other->id,
                'client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => $body,
                'delivered_at' => now()->subMinutes($minutesAgo), 'read_at' => $mine || ! $last ? now()->subMinutes($minutesAgo - 1) : null,
                'created_at' => now()->subMinutes($minutesAgo),
            ]);
        }
    }

    /** Photos de remplissage pour les membres fictifs (la découverte exige une photo approuvée) et fichiers SVG de toutes les photos. */
    private function writeMediaFiles(): void
    {
        // Une photo par membre fictif visible, trois pour les six mis en avant.
        $demoIds = DB::table('users')->where('email', 'like', 'demo__@example.test')->orderBy('email')->pluck('id')->all();
        foreach ($demoIds as $index => $userId) {
            $wanted = $index < self::FEATURED ? 3 : 1;
            for ($position = 0; $position < $wanted; $position++) {
                $exists = DB::table('media')->where('user_id', $userId)->where('kind', 'profile_photo')->where('position', $position)->exists();
                if (! $exists) {
                    $this->photo($userId, $position);
                }
            }
        }

        $dir = (string) env('PREVIEW_MEDIA_DIR', '');
        if ($dir === '') {
            return;
        }

        $bucket = trim((string) env('MEDIA_BUCKET', 'media'), '/');
        $rows = DB::table('media')->join('profiles', 'profiles.user_id', '=', 'media.user_id')
            ->where('media.storage_key', 'like', 'u/preview/%')
            ->get(['media.storage_key', 'media.position', 'profiles.display_name']);

        foreach ($rows as $row) {
            $path = $dir.DIRECTORY_SEPARATOR.$bucket.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $row->storage_key);
            if (! is_dir(dirname($path))) {
                mkdir(dirname($path), 0777, true);
            }
            file_put_contents($path, $this->svg((string) $row->display_name, (string) $row->storage_key, (int) $row->position));
        }
    }

    private function svg(string $name, string $seed, int $position): string
    {
        $hue = (crc32($seed) % 360);
        $initial = htmlspecialchars(mb_strtoupper(mb_substr($name, 0, 1)), ENT_XML1);

        return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <rect width="600" height="800" fill="hsl({$hue}, 45%, 62%)"/>
  <circle cx="300" cy="330" r="150" fill="hsl({$hue}, 45%, 72%)"/>
  <text x="300" y="380" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="700" text-anchor="middle" fill="#ffffff">{$initial}</text>
  <text x="300" y="700" font-family="Arial, Helvetica, sans-serif" font-size="34" text-anchor="middle" fill="#ffffff" fill-opacity="0.85">Aperçu - photo fictive {$position}</text>
</svg>
SVG;
    }
}
