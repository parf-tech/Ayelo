-- Acteurs du banc et leurs conversations, au format JSON lu par k6.
select json_agg(json_build_object(
         'token', 'perf-token-' || substring(u.email::text from '^perf([0-9]+)@'),
         'conversations', (select coalesce(json_agg(x.id), '[]'::json)
                           from (select c.id from conversations c where c.user_a = u.id or c.user_b = u.id order by c.id limit 10) x)))
from personal_access_tokens p
join users u on u.id = p.tokenable_id::uuid
where p.name = 'perf';
