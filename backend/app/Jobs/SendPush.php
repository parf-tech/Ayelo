<?php

namespace App\Jobs;

use App\Services\Push\PushNotifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

/** Envoie une notification à tous les appareils d'un utilisateur, selon ses préférences. */
class SendPush implements ShouldQueue
{
    use Queueable;

    /**
     * @param  string  $kind  messages | matches | calls (colonne push_* de notification_prefs)
     * @param  array<string, string>  $data
     */
    public function __construct(public string $userId, public string $kind, public string $title, public string $body, public array $data = []) {}

    public function handle(PushNotifier $push): void
    {
        $prefs = DB::table('notification_prefs')->where('user_id', $this->userId)->first();
        $column = 'push_'.$this->kind;
        if ($prefs !== null && property_exists($prefs, $column) && ! $prefs->{$column}) {
            return;
        }

        $devices = DB::table('devices')->where('user_id', $this->userId)->whereNotNull('push_token')->get(['id', 'platform', 'push_token']);

        foreach ($devices as $device) {
            if (! $push->send($device->platform, $device->push_token, $this->title, $this->body, $this->data)) {
                // Jeton invalide ou désinstallé : on l'efface.
                DB::table('devices')->where('id', $device->id)->update(['push_token' => null, 'updated_at' => now()]);
            }
        }
    }
}
