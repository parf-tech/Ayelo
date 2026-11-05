<?php

namespace App\Jobs;

use App\Services\DataExport;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Throwable;

class BuildDataExport implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $exportId) {}

    public function handle(DataExport $export): void
    {
        $export->build($this->exportId);
    }

    public function failed(Throwable $e): void
    {
        DB::table('data_exports')->where('id', $this->exportId)->update(['status' => 'failed', 'updated_at' => now()]);
    }
}
