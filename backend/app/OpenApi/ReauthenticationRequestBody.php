<?php

namespace App\OpenApi;

use App\Http\Controllers\AccountController;
use Dedoc\Scramble\Contracts\OperationTransformer;
use Dedoc\Scramble\Support\Generator\Combined\AnyOf;
use Dedoc\Scramble\Support\Generator\Operation;
use Dedoc\Scramble\Support\Generator\RequestBodyObject;
use Dedoc\Scramble\Support\Generator\Schema;
use Dedoc\Scramble\Support\Generator\Types as T;
use Dedoc\Scramble\Support\RouteInfo;

/**
 * Corps de la ré-authentification de `DELETE /me` et de `POST /me/export` (revues F-20, F-21).
 *
 * La validation vit dans `AccountController::reauthenticate()`, que Scramble ne lit pas ; et il décrit les paramètres d'un DELETE
 * comme des paramètres d'URL, ce qui placerait un mot de passe dans l'adresse. Le contrat décrit donc ici un corps JSON :
 * mot de passe (compte avec mot de passe) ou jeton d'identité du fournisseur (compte social).
 */
class ReauthenticationRequestBody implements OperationTransformer
{
    public function handle(Operation $operation, RouteInfo $routeInfo)
    {
        if ($routeInfo->className() !== AccountController::class || ! in_array($routeInfo->methodName(), ['destroy', 'requestExport'], true)) {
            return;
        }

        $password = (new T\ObjectType)
            ->addProperty('password', (new T\StringType)->setMax(200))
            ->setRequired(['password']);

        $provider = (new T\ObjectType)
            ->addProperty('provider', (new T\StringType)->enum(['google', 'apple']))
            ->addProperty('id_token', (new T\StringType)->setMax(5000))
            ->addProperty('nonce', (new T\StringType)->setMax(200))
            ->setRequired(['provider', 'id_token']);

        $body = (new AnyOf)->setItems([$password, $provider]);

        $operation->addRequestBodyObject(
            RequestBodyObject::make()
                ->setContent('application/json', Schema::fromType($body))
                ->description('Mot de passe, ou jeton d\'identité frais du fournisseur (compte social) avec le `nonce` éventuel.')
                ->required()
        );
    }
}
