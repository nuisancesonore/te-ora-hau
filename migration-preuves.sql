-- ============================================================
-- Te Ora Hau — Renforcement du dossier des signalements
-- Précision horaire (pour les passages gendarmerie), voisins également
-- gênés (trouble collectif), preuves disponibles (crédibilité du dossier).
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================
alter table public.signalements add column if not exists horaire_detail text;
alter table public.signalements add column if not exists voisins_genes boolean not null default false;
alter table public.signalements add column if not exists preuves text;

-- La précision horaire est aussi utile aux membres sur la carte :
-- on l'ajoute à la vue publique (en fin de liste, sans données perso).
create or replace view public.signalements_publics as
select
  id, type, commune, quartier, intensite, horaire, recurrence,
  constat, debut, adresse_source, description, lat, lng, cree_le,
  horaire_detail
from public.signalements;
grant select on public.signalements_publics to anon, authenticated;
