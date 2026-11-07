<?php

namespace App\Services;

/**
 * Nettoyage des images déposées (revue de sécurité F-05) : ni le type déclaré, ni la taille déclarée ne sont crus.
 * - le type réel est lu dans les octets (signature) et doit correspondre au type déclaré ;
 * - les dimensions sont plafonnées avant tout décodage (bombes de décompression), ainsi que la mémoire estimée ;
 * - le décodage s'exécute dans un processus séparé borné en mémoire et en temps (MediaSanitizerProcess, revue N-14) ;
 * - l'image est ré-encodée, ce qui supprime EXIF (dont les coordonnées GPS), profils et données ajoutées après l'image ;
 * - l'orientation EXIF est appliquée avant suppression pour que la photo reste à l'endroit.
 */
class MediaSanitizer
{
    public const MAX_PIXELS = 20_000_000;

    public const MAX_SIDE = 12_000;

    /**
     * Point d'entrée. Les contrôles d'en-tête (type, dimensions, animation, mémoire) passent TOUJOURS avant tout
     * décodage et avant le lancement d'un processus ; le décodage lui-même s'exécute ensuite dans un processus
     * séparé (config media.isolate_processing, revue N-14).
     *
     * @return array{bytes: string, mime: string, ext: string}|null null = fichier refusé
     */
    public function clean(string $bytes, string $declaredMime): ?array
    {
        $real = $this->inspect($bytes, $declaredMime);
        if ($real === null) {
            return null;
        }

        if (config('media.isolate_processing')) {
            return app(MediaSanitizerProcess::class)->run($bytes, $declaredMime);
        }

        return $this->decodeAndEncode($bytes, $real);
    }

    /**
     * Nettoyage dans le processus courant (utilisé par le processus enfant et, en test, directement).
     *
     * @return array{bytes: string, mime: string, ext: string}|null
     */
    public function cleanInProcess(string $bytes, string $declaredMime): ?array
    {
        $real = $this->inspect($bytes, $declaredMime);

        return $real === null ? null : $this->decodeAndEncode($bytes, $real);
    }

    /**
     * Lecture d'en-tête seule (aucun décodage de pixels). GD n'offre aucune limite de ressources propre : le plafond de
     * pixels, le côté maximal et l'estimation mémoire sont donc vérifiés ici, avant imagecreatefromstring().
     *
     * @return array{0: string, 1: string}|null [mime, extension] ; null = refusé
     */
    public function inspect(string $bytes, string $declaredMime): ?array
    {
        $info = @getimagesizefromstring($bytes);
        if ($info === false) {
            return null;
        }

        [$width, $height, $type] = $info;
        if ($width < 1 || $height < 1 || $width > self::MAX_SIDE || $height > self::MAX_SIDE || $width * $height > self::MAX_PIXELS) {
            return null;
        }

        $real = match ($type) {
            IMAGETYPE_JPEG => ['image/jpeg', 'jpg'],
            IMAGETYPE_PNG => ['image/png', 'png'],
            IMAGETYPE_WEBP => ['image/webp', 'webp'],
            default => null,
        };
        if ($real === null || $real[0] !== $declaredMime) {
            return null;
        }

        // Images animées (WebP animé, APNG) : refusées. Le coût de décodage croît avec le nombre d'images et le
        // ré-encodage statique changerait silencieusement le contenu ; photos de profil et images de messages sont fixes.
        if (($real[0] === 'image/webp' && $this->isAnimatedWebp($bytes)) || ($real[0] === 'image/png' && $this->isAnimatedPng($bytes))) {
            return null;
        }

        if (! $this->fitsInMemory($width, $height, strlen($bytes), $real[0] === 'image/jpeg')) {
            return null;
        }

        return $real;
    }

    /**
     * @param  array{0: string, 1: string}  $real
     * @return array{bytes: string, mime: string, ext: string}|null
     */
    private function decodeAndEncode(string $bytes, array $real): ?array
    {
        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            return null;
        }

        if ($real[0] === 'image/jpeg') {
            $image = $this->applyOrientation($image, $bytes);
        }

        ob_start();
        match ($real[0]) {
            'image/jpeg' => imagejpeg($image, null, 88),
            'image/png' => imagepng($image),
            'image/webp' => imagewebp($image, null, 88),
        };
        $out = (string) ob_get_clean();
        imagedestroy($image);

        return $out === '' ? null : ['bytes' => $out, 'mime' => $real[0], 'ext' => $real[1]];
    }

    /**
     * GD stocke 4 octets par pixel ; imagerotate (JPEG orienté par EXIF) en garde deux copies, plus la sortie encodée.
     * On refuse avant de décoder plutôt que d'atteindre un fatal « Allowed memory size exhausted ».
     */
    private function fitsInMemory(int $width, int $height, int $inputBytes, bool $jpeg): bool
    {
        $limit = $this->memoryLimitBytes();
        if ($limit === null) {
            return true;
        }

        $needed = (int) ($width * $height * 4 * ($jpeg ? 2.2 : 1.3)) + $inputBytes * 2;

        return memory_get_usage() + $needed <= $limit;
    }

    private function memoryLimitBytes(): ?int
    {
        $raw = trim((string) ini_get('memory_limit'));
        if ($raw === '' || $raw === '-1') {
            return null;
        }

        $value = (int) $raw;

        return match (strtolower(substr($raw, -1))) {
            'g' => $value * 1024 ** 3,
            'm' => $value * 1024 ** 2,
            'k' => $value * 1024,
            default => $value,
        };
    }

    /** VP8X (octet 20) : le bit 0x02 signale une animation. */
    private function isAnimatedWebp(string $bytes): bool
    {
        return substr($bytes, 12, 4) === 'VP8X' && strlen($bytes) > 20 && (ord($bytes[20]) & 0x02) !== 0;
    }

    /** APNG : un fragment acTL précède le premier IDAT. Parcours des seuls en-têtes de fragments. */
    private function isAnimatedPng(string $bytes): bool
    {
        $offset = 8;
        $length = strlen($bytes);
        while ($offset + 8 <= $length) {
            $size = unpack('N', substr($bytes, $offset, 4))[1];
            $name = substr($bytes, $offset + 4, 4);
            if ($name === 'acTL') {
                return true;
            }
            if ($name === 'IDAT' || $name === 'IEND') {
                return false;
            }
            $offset += 12 + $size;
        }

        return false;
    }

    private function applyOrientation(\GdImage $image, string $bytes): \GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        try {
            $exif = @exif_read_data('data://image/jpeg;base64,'.base64_encode($bytes));
        } catch (\Throwable) {
            return $image;
        }

        $angle = match ((int) ($exif['Orientation'] ?? 1)) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        if ($angle === 0) {
            return $image;
        }

        $rotated = imagerotate($image, $angle, 0);

        return $rotated === false ? $image : $rotated;
    }
}
