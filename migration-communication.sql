-- ============================================================
-- Te Ora Hau — Communication (téléphone + annonces)
-- À coller dans Supabase → SQL Editor → Run. Idempotent, sans risque.
-- ============================================================

-- 1) Numéro de téléphone des adhérents (pour les SMS)
alter table public.profils add column if not exists telephone text;

-- 2) Annonces du bureau (réunions, informations…)
create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  corps text not null,
  cible text not null default 'tous',   -- 'tous' | 'ajour' | 'retard'
  auteur_nom text,
  cree_le timestamptz not null default now()
);
alter table public.annonces add column if not exists date_evenement timestamptz;

alter table public.annonces enable row level security;

-- Tout membre connecté peut lire les annonces.
drop policy if exists annonces_select_auth on public.annonces;
create policy annonces_select_auth on public.annonces
  for select using (auth.uid() is not null);

-- Seul le bureau peut créer / modifier / supprimer.
drop policy if exists annonces_insert_bureau on public.annonces;
create policy annonces_insert_bureau on public.annonces
  for insert with check (public.is_bureau());
drop policy if exists annonces_update_bureau on public.annonces;
create policy annonces_update_bureau on public.annonces
  for update using (public.is_bureau()) with check (public.is_bureau());
drop policy if exists annonces_delete_bureau on public.annonces;
create policy annonces_delete_bureau on public.annonces
  for delete using (public.is_bureau());
