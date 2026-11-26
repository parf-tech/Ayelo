-- Plan réel de la requête de découverte (backend/app/Services/DiscoveryQuery.php) pour un acteur du banc : filtres larges,
-- puis filtres sélectifs (le cas où l'index d'ordre sert le moins). À tenir à jour avec le service.
\set ON_ERROR_STOP on
select id as viewer from users where email = 'perf1@perf.invalid' \gset

\echo '== filtres larges (préférences par défaut)'
explain (analyze, buffers)
select profiles.id, profiles.created_at from profiles
inner join users on users.id = profiles.user_id
where profiles.user_id <> :'viewer' and profiles.is_visible and users.status = 'active'
  and exists (select 1 from media where media.user_id = profiles.user_id and media.kind = 'profile_photo' and media.status = 'approved')
  and not exists (select 1 from swipes where swipes.swiper_id = :'viewer' and swipes.target_id = profiles.user_id)
  and not exists (select 1 from blocks where (blocks.blocker_id = :'viewer' and blocks.blocked_id = profiles.user_id) or (blocks.blocker_id = profiles.user_id and blocks.blocked_id = :'viewer'))
  and users.birthdate <= current_date - interval '18 years' and users.birthdate > current_date - interval '61 years'
  and profiles.gender = any('{woman}'::text[])
order by profiles.created_at desc, profiles.id desc limit 21;

\echo '== filtres sélectifs (pays, origine, intention, vérifiés)'
explain (analyze, buffers)
select profiles.id, profiles.created_at from profiles
inner join users on users.id = profiles.user_id
where profiles.user_id <> :'viewer' and profiles.is_visible and users.status = 'active'
  and exists (select 1 from media where media.user_id = profiles.user_id and media.kind = 'profile_photo' and media.status = 'approved')
  and not exists (select 1 from swipes where swipes.swiper_id = :'viewer' and swipes.target_id = profiles.user_id)
  and not exists (select 1 from blocks where (blocks.blocker_id = :'viewer' and blocks.blocked_id = profiles.user_id) or (blocks.blocker_id = profiles.user_id and blocks.blocked_id = :'viewer'))
  and users.birthdate <= current_date - interval '25 years' and users.birthdate > current_date - interval '31 years'
  and profiles.residence_country = any('{CM}'::char(2)[]) and profiles.origin_country = any('{GA}'::char(2)[])
  and profiles.intent = any('{marriage}'::text[]) and profiles.verification_status = 'verified'
order by profiles.created_at desc, profiles.id desc limit 21;
