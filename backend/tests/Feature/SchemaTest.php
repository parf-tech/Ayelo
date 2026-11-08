<?php

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('crée les 37 tables du schéma de référence', function () {
    $tables = collect(DB::select("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"))
        ->pluck('table_name');

    foreach (['users', 'profiles', 'matches', 'conversations', 'messages', 'credit_ledger', 'audit_logs', 'staff_users'] as $name) {
        expect($tables)->toContain($name);
    }

    $laravelTables = ['migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'personal_access_tokens'];
    expect($tables->reject(fn ($t) => in_array($t, $laravelTables)))->toHaveCount(37);
});

it('refuse un mineur au niveau de la base', function () {
    expect(fn () => DB::table('users')->insert([
        'email' => 'kid@example.com',
        'birthdate' => now()->subYears(10)->format('Y-m-d'),
    ]))->toThrow(QueryException::class);
});
