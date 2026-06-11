-- ============================================================
-- Te Ora Hau — Suivi des démarches des adhérents
-- Chaque adhérent consigne ses démarches (courrier amiable, mise en
-- demeure, mairie, gendarmerie, plainte…) ; le bureau les consulte
-- pour suivre et appuyer les dossiers.
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================
create table if not exists public.demarches (
  id uuid primary key default gen_random_uuid(),
  auteur uuid not null references auth.users(id) on delete cascade,
  type text not null,                       -- Courrier amiable / Mise en demeure / Demande au Maire / …
  date_demarche date,
  mode text,                                -- Courrier simple / Recommandé A.R. / E-mail / Téléphone / …
  destinataire text,
  reponse text not null default 'En attente',  -- En attente / Réponse reçue / Sans réponse / Résolu
  note text,
  cree_le timestamptz not null default now()
);
alter table public.demarches enable row level security;

-- L'adhérent gère ses propres démarches.
drop policy if exists demarches_own on public.demarches;
create policy demarches_own on public.demarches
  for all using (auteur = auth.uid()) with check (auteur = auth.uid());

-- Le bureau peut les consulter (suivi des dossiers).
drop policy if exists demarches_select_bureau on public.demarches;
create policy demarches_select_bureau on public.demarches
  for select using (public.is_bureau());
