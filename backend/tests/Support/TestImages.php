<?php

namespace Tests\Support;

/** Images de test générées à la volée (aucun fichier binaire dans le dépôt). */
final class TestImages
{
    public static function jpeg(int $w = 64, int $h = 48): string
    {
        $img = imagecreatetruecolor($w, $h);
        imagefilledrectangle($img, 0, 0, $w, $h, imagecolorallocate($img, 200, 80, 40));
        ob_start();
        imagejpeg($img, null, 90);
        imagedestroy($img);

        return (string) ob_get_clean();
    }

    public static function png(int $w = 32, int $h = 32): string
    {
        $img = imagecreatetruecolor($w, $h);
        ob_start();
        imagepng($img);
        imagedestroy($img);

        return (string) ob_get_clean();
    }

    /** JPEG valide contenant un segment APP1 « Exif » avec une fausse position GPS. */
    public static function jpegWithGps(): string
    {
        $jpeg = self::jpeg();
        $payload = "Exif\0\0GPSLatitude=48.8566;GPSLongitude=2.3522";
        $segment = "\xFF\xE1".pack('n', strlen($payload) + 2).$payload;

        return substr($jpeg, 0, 2).$segment.substr($jpeg, 2);
    }

    public static function htmlDisguised(): string
    {
        return '<html><script>alert(1)</script></html>'.str_repeat(' ', 300);
    }
}
