<?php

use App\Providers\AdminPanelProvider;
use App\Providers\AppServiceProvider;
use App\Providers\QueueDeadLetterServiceProvider;

return [
    AppServiceProvider::class,
    AdminPanelProvider::class,
    QueueDeadLetterServiceProvider::class,
];
