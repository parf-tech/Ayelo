<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class DeviceController extends Controller
{
    /** Enregistre les jetons de notification de l'appareil courant. */
    public function update(Request $request): Response
    {
        $data = $request->validate([
            'push_token' => ['nullable', 'string', 'max:500'],
            'voip_push_token' => ['nullable', 'string', 'max:500'],
            'app_version' => ['nullable', 'string', 'max:32'],
        ]);
        $tokenId = $request->user()->currentAccessToken()->getKey();

        DB::transaction(function () use ($data, $tokenId, $request) {
            // Un jeton push est unique : s'il change de compte, il est réaffecté (upsert).
            if (! empty($data['push_token'])) {
                DB::table('devices')->where('push_token', $data['push_token'])->where('token_id', '<>', $tokenId)->update(['push_token' => null]);
            }

            DB::table('devices')->where('token_id', $tokenId)->where('user_id', $request->user()->id)->update(array_merge(
                array_filter(['push_token' => $data['push_token'] ?? null, 'voip_push_token' => $data['voip_push_token'] ?? null, 'app_version' => $data['app_version'] ?? null], fn ($v) => $v !== null),
                ['last_active_at' => now(), 'updated_at' => now()]
            ));
        });

        return response()->noContent();
    }

    public function notifications(Request $request)
    {
        $me = $request->user()->id;

        if ($request->isMethod('GET')) {
            return response()->json(DB::table('notification_prefs')->where('user_id', $me)->first(['push_messages', 'push_matches', 'push_calls', 'push_marketing', 'email_marketing']));
        }

        $data = $request->validate(collect(['push_messages', 'push_matches', 'push_calls', 'push_marketing', 'email_marketing'])
            ->mapWithKeys(fn ($k) => [$k => ['sometimes', 'boolean']])->all());
        DB::table('notification_prefs')->where('user_id', $me)->update($data + ['updated_at' => now()]);

        return response()->json(DB::table('notification_prefs')->where('user_id', $me)->first(['push_messages', 'push_matches', 'push_calls', 'push_marketing', 'email_marketing']));
    }
}
