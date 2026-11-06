# Décisions du propriétaire

Source : formulaire de validation, 2026-11-05. Ces décisions priment sur les hypothèses des documents 00 à 15.

| # | sujet | décision | impact |
| --- | --- | --- | --- |
| D1 | Stack (ADR 001) | **Validée** : Expo, Laravel 12, PostgreSQL, Redis, Reverb, Filament, RevenueCat, VPS 8 Go | gate G0 franchi pour la stack |
| D2 | Budget infrastructure | **30 à 80 € par mois**, hors comptes développeur | voir conflit C1 |
| D3 | Marchés au lancement | France / Europe francophone, Afrique francophone, Amérique du Nord, Afrique anglophone | RGPD + lois nord-américaines ; vidéo à alléger pour les réseaux lents ; paiements via stores |
| D4 | Langues V1 | **Français et anglais** | i18n fr/en dès le départ ; modération dans les deux langues |
| D5 | Comptes développeur | **Aucun** pour l'instant | à ouvrir tout de suite : bloque les tests sur appareil et la soumission |
| D6 | Matériel | **Mac et iPhone** disponibles | tests iOS réels, builds locaux possibles |
| D7 | Appels audio / vidéo | **Inclus dès le lancement** | change l'ordre des phases ; voir conflit C1 |
| D8 | Nom et marque | je propose, vous choisissez | liste de 10 noms originaux à produire |

## Conflits et points à trancher

**C1 : budget contre appels dès le lancement.** Un VPS de 8 Go (environ 20 à 40 € selon l'offre) plus un serveur LiveKit dédié dépasse vite 80 €. Pistes :
1. Démarrer avec **LiveKit Cloud** (offre gratuite limitée, puis facturation à l'usage) tant que le trafic est faible ; passer à un serveur dédié ensuite.
2. Limiter la durée des appels (par exemple 20 minutes) et la qualité vidéo (480p) pour maîtriser la bande passante.
3. Réserver les appels vidéo aux matchs.

Je recommande 1 + 2. **Les tarifs n'ont pas été vérifiés** : je les contrôle avant que vous payiez quoi que ce soit.

**C2 : appels en arrière-plan avec Expo.** Les appels entrants quand l'app est fermée (CallKit sur iOS, ConnectionService sur Android) sont la partie la plus risquée. Un prototype (D0) est donc obligatoire avant de promettre la date de lancement. Si le prototype échoue, repli : appel entrant par notification classique, moins fluide.

**C3 : quatre marchés à la fois.** Quatre zones ouvrent beaucoup d'obligations légales et de contraintes de modération. Recommandation : **lancement progressif**, d'abord une ou deux zones, puis les autres. Je vous proposerai l'ordre après avoir lu les sources manquantes.

**C4 : comptes développeur.** Ouvrez-les maintenant. La vérification d'identité (et pour une entreprise, du numéro D-U-N-S chez Apple) peut prendre de quelques jours à plusieurs semaines.

## Délégation : choix faits par le CTO (2026-11-05)

Le propriétaire m'a confié ces arbitrages (« je te confie tout en tant qu'expert »). Ils restent révisables.

| # | sujet | choix du CTO | raison |
| --- | --- | --- | --- |
| E1 | Ordre de lancement des marchés | **Vague 1 : France / Belgique / Suisse + Canada francophone** (diaspora francophone). **Vague 2 : Afrique francophone** (Côte d'Ivoire, Sénégal, Cameroun, Bénin, etc.). **Vague 3 : États-Unis, Royaume-Uni, Afrique anglophone** | un seul cadre juridique principal d'abord (RGPD), langue de base = français, paiements via stores plus simples ; l'Afrique demande une vidéo allégée et des tests réseau ; l'anglais arrive avec la vague 3 mais l'i18n fr/en est prête dès la V1 |
| E2 | Appels au lancement | **Vidéo + audio pour les matchs uniquement**, 20 min max, 480p par défaut ; LiveKit Cloud au départ | maîtrise du coût et des abus ; prototype D0 obligatoire |
| E3 | Phase C (stories, invitations vidéo) | **Après le lancement** (V1.1) | l'original les propose (confirmé) mais elles ne sont pas nécessaires au cœur de valeur ; réduit la charge de modération vidéo au lancement |
| E4 | Tarification | **Un seul abonnement Premium (1 / 3 / 12 mois) et un pack de crédits conversation**, pas de paliers multiples | l'original expose 10 produits et ses utilisateurs se plaignent de trop de fonctions payantes |
| E5 | Cadeaux virtuels | **Phase E** (après lancement) | confirmé dans l'original, mais complexité de monnaie virtuelle et d'abus ; à ouvrir quand la base est active |
| E6 | Nom de la marque | voir ci-dessous | |

### Noms proposés (originaux, domaines vérifiés le 2026-11-05)

Tous les `.com` testés sont **déjà pris**. Les `.app` et `.io` ci-dessous sont **libres** selon l'API de domaines Hostinger. La disponibilité du nom dans les stores et auprès de l'INPI / EUIPO / USPTO n'est **pas vérifiée**.

| nom | .com | .app | .io | remarque |
| --- | --- | --- | --- | --- |
| Ayelo | pris | libre | libre | court, facile à prononcer en français et en anglais |
| Kuyana | pris | libre | libre | sonorité chaleureuse |
| Sokalo | pris | libre | libre | rythme rappelant « social » |
| Loveko | pris | libre | libre | trop descriptif, risque de confusion |
| Zinara | pris | libre | libre | à éviter : ZINARA est le nom d'un organisme public au Zimbabwe |
| Ndolo | pris | pris | libre | seulement `.io` |
| Anilo | pris | libre | pris | |
| Yemba | pris | libre | pris | nom d'une langue du Cameroun : à éviter pour un usage commercial |
| Mbali | pris | pris | libre | peu utile |
| Kalyo | pris | pris | pris | indisponible |

**Recommandation : Ayelo** (`ayelo.app` + `ayelo.io`), nom de travail. Avant tout achat : recherche de marque (INPI, EUIPO, USPTO), recherche dans l'App Store et Google Play, vérification que le mot n'a pas de sens négatif dans les langues des marchés visés. **Je n'achète aucun domaine sans votre ordre explicite.**

## Conséquences sur le backlog (mis à jour le 2026-11-05)

- Périmètre de lancement : phases A, B et D. Le prototype D0 démarre dès la fin de A14, en parallèle de B ; D1 à D5 suivent B1. Le gate G6 (stores) est après D.
- Phase C (stories, invitations vidéo) : **après le lancement** (décision E3).
- Phase E (cadeaux, proximité, parrainage) : après le lancement.
- Ajoutés à la phase A : internationalisation fr / en (A0), export / consentements / contestation / support (A16), écrans manquants (A17).

## Vérification préliminaire du nom « Ayelo » (2026-11-06)

Recherche web (deux requêtes) : **aucune marque ou application nommée exactement « Ayelo »** trouvée. Noms proches relevés :
- **AILO** : dépôt de marque de juin 2025 par AILO International, Inc., couvrant notamment des services de rencontres et de mariage (source : trademarkdir.com, lecture d'un extrait de recherche seulement) : **risque de confusion à faire évaluer**, le domaine d'activité est le même.
- AYLOE (enregistrement individuel sans lien visible avec les rencontres), Yelo (applications de location de voitures, banque), Aylo Health (santé).

**Limites** : ce n'est pas une recherche d'antériorité. Les bases officielles (INPI, EUIPO, USPTO, CIPO canadien, OAPI pour l'Afrique) n'ont pas été interrogées ; la disponibilité dans l'App Store et Google Play n'est pas vérifiée. Avant tout achat de domaine ou publication : recherche d'antériorité par un professionnel de la propriété intellectuelle, notamment sur AILO. Le nom reste **provisoire**.
