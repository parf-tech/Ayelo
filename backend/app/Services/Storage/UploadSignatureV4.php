<?php

namespace App\Services\Storage;

use Aws\Signature\SignatureV4;

/**
 * SigV4 qui SIGNE `content-length` et `content-type` dans les URL présignées de dépôt (revue pentest P-07).
 * Le SDK les exclut par défaut (SignatureV4::getHeaderBlacklist et getPresignHeaderDenyList) : sans cela, une URL présignée
 * accepte n'importe quelle taille (jusqu'à 5 Gio) et n'importe quel type. Signés, un corps d'une autre taille ou un autre
 * type donne une erreur de signature côté stockage. À utiliser uniquement pour la présignature du PUT de dépôt, pas pour les
 * requêtes signées ordinaires du client.
 */
class UploadSignatureV4 extends SignatureV4
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
