<?php

namespace App\Services;

use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;

/** Export des données personnelles d'un utilisateur au format JSON (FR-I-13, droit d'accès RGPD). */
class DataExport
{
    public const TTL_DAYS = 7;

    public function __construct(private MediaStorage $storage) {}

    public function build(string $exportId): void
    {
        $export = DB::table('data_exports')->where('id', $exportId)->first();
        if ($export === null || $export->status !== 'pending') {
            return;
        }

        $uid = $export->user_id;
        $rows = fn (string $table, array $columns, string $col = 'user_id') => DB::table($table)->where($col, $uid)->get($columns)->all();

        $payload = [
            'generated_at' => now()->toIso8601String(),
            'account' => DB::table('users')->where('id', $uid)->first(['id', 'email', 'phone', 'birthdate', 'locale', 'status', 'created_at', 'email_verified_at']),
            'profile' => DB::table('profiles')->where('user_id', $uid)->first(),
            'preferences' => DB::table('preferences')->where('user_id', $uid)->first(),
            'consents' => $rows('user_consents', ['kind', 'version', 'granted', 'created_at']),
            'media' => $rows('media', ['id', 'kind', 'status', 'mime_type', 'created_at']),
            'devices' => $rows('devices', ['platform', 'app_version', 'last_active_at', 'created_at']),
            'sent_messages' => DB::table('messages')->where('sender_id', $uid)->whereNull('deleted_at')->get(['conversation_id', 'type', 'body', 'created_at'])->all(),
            'swipes' => $rows('swipes', ['target_id', 'action', 'created_at'], 'swiper_id'),
            'blocks' => $rows('blocks', ['blocked_id', 'created_at'], 'blocker_id'),
            'reports_made' => $rows('reports', ['reported_id', 'reason', 'created_at'], 'reporter_id'),
            'sanctions' => $rows('sanctions', ['kind', 'reason', 'starts_at', 'ends_at']),
            'purchases' => $rows('purchases', ['product_id', 'price_cents', 'currency', 'status', 'created_at']),
            'credits' => $rows('credit_ledger', ['credit_type', 'delta', 'reason', 'created_at']),
        ];

        $key = 'exports/'.$uid.'/'.$exportId.'.json';
        $this->storage->put($key, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'application/json');

        DB::table('data_exports')->where('id', $exportId)->update([
            'status' => 'ready', 'storage_key' => $key, 'expires_at' => now()->addDays(self::TTL_DAYS), 'updated_at' => now(),
        ]);
    }
}
