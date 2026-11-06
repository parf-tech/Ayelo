<?php

namespace App\Services;

/**
 * Nettoyage des images déposées (revue de sécurité F-05) : ni le type déclaré, ni la taille déclarée ne sont crus.
 * - le type réel est lu dans les octets (signature) et doit correspondre au type déclaré ;
 * - les dimensions sont plafonnées avant tout décodage (bombes de décompression) ;
 * - l'image est ré-encodée, ce qui supprime EXIF (dont les coordonnées GPS), profils et données ajoutées après l'image ;
 * - l'orientation EXIF est appliquée avant suppression pour que la photo reste à l'endroit.
 */
class MediaSanitizer
{
    public const MAX_PIXELS = 40_000_000;

    public const MAX_SIDE = 12_000;

    /** @return array{bytes: string, mime: string, ext: string}|null null = fichier refusé */
    public function clean(string $bytes, string $declaredMime): ?array
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
