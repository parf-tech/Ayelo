<?php

namespace App\Filament\Resources\MediaItemResource\Pages;

use App\Filament\Resources\MediaItemResource;
use Filament\Resources\Pages\ListRecords;
use Livewire\Attributes\Locked;

class ListMediaItems extends ListRecords
{
    protected static string $resource = MediaItemResource::class;

    /** URL signée de l'aperçu en cours : posée seulement à l'ouverture de la fenêtre (donc après l'écriture du journal). */
    #[Locked]
    public ?string $previewUrl = null;

    #[Locked]
    public ?string $previewMime = null;
}
