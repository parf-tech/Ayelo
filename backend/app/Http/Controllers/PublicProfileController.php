<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\ProfilePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PublicProfileController extends Controller
{
    public function show(Request $request, string $userId, ProfilePresenter $presenter): JsonResponse
    {
        $profile = Profile::where('user_id', $userId)->first();

        // Profil absent, masqué ou bloqué : même réponse 404 (on ne révèle ni l'existence ni le blocage).
        abort_if($profile === null || Gate::forUser($request->user())->denies('view', $profile), 404);

        return response()->json($presenter->public($profile));
    }
}
