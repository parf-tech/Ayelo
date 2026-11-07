<?php

namespace App\Services\Storage;

interface MediaStorage
{
    /**
     * URL présignée de dépôt (méthode PUT) pour une clé d'objet.
     *
     * @return array{url: string, headers: array<string, string>}
     */
    public function presignedUpload(string $key, string $mime, int $size, int $ttlMinutes): array;

    /** URL de lecture signée et courte. */
    public function temporaryUrl(string $key, int $ttlMinutes): string;

    /**
     * Métadonnées réelles de l'objet déposé, ou null s'il n'existe pas.
     *
     * @return array{size: int, mime: string}|null
     */
    public function head(string $key): ?array;

    public function delete(string $key): void;

    /**
     * Contenu de l'objet (nettoyage des images à la fin de l'envoi).
     * Avec `$maxBytes`, au plus `$maxBytes + 1` octets sont lus : un objet plus grand est détectable sans le charger en entier.
     */
    public function get(string $key, ?int $maxBytes = null): string;

    /** Dépose un contenu texte/binaire généré par le serveur (exports de données). */
    public function put(string $key, string $contents, string $mime): void;

    /**
     * Objets sous un préfixe (balayage des clés orphelines, revue N-14), avec leur date de dernière modification
     * (timestamp Unix). Parcours paresseux : ne jamais charger tout le bucket en mémoire.
     *
     * @return iterable<array{key: string, modified_at: int}>
     */
    public function listObjects(string $prefix): iterable;
}
