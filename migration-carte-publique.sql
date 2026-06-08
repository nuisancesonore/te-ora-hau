-- ============================================================
-- Te Ora Hau — Carte des nuisances publique
-- Expose une vue SANS données personnelles (ni adresse du plaignant,
-- ni auteur), consultable par les visiteurs non connectés.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

create or replace view public.signalements_publics as
select
  id, type, commune, quartier, intensite, horaire, recurrence,
  constat, debut, adresse_source, description, lat, lng, cree_le
from public.signalements;
-- NB : la vue n'expose volontairement PAS adresse_plaignant ni auteur.

-- La vue appartient au rôle propriétaire : elle contourne le RLS de la
-- table sous-jacente, mais seules les colonnes ci-dessus sont visibles.
grant select on public.signalements_publics to anon, authenticated;
