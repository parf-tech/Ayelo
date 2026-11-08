<?php

namespace App\OpenApi;

use App\Exceptions\ReauthenticationRefused;
use App\Exceptions\ReauthenticationThrottled;
use Dedoc\Scramble\Extensions\ExceptionToResponseExtension;
use Dedoc\Scramble\Support\Generator\Reference;
use Dedoc\Scramble\Support\Generator\Response;
use Dedoc\Scramble\Support\Generator\Schema;
use Dedoc\Scramble\Support\Generator\Types as OpenApiTypes;
use Dedoc\Scramble\Support\Type\ObjectType;
use Dedoc\Scramble\Support\Type\Type;
use Illuminate\Support\Str;

/**
 * Documente les refus de ré-authentification dans le format d'erreur unique de l'API { error: { code, message } } :
 * 403 `invalid_credentials` / `invalid_oauth_token`, 429 `rate_limited`.
 */
class ReauthenticationExceptionResponses extends ExceptionToResponseExtension
{
    public function shouldHandle(Type $type)
    {
        return $type instanceof ObjectType
            && ($type->isInstanceOf(ReauthenticationRefused::class) || $type->isInstanceOf(ReauthenticationThrottled::class));
    }

    public function toResponse(Type $type)
    {
        $throttled = $type instanceof ObjectType && $type->isInstanceOf(ReauthenticationThrottled::class);

        $code = (new OpenApiTypes\StringType)->enum($throttled
            ? [ReauthenticationThrottled::CODE]
            : [ReauthenticationRefused::WRONG_PASSWORD, ReauthenticationRefused::WRONG_TOKEN]);

        $error = (new OpenApiTypes\ObjectType)
            ->addProperty('code', $code)
            ->addProperty('message', new OpenApiTypes\StringType)
            ->setRequired(['code', 'message']);

        $body = (new OpenApiTypes\ObjectType)->addProperty('error', $error)->setRequired(['error']);

        return Response::make($throttled ? 429 : 403)
            ->setDescription($throttled
                ? 'Trop d\'échecs de ré-authentification (en-tête Retry-After en secondes).'
                : 'Ré-authentification refusée (mot de passe ou jeton du fournisseur incorrect).')
            ->setContent('application/json', Schema::fromType($body));
    }

    public function reference(ObjectType $type)
    {
        return new Reference('responses', Str::start($type->name, '\\'), $this->components);
    }
}
