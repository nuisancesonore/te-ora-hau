-- ============================================================
-- Te Ora Hau — MIGRATION COMPLÈTE (tout-en-un)
-- À coller dans Supabase → SQL Editor → New query → Run.
-- 100 % idempotent et sans risque : rien n'est supprimé ni écrasé.
-- Regroupe : colonnes manquantes + rappels cotisation + carte publique + contact.
-- ============================================================

-- ---------- 1) Colonnes manquantes ----------
alter table public.signalements add column if not exists constat text;
alter table public.signalements add column if not exists debut text;
alter table public.profils add column if not exists type_adhesion text;
alter table public.profils add column if not exists date_naissance date;
alter table public.profils add column if not exists adresse text;

-- ---------- 2) Rappels de cotisation (anti-doublon) ----------
alter table public.profils add column if not exists rappel_60j_pour date;
alter table public.profils add column if not exists rappel_30j_pour date;

-- ---------- 3) Carte des nuisances publique (vue sans données perso) ----------
create or replace view public.signalements_publics as
select
  id, type, commune, quartier, intensite, horaire, recurrence,
  constat, debut, adresse_source, description, lat, lng, cree_le
from public.signalements;
-- N'expose PAS adresse_plaignant ni auteur.
grant select on public.signalements_publics to anon, authenticated;

-- ---------- 4) Messages de contact ----------
create table if not exists public.messages_contact (
  id uuid primary key default gen_random_uuid(),
  nom text, prenom text, commune text, email text,
  sujet text, message text not null,
  traite boolean not null default false,
  cree_le timestamptz not null default now()
);
alter table public.messages_contact enable row level security;

drop policy if exists contact_insert_public on public.messages_contact;
create policy contact_insert_public on public.messages_contact
  for insert with check (true);

drop policy if exists contact_select_bureau on public.messages_contact;
create policy contact_select_bureau on public.messages_contact
  for select using (public.is_bureau());

drop policy if exists contact_update_bureau on public.messages_contact;
create policy contact_update_bureau on public.messages_contact
  for update using (public.is_bureau()) with check (public.is_bureau());

-- ============================================================
-- TERMINÉ. Rechargez le site (Ctrl+F5) après exécution.
-- ============================================================
