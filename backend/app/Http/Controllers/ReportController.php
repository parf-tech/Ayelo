<?php

namespace App\Http\Controllers;

use App\Services\Calls;
use App\Services\ReporterCredibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    private const REASONS = ['money_request', 'harassment', 'meeting_behavior', 'fake_or_spam', 'minor_suspected', 'other'];

    /** Seuil de signalements distincts sur 7 jours qui déclenche une revue prioritaire (docs/11). */
    private const MANY_REPORTS = 3;

    public function store(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        $data = $request->validate([
            'reported_id' => ['required', 'uuid', 'exists:users,id'],
            'reason' => ['required', Rule::in(self::REASONS)],
            'details' => ['nullable', 'string', 'max:1000'],
            'context_type' => ['nullable', Rule::in(['profile', 'conversation', 'message', 'call', 'story'])],
            'context_id' => ['nullable', 'uuid'],
        ]);
        abort_if($data['reported_id'] === $me, 422, 'Action impossible.');
        $this->assertContext($data, $me);

        // Quota anti-abus : 20 signalements par jour et par compte.
        $today = DB::table('reports')->where('reporter_id', $me)->where('created_at', '>=', now()->startOfDay())->count();
        if ($today >= 20) {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Trop de signalements aujourd\'hui.']], 429);
        }

        // Un même signalement (mêmes personnes, même motif) en cours n'est pas dupliqué.
        $duplicate = DB::table('reports')->where(['reporter_id' => $me, 'reported_id' => $data['reported_id'], 'reason' => $data['reason']])
            ->whereIn('status', ['open', 'reviewed'])->exists();
        if ($duplicate) {
            return response()->json(['status' => 'already_reported'], 200);
        }

        $minor = $data['reason'] === 'minor_suspected';

        // Au plus 3 signalements « mineur suspecté » par jour et par compte (revue F-09).
        if ($minor && DB::table('reports')->where('reporter_id', $me)->where('reason', 'minor_suspected')->where('created_at', '>=', now()->startOfDay())->count() >= 3) {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Trop de signalements aujourd\'hui.']], 429);
        }

        // Suspension automatique SEULEMENT si le signaleur est établi (compte de plus de safety.reporter_min_age_days jours,
        // e-mail vérifié) ET qu'il a eu une interaction avec la personne (conversation ou match), ou qu'un deuxième
        // signaleur CRÉDIBLE distinct (mêmes critères, avec interaction) s'est ajouté en 7 jours. Sinon le signalement
        // entre en file prioritaire sans suspendre : deux comptes jetables ne suspendent plus un tiers (décision Q2-B,
        // revue F-09). La file prioritaire (ReportResource) reste le filet.
        $credibility = app(ReporterCredibility::class);
        $autoSuspend = $minor && $credibility->isEstablished($me)
            && ($credibility->hasInteraction($me, $data['reported_id']) || $credibility->otherCredibleMinorReporters($data['reported_id'], $me) >= 1);

        $id = (string) Str::uuid();

        DB::transaction(function () use ($id, $me, $data, $minor, $autoSuspend) {
            $distinct = DB::table('reports')->where('reported_id', $data['reported_id'])->where('created_at', '>=', now()->subDays(7))
                ->distinct()->count('reporter_id') + 1;

            DB::table('reports')->insert([
                'id' => $id, 'reporter_id' => $me, 'reported_id' => $data['reported_id'], 'reason' => $data['reason'],
                'details' => $data['details'] ?? null, 'context_type' => $data['context_type'] ?? null, 'context_id' => $data['context_id'] ?? null,
                'priority' => $minor ? 2 : ($distinct >= self::MANY_REPORTS ? 1 : 0),
                'status' => 'open', 'evidence_retain_until' => now()->addYear(), 'created_at' => now(), 'updated_at' => now(),
            ]);

            if ($distinct >= self::MANY_REPORTS) {
                $this->risk($data['reported_id'], 'many_reports', 30);
            }

            if ($autoSuspend) {
                // Suspension préventive immédiate, levée ou confirmée par la revue prioritaire (docs/11).
                DB::table('users')->where('id', $data['reported_id'])->where('status', 'active')->update(['status' => 'suspended', 'updated_at' => now()]);
                DB::table('sanctions')->insert([
                    'id' => (string) Str::uuid(), 'user_id' => $data['reported_id'], 'kind' => 'suspension',
                    'reason' => 'preventive_minor_suspected', 'report_id' => $id, 'starts_at' => now(), 'created_at' => now(),
                ]);
                $this->risk($data['reported_id'], 'minor_suspected', 50);
            }
        });

        if ($autoSuspend) {
            app(Calls::class)->endAllFor($data['reported_id']);
        }

        // Alerte si ce signaleur a un ratio signalements / confirmations anormal (journal + audit, décision Q2-B).
        $credibility->alertIfAbnormal($me);

        return response()->json(['id' => $id, 'status' => 'received'], 201);
    }

    /**
     * Le contexte d'un signalement doit concerner CE couple signaleur / signalé (revue P-10) : sinon un identifiant
     * étranger (message, appel, story d'un tiers) serait attaché au dossier et exposé au modérateur comme une preuve.
     *
     * @param  array<string, mixed>  $data
     */
    private function assertContext(array $data, string $me): void
    {
        $type = $data['context_type'] ?? null;
        $id = $data['context_id'] ?? null;
        if ($id === null) {
            return;
        }

        $other = $data['reported_id'];
        // Conversation du couple : participants (user_a, user_b) = {signaleur, signalé}.
        $pair = fn ($q) => $q->where(fn ($w) => $w->where('user_a', $me)->where('user_b', $other))
            ->orWhere(fn ($w) => $w->where('user_a', $other)->where('user_b', $me));

        $ok = match ($type) {
            'profile' => $id === $other,
            'conversation' => DB::table('conversations')->where('id', $id)->where($pair)->exists(),
            'message' => DB::table('messages')->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
                ->where('messages.id', $id)->where(fn ($q) => $pair($q))->exists(),
            'call' => DB::table('call_sessions')->where('id', $id)->where(fn ($q) => $q
                ->where(fn ($w) => $w->where('caller_id', $me)->where('callee_id', $other))
                ->orWhere(fn ($w) => $w->where('caller_id', $other)->where('callee_id', $me)))->exists(),
            'story' => DB::table('stories')->where('id', $id)->where('user_id', $other)->exists(),
            default => false,
        };

        if (! $ok) {
            throw ValidationException::withMessages(['context_id' => ['Contexte invalide pour ce signalement.']]);
        }
    }

    private function risk(string $userId, string $signal, int $weight): void
    {
        DB::table('risk_events')->insert(['id' => (string) Str::uuid(), 'user_id' => $userId, 'signal' => $signal, 'weight' => $weight, 'created_at' => now()]);
        DB::table('users')->where('id', $userId)->update(['risk_score' => DB::raw("least(100, risk_score + $weight)")]);
    }
}
