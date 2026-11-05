<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AgeGate;
use App\Support\DeviceId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgeCheckController extends Controller
{
    public function __invoke(Request $request, AgeGate $gate): JsonResponse
    {
        $device = DeviceId::from($request);
        $data = $request->validate(['birthdate' => ['required', 'date_format:Y-m-d', 'before:today', 'after:1900-01-01']]);

        // Refus déjà mémorisé pour cet appareil : on ne réévalue pas une autre date (FR-I-12).
        if ($gate->isRefused($device)) {
            return $this->refusal();
        }

        if (! $gate->isAdult($data['birthdate'])) {
            $gate->remember($device);

            return $this->refusal();
        }

        return response()->json([
            'age_token' => $gate->issueToken($data['birthdate'], $device),
            'expires_in' => AgeGate::TOKEN_TTL_MINUTES * 60,
        ]);
    }

    private function refusal(): JsonResponse
    {
        // Message neutre : on n'indique pas l'âge limite exact.
        return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
    }
}
