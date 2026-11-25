<?php

namespace App\Services\Media;

use App\Events\ConversationSignal;
use App\Jobs\SendPush;
use App\Services\Conversations;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Annonce la décision sur un média de conversation (photo, note vocale, vidéo), qu'elle vienne d'un modérateur ou du
 * traitement automatique (fichier illisible) :
 *  - en direct (signal `message.media`) : le client met la bulle à jour (adresse de lecture à demander, ou « refusée ») ;
 *  - par notification push (catégorie « messages », donc soumise aux préférences) : l'expéditeur apprend la décision, le
 *    destinataire apprend qu'un média est visible, seulement si la conversation est encore écrivable.
 * Le motif du rejet n'est jamais diffusé ni notifié. Un échec ne défait pas la décision, déjà enregistrée : il est signalé, et le
 * client se met à jour à la prochaine lecture de l'historique.
 */
final class MediaDecisionNotifier
{
    /** @var array<string, array{approved: array{0: string, 1: string}, incoming: array{0: string, 1: string}, rejected: array{0: string, 1: string}}> */
    private const TEXTS = [
        'image' => [
            'approved' => ['Photo approuvée', 'Votre photo a été approuvée et elle est visible dans la conversation.'],
            'incoming' => ['Nouvelle photo', 'Une photo est disponible dans une conversation.'],
            'rejected' => ['Photo refusée', 'Votre photo n\'a pas été acceptée par la modération.'],
        ],
        'voice' => [
            'approved' => ['Message vocal approuvé', 'Votre message vocal a été approuvé et il est disponible dans la conversation.'],
            'incoming' => ['Nouveau message vocal', 'Un message vocal est disponible dans une conversation.'],
            'rejected' => ['Message vocal refusé', 'Votre message vocal n\'a pas été accepté par la modération.'],
        ],
        'video' => [
            'approved' => ['Vidéo approuvée', 'Votre vidéo a été approuvée et elle est visible dans la conversation.'],
            'incoming' => ['Nouvelle vidéo', 'Une vidéo est disponible dans une conversation.'],
            'rejected' => ['Vidéo refusée', 'Votre vidéo n\'a pas été acceptée par la modération.'],
        ],
    ];

    public function __construct(private Conversations $conversations) {}

    /** @param  string  $status  `approved` ou `rejected` */
    public function decided(string $mediaId, string $status): void
    {
        try {
            $messages = DB::table('messages')->where('media_id', $mediaId)->whereIn('type', array_keys(self::TEXTS))->whereNull('deleted_at')
                ->get(['id', 'conversation_id', 'sender_id', 'type']);
            foreach ($messages as $message) {
                ConversationSignal::dispatch($message->conversation_id, 'message.media', ['message_id' => $message->id, 'media_status' => $status]);
                $this->notify($message->conversation_id, $message->sender_id, $message->type, $status);
            }
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * Identifiants seulement dans les données, texte générique. Le destinataire n'est prévenu que si la conversation est encore
     * écrivable (ni bloquée, ni archivée, comptes actifs) ; l'expéditeur l'est toujours, le média est le sien.
     */
    private function notify(string $conversationId, string $senderId, string $type, string $status): void
    {
        $data = ['type' => 'message', 'conversation_id' => $conversationId];
        $texts = self::TEXTS[$type];
        $mine = $texts[$status === 'approved' ? 'approved' : 'rejected'];
        SendPush::dispatch($senderId, 'messages', $mine[0], $mine[1], $data);

        $conversation = DB::table('conversations')->where('id', $conversationId)->first();
        if ($status === 'approved' && $conversation !== null && $this->conversations->canWrite($conversation, $senderId)) {
            SendPush::dispatch($this->conversations->other($conversation, $senderId), 'messages', $texts['incoming'][0], $texts['incoming'][1], $data);
        }
    }
}
