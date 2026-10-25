-- Vue publique minimale. Les détails membres sont définis dans migration-confidentialite-v2.sql.
create or replace view public.signalements_publics
with (security_barrier = true) as
select
  s.id, s.type, s.commune, null::text as quartier, s.intensite,
  null::text as horaire, null::text as recurrence, null::text as constat,
  null::text as debut, null::text as adresse_source, null::text as description,
  round(s.lat::numeric, 2)::double precision as lat,
  round(s.lng::numeric, 2)::double precision as lng, s.cree_le
from public.signalements s;
revoke all on public.signalements_publics from public, anon, authenticated;
grant select on public.signalements_publics to anon, authenticated;
