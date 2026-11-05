<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

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
        $id = (string) Str::uuid();

        DB::transaction(function () use ($id, $me, $data, $minor) {
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

            if ($minor) {
                // Suspension préventive immédiate, levée ou confirmée par la revue prioritaire (docs/11).
                DB::table('users')->where('id', $data['reported_id'])->where('status', 'active')->update(['status' => 'suspended', 'updated_at' => now()]);
                DB::table('sanctions')->insert([
                    'id' => (string) Str::uuid(), 'user_id' => $data['reported_id'], 'kind' => 'suspension',
                    'reason' => 'preventive_minor_suspected', 'report_id' => $id, 'starts_at' => now(), 'created_at' => now(),
                ]);
                $this->risk($data['reported_id'], 'minor_suspected', 50);
            }
        });

        return response()->json(['id' => $id, 'status' => 'received'], 201);
    }

    private function risk(string $userId, string $signal, int $weight): void
    {
        DB::table('risk_events')->insert(['id' => (string) Str::uuid(), 'user_id' => $userId, 'signal' => $signal, 'weight' => $weight, 'created_at' => now()]);
        DB::table('users')->where('id', $userId)->update(['risk_score' => DB::raw("least(100, risk_score + $weight)")]);
    }
}
