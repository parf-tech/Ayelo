<?php

namespace App\Services\Media;

/**
 * Traitement des notes vocales et des vidéos de conversation : réencodage sans métadonnées, durée et taille mesurées.
 * Il s'exécute dans le conteneur `transcode` (ffmpeg, sans réseau, limites de CPU, de mémoire et de durée), jamais dans le
 * processus PHP : un fichier audio ou vidéo déposé par un client est un fichier non fiable (docs/14-DEPLOYMENT.md).
 */
interface Transcoder
{
    /** Types de traitement : `audio` (note vocale, sortie m4a) et `video` (sortie mp4). */
    public const KINDS = ['audio', 'video'];

    /** Remet le fichier source au conteneur de traitement. @throws \RuntimeException si le canal est indisponible */
    public function submit(string $mediaId, string $kind, string $bytes): void;

    /** `absent` (rien de remis), `pending` (remis, en cours), `done` (résultat prêt), `failed` (fichier refusé par le traitement). */
    public function state(string $mediaId): string;

    /** Secondes écoulées depuis la remise du fichier (0 si rien n'a été remis). */
    public function ageSeconds(string $mediaId): int;

    /**
     * Résultat d'un traitement terminé.
     *
     * @return array{bytes: string, mime: string, duration_ms: int}
     *
     * @throws \RuntimeException si le résultat est illisible ou incomplet
     */
    public function collect(string $mediaId): array;

    /** Supprime tout ce qui concerne ce média du canal (source, résultat, marques). */
    public function discard(string $mediaId): void;
}
