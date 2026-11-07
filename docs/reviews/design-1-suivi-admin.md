# Suivi : revue design 1, back-office Filament (P1-9, point 10)

Source : `docs/reviews/design-1.md`, § P1-9. Périmètre : `backend/app/Filament/**`, `backend/lang/{fr,en}/admin.php`, `backend/tests/Feature/Admin/AdminUxTest.php`. La matrice des droits (`App\Services\Admin\Permissions`, invariants N-09) et le masquage existant ne sont pas modifiés.

Légende : [x] fait et testé, [~] fait en partie, [ ] reporté (avec raison).

## Fait

- [x] Libellés d'états traduits et colorés (fr + en) : signalements, comptes, vérifications, tickets, contestations, vérification de profil, sanctions, décisions, types de média, types de crédit, signaux de risque, actions du journal d'audit. Classe `Support\Labels` (une valeur inconnue reste affichée telle quelle). Test : libellés rendus, couleurs, parité fr / en des clés, existence de toutes les clés utilisées.
- [x] Aucune chaîne française codée en dur dans `app/Filament` (hors commandes console). Libellés, notifications, modales, widget : `Staff::t()` (clés `admin.*`). Test de garde : balayage du code.
- [x] Fiche de signalement avec contexte : compte signalé (lien vers la fiche réservé à `users.view`), statut, score de risque existant, nombre de sanctions, signalements ouverts sur la même cible, historique des cinq dernières sanctions ; historique du signalant (déposés, suivis de sanction, classés) ; échéance absolue et relative.
- [x] Délais : 24 h en standard, 2 h pour « mineur suspecté » ou priorité critique (`Support\Sla`). Colonne « Délai » en liste (vert, orange à 75 %, rouge « en retard de … »), filtre « En retard », couleur rouge du badge de navigation s'il existe un signalement critique ouvert.
- [x] Confirmations avec conséquence : avertir, suspendre (le formulaire rappelle le nom du compte et la durée choisie), bannir, classer, lever la suspension préventive, rejeter un média (suppression du fichier), rejeter une vérification (suppression du selfie), accepter / rejeter une contestation, suspendre / bannir / réactiver depuis la fiche utilisateur. Approuver un média n'en demande plus (action fréquente et réversible en pratique, comme recommandé).
- [x] E-mail masqué en liste (`a***@e***.com`, `Support\Mask`) : liste des utilisateurs et file média ; la recherche porte toujours sur la vraie valeur. L'e-mail complet reste sur la fiche, réservé à `users.view` (support, administrateur). Le modérateur ne voit aucun e-mail (inchangé).
- [x] Aperçu média en fenêtre modale (plus de nouvel onglet) par le chemin audité `MediaModeration::preview` (« media.preview », sans l'URL dans le journal) ; média flouté jusqu'au clic « Afficher ».
- [x] File triée par priorité décroissante puis du plus ancien au plus récent ; filtres statut, priorité, motif, retard ; liens de ligne et boutons (navigables au clavier).
- [x] Enchaînement : après une décision sur la fiche, ouverture du plus ancien signalement ouvert du même niveau de priorité (retour à la liste s'il n'y en a plus) ; bouton « Passer au suivant ».
- [x] Tuiles du tableau de bord : lien vers la file filtrée (signalements par priorité, médias, vérifications, contestations, tickets).
- [x] Langue : français par défaut ; anglais si `config('app.admin_locale')` vaut `en` (clé à ajouter à `config/app.php` si le propriétaire le souhaite, par exemple `'admin_locale' => env('ADMIN_LOCALE', 'fr')`). Pas de négociation par `Accept-Language`.

## Écarts assumés

- [~] Extrait de la conversation signalée : non fourni. Aucun rôle ne détient de droit de lecture des messages (voir `Permissions::MATRIX`, test « aucun extrait de conversation »), et ce droit ne doit pas être créé ici. La fiche l'indique explicitement ; les détails du signalant restent visibles. À rouvrir seulement si le propriétaire décide d'un droit dédié, journalisé comme le selfie.
- [~] Dévoilement de l'e-mail « par clic journalisé » : non ajouté. La fiche utilisateur exige déjà `users.view` et affiche l'e-mail en entier (comportement existant couvert par des tests) ; un clic journalisé demanderait un nouvel événement d'audit dans `App\Services\Admin` (hors périmètre de ce lot).
- [~] Messages métier (`DomainException`) levés par `App\Services\Admin\*` : toujours en français, car ces services sont hors périmètre. Les afficher traduits demande de les remplacer par des clés.
- [~] Commandes console (`app/Filament/Commands`) : sortie console en français, non traduite (hors back-office).

## Reporté

- [ ] Attribution (« Prendre ») et verrou sur signalements et médias : demande une colonne `assigned_to` et une migration (hors périmètre).
- [ ] Regroupement des doublons d'un même compte pour traitement groupé (le compteur de signalements ouverts sur la cible est fourni).
- [ ] Boutons Approuver / Rejeter et précédent / suivant dans la modale d'aperçu ; rappel de pause après N éléments.
- [ ] Bandeau d'environnement, favicon, `unsavedChangesAlerts()`, recherche globale limitée aux utilisateurs : ces réglages sont dans `app/Providers/AdminPanelProvider.php`, hors périmètre de ce lot.
- [ ] Prise en charge de `Accept-Language` ou d'une préférence enregistrée par membre du personnel (aucune colonne `locale` sur `staff_users`).

## Remarque d'environnement

Un dossier vide `backend/resources/lang` (non suivi par Git) existait dans la copie de travail. Laravel le préfère alors à `backend/lang`, ce qui rendait toutes les clés `admin.*` illisibles (le nom de la clé s'affichait). Il a été supprimé ; il n'existe pas dans un clone propre.
