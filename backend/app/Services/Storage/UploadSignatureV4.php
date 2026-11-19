<?php

namespace App\Services\Storage;

use Aws\Signature\S3SignatureV4;

/**
 * SigV4 qui SIGNE `content-length` et `content-type` dans les URL présignées de dépôt (revue pentest P-07).
 * Le SDK les exclut par défaut (SignatureV4::getHeaderBlacklist et getPresignHeaderDenyList) : sans cela, une URL présignée
 * accepte n'importe quelle taille (jusqu'à 5 Gio) et n'importe quel type. Signés, un corps d'une autre taille ou un autre
 * type donne une erreur de signature côté stockage. À utiliser uniquement pour la présignature du PUT de dépôt, pas pour les
 * requêtes signées ordinaires du client.
 *
 * Hérite de S3SignatureV4 (la signature du client S3 par défaut), PAS de SignatureV4 : seule S3SignatureV4 impose la charge
 * `UNSIGNED-PAYLOAD` (et le paramètre `X-Amz-Content-Sha256` dans l'URL). Avec la classe générique, le SDK signe le hachage du corps
 * vide et R2 répond 403 SignatureDoesNotMatch même pour une requête correcte (essai réel du 2026-11-19, tests/Unit/UploadSignatureV4Test.php).
 */
class UploadSignatureV4 extends S3SignatureV4
{
    protected function getHeaderBlacklist()
    {
        $list = parent::getHeaderBlacklist();
        unset($list['content-length']);

        return $list;
    }

    protected function getPresignHeaderDenyList()
    {
        $list = parent::getPresignHeaderDenyList();
        unset($list['content-type']);

        return $list;
    }
}
