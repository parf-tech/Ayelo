<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Revue CTO 1, risque 9 (docs/reviews/cto-1.md, section 2.1) : index des chemins chauds.
 * Miroir : docs/schema/001_initial.sql (même noms ; sur une base neuve le fichier SQL les crée déjà et cette migration ne fait rien).
 *
 * `create index concurrently` ne bloque pas les écritures sur une base en production, mais ne peut pas tourner dans une
 * transaction : d'où `$withinTransaction = false`. Si une construction est interrompue, PostgreSQL laisse un index INVALIDE
 * (visible dans \d, colonne indisvalid de pg_index) : le supprimer (`drop index concurrently <nom>`) puis relancer la migration.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    /** @var array<string, string> nom => définition (sans `create index`) */
    private const INDEXES = [
        // Non lus d'une liste de conversations : seuls les messages non lus et non supprimés sont indexés (petit index, écriture rare).
        'messages_unread_idx' => 'on messages (conversation_id) where read_at is null and deleted_at is null',
        // Curseur de messages `(created_at, id) < (?, ?)` et « dernier message » en jointure latérale : l'ordre complet est dans l'index.
        'messages_conversation_created_idx' => 'on messages (conversation_id, created_at desc, id desc)',
        // Découverte : tri `created_at desc, id desc` sur les profils visibles.
        'profiles_visible_created_idx' => 'on profiles (created_at desc, id desc) where is_visible',
        // Découverte : filtres d'âge (birthdate) et de fraîcheur (last_seen_at) sur les comptes actifs.
        'users_active_birthdate_idx' => "on users (birthdate) where status = 'active'",
        'users_active_last_seen_idx' => "on users (last_seen_at) where status = 'active'",
        // Découverte : « a au moins une photo approuvée » (exists) sans parcourir tous les médias de la personne.
        'media_approved_photo_idx' => "on media (user_id) where kind = 'profile_photo' and status = 'approved'",
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $name => $definition) {
            DB::statement("create index concurrently if not exists {$name} {$definition}");
        }
        // Remplacé par messages_conversation_created_idx (même préfixe, plus le départage par id).
        DB::statement('drop index concurrently if exists messages_conversation_id_created_at_idx');
    }

    public function down(): void
    {
        DB::statement('create index concurrently if not exists messages_conversation_id_created_at_idx on messages (conversation_id, created_at desc)');
        foreach (array_keys(self::INDEXES) as $name) {
            DB::statement("drop index concurrently if exists {$name}");
        }
    }
};
