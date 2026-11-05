<?php

namespace App\Http\Controllers;

use App\Services\Conversations;
use App\Services\Premium;
use App\Services\RevenueCatProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BillingController extends Controller
{
    /** Webhook RevenueCat : authentifié par secret partagé, idempotent, répond 200 même pour un doublon. */
    public function webhook(Request $request, RevenueCatProcessor $processor): JsonResponse
    {
        $secret = (string) config('billing.webhook_secret');
        $given = (string) $request->header('Authorization', '');

        if ($secret === '' || ! hash_equals('Bearer '.$secret, $given) && ! hash_equals($secret, $given)) {
            return response()->json(['error' => ['code' => 'unauthorized', 'message' => 'Non autorisé.']], 401);
        }

        return response()->json(['result' => $processor->handle($request->all())]);
    }

    public function offers(): JsonResponse
    {
        return response()->json([
            'subscriptions' => collect(config('billing.subscriptions'))->map(fn ($v, $id) => ['product_id' => $id, 'months' => $v['months']])->values(),
            'packs' => collect(config('billing.packs'))->map(fn ($v, $id) => ['product_id' => $id, 'type' => $v['type'], 'credits' => $v['credits']])->values(),
        ]);
    }

    public function status(Request $request, Conversations $conversations): JsonResponse
    {
        $me = $request->user()->id;
        $sub = DB::table('subscriptions')->where('user_id', $me)->orderByDesc('period_end')->first(['product_id', 'status', 'period_end', 'store']);

        return response()->json([
            'premium' => Premium::active($me),
            'subscription' => $sub,
            'credits' => ['conversation' => $conversations->creditBalance($me)],
        ]);
    }

    /** L'état est calculé par le serveur à partir des webhooks ; l'application ne peut pas l'imposer. */
    public function sync(Request $request, Conversations $conversations): JsonResponse
    {
        return $this->status($request, $conversations);
    }

    public function transactions(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        return response()->json(['data' => DB::table('purchases')->where('user_id', $me)->orderByDesc('created_at')->limit(100)
            ->get(['id', 'product_id', 'price_cents', 'currency', 'status', 'created_at'])]);
    }
}
