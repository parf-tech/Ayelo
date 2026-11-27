<?php

namespace App\Logging;

use Sentry\Event;
use Sentry\Stacktrace;

/**
 * Dernier filtre avant l'envoi d'un événement à Sentry (option `before_send`, config/sentry.php). Il garde le type de
 * l'erreur, la pile d'appels sans variables, la méthode et le chemin sans identifiants ; il retire le reste : compte,
 * adresse IP, en-têtes, cookies, corps, paramètres d'adresse, contexte libre. Les messages sont masqués par
 * {@see RedactSensitiveData} puis par les règles ci-dessous.
 *
 * Limite : un message d'erreur écrit par notre code avec un pseudo ou un texte de membre partirait tel quel. Ne pas en écrire.
 */
final class SentryScrubber
{
    /** Contextes techniques conservés ; tout autre contexte est remplacé. */
    private const KEPT_CONTEXTS = ['runtime', 'os', 'trace'];

    private const MAX_LENGTH = 500;

    private const UUID = '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i';

    public static function beforeSend(Event $event): Event
    {
        $event->setUser(null);
        $event->setBreadcrumb([]);
        $event->setExtra([]);
        $event->setAttachments([]);
        $event->setRequest(self::request($event->getRequest()));

        foreach (array_keys($event->getContexts()) as $name) {
            if (! in_array($name, self::KEPT_CONTEXTS, true)) {
                $event->setContext((string) $name, ['retiré' => true]);
            }
        }
        $event->setTags(array_map(self::text(...), $event->getTags()));

        if ($event->getTransaction() !== null) {
            $event->setTransaction(self::path($event->getTransaction()));
        }
        if ($event->getMessage() !== null) {
            $event->setMessage(self::text($event->getMessage()));
        }
        foreach ($event->getExceptions() as $exception) {
            $exception->setValue(self::text($exception->getValue()));
            self::dropVariables($exception->getStacktrace());
        }
        self::dropVariables($event->getStacktrace());

        return $event;
    }

    /** Message d'erreur débarrassé de ce qui désigne une personne. */
    public static function text(string $value): string
    {
        // Une erreur de base recopie les valeurs de la requête (pseudo, texte d'un message...) : on ne garde que le code
        // SQLSTATE et le nom de la contrainte. La pile d'appels dit où.
        if (preg_match('/SQLSTATE\[(\w+)\]/', $value, $state) === 1) {
            $constraint = preg_match('/constraint "(\w+)"/', $value, $name) === 1 ? ' (contrainte '.$name[1].')' : '';

            return 'SQLSTATE['.$state[1].']'.$constraint.' '.RedactSensitiveData::MASK;
        }

        // Réponse d'un service externe recopiée par le client HTTP de Laravel.
        $value = preg_replace('/(HTTP request returned status code \d{3}).*/s', '$1', $value) ?? '';
        // Paramètres d'adresse : signatures, jetons.
        $value = preg_replace('/(\bhttps?:\/\/[^\s?#"\']+)[?#][^\s"\']*/i', '$1?'.RedactSensitiveData::MASK, $value) ?? '';
        // Adresses e-mail et jetons.
        $value = (new RedactSensitiveData)->scrubString($value);
        // Identifiants de comptes et d'objets.
        $value = preg_replace(self::UUID, ':id', $value) ?? '';
        // Adresses IP (IPv4, puis IPv6 vérifiée pour ne pas confondre avec « Classe::methode »).
        $value = preg_replace('/\b(?:\d{1,3}\.){3}\d{1,3}\b/', RedactSensitiveData::MASK, $value) ?? '';
        $value = preg_replace_callback(
            '/(?<![\w:.])[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}(?![\w:])/i',
            fn (array $m): string => filter_var($m[0], FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) === false ? $m[0] : RedactSensitiveData::MASK,
            $value,
        ) ?? '';

        return mb_substr($value, 0, self::MAX_LENGTH);
    }

    /**
     * @param  array<array-key, mixed>  $request
     * @return array<string, string>
     */
    private static function request(array $request): array
    {
        $kept = [];
        if (is_string($request['method'] ?? null)) {
            $kept['method'] = $request['method'];
        }
        if (is_string($request['url'] ?? null)) {
            $kept['url'] = self::path($request['url']);
        }

        return $kept;
    }

    /** Adresse ou nom de route sans paramètres, les segments portant un identifiant ou un jeton remplacés par « :id ». */
    private static function path(string $value): string
    {
        $value = preg_replace('/[?#].*$/s', '', $value) ?? '';

        return preg_replace_callback('/(?<=\/)[^\/\s]+/', function (array $m): string {
            $segment = rawurldecode($m[0]);
            $identifier = ctype_digit($segment)
                || str_contains($segment, '@')
                || preg_match(self::UUID, $segment) === 1
                || (strlen($segment) >= 16 && preg_match('/\d/', $segment) === 1 && ! str_contains($segment, '.'));

            return $identifier ? ':id' : $m[0];
        }, $value) ?? '';
    }

    private static function dropVariables(?Stacktrace $stacktrace): void
    {
        foreach ($stacktrace?->getFrames() ?? [] as $frame) {
            $frame->setVars([]);
        }
    }
}
