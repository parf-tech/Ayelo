<?php

/*
 | Lot 8 (N-14, résiduel) : décodage des images borné et hors du processus web.
 | Les contrôles d'en-tête précèdent tout décodage ; le décodage s'exécute dans un processus enfant plafonné.
 */

use App\Services\MediaSanitizer;
use App\Services\MediaSanitizerProcess;
use Tests\Support\TestImages;

/** PNG de quelques dizaines d'octets dont l'en-tête annonce des dimensions arbitraires (aucune donnée de pixels). */
function r8_png_header(int $w, int $h): string
{
    return "\x89PNG\r\n\x1a\n".pack('N', 13).'IHDR'.pack('NN', $w, $h)."\x08\x02\x00\x00\x00".pack('N', 0);
}

/** Espion : compte les lancements de processus enfant. */
function r8_spy(): object
{
    $spy = new class extends MediaSanitizerProcess
    {
        public int $calls = 0;

        public function run(string $bytes, string $declaredMime): ?array
        {
            $this->calls++;

            return parent::run($bytes, $declaredMime);
        }
    };
    app()->instance(MediaSanitizerProcess::class, $spy);

    return $spy;
}

it('N-14 : un en-tête annonçant des dimensions démesurées est refusé avant tout décodage ni processus', function () {
    config(['media.isolate_processing' => true]);
    $spy = r8_spy();
    $sanitizer = new MediaSanitizer;

    $before = memory_get_peak_usage(true);
    // 100 000 x 100 000 px (10 Gpx) dans un fichier de 33 octets.
    expect($sanitizer->clean(r8_png_header(100_000, 100_000), 'image/png'))->toBeNull();
    // Côté > MAX_SIDE avec peu de pixels au total.
    expect($sanitizer->clean(r8_png_header(12_001, 10), 'image/png'))->toBeNull();
    // Juste au-dessus de 20 Mpx.
    expect($sanitizer->clean(r8_png_header(5_000, 4_001), 'image/png'))->toBeNull();

    // JPEG : on réécrit la hauteur/largeur du segment SOF0 d'un vrai JPEG.
    $jpeg = TestImages::jpeg();
    $pos = strpos($jpeg, "\xFF\xC0");
    expect($pos)->not->toBeFalse();
    $bomb = substr($jpeg, 0, $pos + 5).pack('nn', 60_000, 60_000).substr($jpeg, $pos + 9);
    expect(@getimagesizefromstring($bomb))->not->toBeFalse();
    expect($sanitizer->clean($bomb, 'image/jpeg'))->toBeNull();

    expect($spy->calls)->toBe(0)
        ->and(memory_get_peak_usage(true) - $before)->toBeLessThan(16 * 1024 * 1024);
});

it('N-14 : l’estimation mémoire refuse un décodage qui ne tiendrait pas, avant de décoder', function () {
    $previous = ini_get('memory_limit');
    ini_set('memory_limit', (string) (int) (memory_get_usage() + 40 * 1024 * 1024));

    try {
        // 4 000 x 4 000 px (16 Mpx, sous le plafond de pixels) = environ 83 Mo estimés : refusé.
        $refused = (new MediaSanitizer)->cleanInProcess(r8_png_header(4_000, 4_000), 'image/png');
        // Une petite image passe toujours.
        $accepted = (new MediaSanitizer)->cleanInProcess(TestImages::png(), 'image/png');
    } finally {
        ini_set('memory_limit', $previous);
    }

    expect($refused)->toBeNull()->and($accepted)->not->toBeNull();
});

it('N-14 : WebP animé et APNG sont refusés, l’image fixe équivalente est acceptée', function () {
    // WebP animé : conteneur VP8X, bit d'animation (0x02), canvas 16 x 16.
    $vp8x = 'VP8X'.pack('V', 10)."\x02\x00\x00\x00".substr(pack('V', 15), 0, 3).substr(pack('V', 15), 0, 3);
    $webp = 'RIFF'.pack('V', 4 + strlen($vp8x)).'WEBP'.$vp8x;
    expect(@getimagesizefromstring($webp))->not->toBeFalse();
    expect((new MediaSanitizer)->cleanInProcess($webp, 'image/webp'))->toBeNull();

    // APNG : un fragment acTL est inséré avant le premier IDAT d'un vrai PNG.
    $png = TestImages::png();
    $idat = strpos($png, 'IDAT') - 4;
    $actl = pack('N', 8).'acTL'.pack('NN', 2, 0).pack('N', 0);
    $apng = substr($png, 0, $idat).$actl.substr($png, $idat);
    expect(@getimagesizefromstring($apng))->not->toBeFalse();
    expect((new MediaSanitizer)->cleanInProcess($apng, 'image/png'))->toBeNull();

    // Un WebP fixe (sans VP8X animé) reste accepté.
    $img = imagecreatetruecolor(16, 16);
    ob_start();
    imagewebp($img);
    $still = (string) ob_get_clean();
    expect((new MediaSanitizer)->cleanInProcess($still, 'image/webp'))->not->toBeNull();
});

it('N-14 : le processus isolé donne le même résultat que le traitement direct (EXIF retiré)', function () {
    // Démarrage d'artisan lent sur un poste chargé : délai large pour ne pas rendre le test fragile.
    config(['media.process_timeout_seconds' => 90]);
    $jpeg = TestImages::jpegWithGps();

    config(['media.isolate_processing' => false]);
    $direct = (new MediaSanitizer)->clean($jpeg, 'image/jpeg');

    config(['media.isolate_processing' => true]);
    $spy = r8_spy();
    $isolated = (new MediaSanitizer)->clean($jpeg, 'image/jpeg');

    expect($spy->calls)->toBe(1)
        ->and($isolated)->not->toBeNull()
        ->and($isolated)->toBe($direct)
        ->and($isolated['mime'])->toBe('image/jpeg')
        ->and($isolated['ext'])->toBe('jpg')
        ->and($isolated['bytes'])->not->toContain('GPSLatitude')->and($isolated['bytes'])->not->toContain('Exif')
        ->and(@getimagesizefromstring($isolated['bytes']))->not->toBeFalse();

    $png = (new MediaSanitizer)->clean(TestImages::png(), 'image/png');
    expect($png['ext'])->toBe('png')->and($png['mime'])->toBe('image/png');
});

it('N-14 : un fichier corrompu ou une incohérence de type est refusé par le processus enfant', function () {
    config(['media.process_timeout_seconds' => 90]);
    $process = new MediaSanitizerProcess;

    expect($process->run("\x89PNG\r\n\x1a\n".str_repeat("\0", 64), 'image/png'))->toBeNull();
    expect($process->run('pas une image', 'image/jpeg'))->toBeNull();
    // Type déclaré différent du type réel : l'enfant refuse.
    expect($process->run(TestImages::png(), 'image/jpeg'))->toBeNull();
});

it('N-14 : le plafond de mémoire du processus enfant le tue sans toucher au processus appelant', function () {
    config(['media.process_timeout_seconds' => 90]);
    config(['media.process_memory_limit' => '8M']);

    expect((new MediaSanitizerProcess)->run(TestImages::jpeg(), 'image/jpeg'))->toBeNull();

    config(['media.process_memory_limit' => '256M']);
    expect((new MediaSanitizerProcess)->run(TestImages::jpeg(), 'image/jpeg'))->not->toBeNull();
});

it('N-14 : le traitement isolé est désactivé en test et actif par défaut en production', function () {
    expect(config('media.isolate_processing'))->toBeFalse();
    expect(config('media.process_timeout_seconds'))->toBe(10)->and(config('media.process_memory_limit'))->toBe('256M');

    $env = $_ENV['APP_ENV'] ?? null;
    $server = $_SERVER['APP_ENV'] ?? null;
    $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'production';
    putenv('APP_ENV=production');
    try {
        $prod = (require base_path('config/media.php'))['isolate_processing'];
    } finally {
        putenv('APP_ENV=testing');
        $_ENV['APP_ENV'] = $env;
        $_SERVER['APP_ENV'] = $server;
    }
    expect($prod)->toBeTrue();
});
