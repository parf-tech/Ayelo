-- Données fictives du banc de charge. Variables psql : profiles, actors, convs (conversations ouvertes par acteur),
-- msgs (messages par conversation), swipes (personnes déjà notées par acteur). Les « acteurs » sont les comptes que k6 incarne :
-- jeton `perf-token-<n>`. Les déclencheurs de l'application (compteurs de conversation) s'exécutent normalement.
\set ON_ERROR_STOP on
begin;

create temporary table perf_users on commit drop as
select g as n,
       gen_random_uuid() as id,
       (current_date - interval '19 years' - ((random() * 7300)::int) * interval '1 day')::date as birthdate,
       now() - random() * interval '365 days' as created_at,
       now() - random() * interval '40 days' as last_seen_at
from generate_series(1, :profiles) g;
create unique index on perf_users (n);

insert into users (id, email, birthdate, locale, status, last_seen_at, created_at, updated_at)
select id, 'perf' || n || '@perf.invalid', birthdate, 'fr', 'active', last_seen_at, created_at, created_at from perf_users;

insert into profiles (id, user_id, display_name, gender, origin_country, residence_country, city, bio, intent, is_visible, created_at, updated_at)
select gen_random_uuid(), id, 'Perf ' || n,
       (array['man', 'woman'])[1 + (n % 2)],
       (array['CM', 'SN', 'CI', 'CD', 'GA', 'FR', 'BE'])[1 + floor(random() * 7)::int],
       (array['FR', 'FR', 'FR', 'BE', 'CH', 'CM', 'CA'])[1 + floor(random() * 7)::int],
       'Ville', 'Profil fictif du banc de charge.',
       (array['marriage', 'long_lasting_love', 'flirt', 'friendship', 'lets_find_out'])[1 + floor(random() * 5)::int],
       random() < 0.95, created_at, created_at
from perf_users;

insert into preferences (user_id, seeking_genders, age_min, age_max, created_at, updated_at)
select id, array[(array['woman', 'man'])[1 + (n % 2)]], 18, 60, now(), now() from perf_users where n <= :actors;

-- Neuf profils sur dix ont une photo approuvée (condition d'apparition en découverte).
insert into media (id, user_id, kind, status, storage_key, mime_type, size_bytes, position, created_at, updated_at)
select gen_random_uuid(), id, 'profile_photo', 'approved', 'u/' || id || '/profile_photo/' || gen_random_uuid() || '.jpg', 'image/jpeg', 200000, 0, created_at, created_at
from perf_users where n % 10 <> 0;

insert into swipes (id, swiper_id, target_id, action, created_at, updated_at)
select gen_random_uuid(), a.id, t.id, 'like', now(), now()
from perf_users a
cross join lateral (select 1 + floor(random() * :profiles)::int as m from generate_series(1, :swipes) where a.n > 0) r
join perf_users t on t.n = r.m
where a.n <= :actors and t.id <> a.id
on conflict do nothing;

create temporary table perf_pairs on commit drop as
select distinct least(a.id, b.id) as user_a, greatest(a.id, b.id) as user_b
from perf_users a
cross join generate_series(1, :convs) k
join perf_users b on b.n = 1 + ((a.n - 1 + k * 7) % :actors)
where a.n <= :actors and a.n <> b.n;

insert into matches (id, user_a, user_b, status, created_at, updated_at)
select gen_random_uuid(), user_a, user_b, 'active', now() - interval '30 days', now() - interval '30 days' from perf_pairs;

insert into conversations (id, user_a, user_b, match_id, initiated_by, unlocked_by, status, created_at, updated_at)
select gen_random_uuid(), m.user_a, m.user_b, m.id, m.user_a, 'match', 'active', m.created_at, m.created_at from matches m;

insert into messages (id, conversation_id, sender_id, client_id, type, body, read_at, created_at, updated_at)
select gen_random_uuid(), c.id, case when g % 2 = 0 then c.user_a else c.user_b end, gen_random_uuid(), 'text',
       'Message fictif numéro ' || g,
       case when g <= :msgs - 3 then now() end,
       now() - interval '20 days' + g * interval '1 minute', now()
from conversations c cross join generate_series(1, :msgs) g;

update conversations c set last_message_at = (select max(created_at) from messages m where m.conversation_id = c.id);

insert into personal_access_tokens (tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
select 'App\Models\User', id, 'perf', encode(sha256(convert_to('perf-token-' || n, 'UTF8')), 'hex'), '["*"]', now(), now()
from perf_users where n <= :actors;

commit;
analyze;
