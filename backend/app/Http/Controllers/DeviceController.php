<?php

namespace App\Http\Controllers;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class DeviceController extends Controller
{
    /** Enregistre les jetons de notification de l'appareil courant. */
    public function update(Request $request): Response|JsonResponse
    {
        $data = $request->validate([
            'push_token' => ['nullable', 'string', 'max:500'],
            'voip_push_token' => ['nullable', 'string', 'max:500'],
            'app_version' => ['nullable', 'string', 'max:32'],
        ]);
        $tokenId = $request->user()->currentAccessToken()->getKey();
        $me = $request->user()->id;

        $device = DB::table('devices')->where('token_id', $tokenId)->where('user_id', $me)->first();
        if ($device === null) {
            return response()->noContent();
        }

        try {
            $conflict = DB::transaction(function () use ($data, $device, $me) {
                if (! empty($data['push_token'])) {
                    // Un jeton push est unique. Il ne change de propriétaire que si l'ancien porteur est le même appareil
                    // physique (même empreinte d'installation X-Device-Id : déconnexion puis autre compte sur le même
                    // téléphone) ou le même compte. Connaître un jeton ne suffit plus à le prendre à un autre compte
                    // (revue F-28) : sinon un attaquant recevrait les notifications de la victime.
                    // Verrous pris dans l'ordre des identifiants, ligne de l'appareil courant comprise : deux appareils qui
                    // s'échangent un jeton ne s'interbloquent pas ; un interblocage résiduel est rejoué (3 essais).
                    $holders = DB::table('devices')->where(fn ($q) => $q->where('push_token', $data['push_token'])->orWhere('id', $device->id))
                        ->orderBy('id')->lockForUpdate()->get(['id', 'user_id', 'device_fingerprint_hash'])
                        ->reject(fn ($row) => $row->id === $device->id)->values();
                    foreach ($holders as $holder) {
                        $sameDevice = $holder->device_fingerprint_hash !== null && $holder->device_fingerprint_hash === $device->device_fingerprint_hash;
                        if ($holder->user_id !== $me && ! $sameDevice) {
                            return true;
                        }
                    }
                    DB::table('devices')->whereIn('id', $holders->pluck('id'))->update(['push_token' => null, 'updated_at' => now()]);
                }

                DB::table('devices')->where('id', $device->id)->update(array_merge(
                    array_filter(['push_token' => $data['push_token'] ?? null, 'voip_push_token' => $data['voip_push_token'] ?? null, 'app_version' => $data['app_version'] ?? null], fn ($v) => $v !== null),
                    ['last_active_at' => now(), 'updated_at' => now()]
                ));

                return false;
            }, 3);
        } catch (UniqueConstraintViolationException) {
            $conflict = true;
        }

        if ($conflict) {
            return response()->json(['error' => ['code' => 'push_token_in_use', 'message' => 'Ce jeton de notification est déjà utilisé par un autre compte.']], 409);
        }

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
