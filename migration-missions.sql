-- ============================================================
-- Te Ora Hau — Missions confiées aux assesseurs
-- Le bureau crée des missions (assignées à un assesseur précis, ou
-- ouvertes à tous : le premier qui la prend se l'attribue).
-- Les assesseurs suivent leurs missions (états + commentaires) ;
-- le bureau voit tout l'avancement.
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================

-- L'utilisateur courant est-il assesseur ? (e-mail dans la liste blanche)
create or replace function public.is_assesseur()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from auth.users u
    join public.assesseur_emails a on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
  );
$$;

-- ---------- Missions ----------
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  assigne_a uuid references auth.users(id) on delete set null,  -- null = ouverte à tous
  statut text not null default 'À faire',   -- À faire / En cours / Terminée / Abandonnée
  echeance date,
  cree_par_nom text,
  cree_le timestamptz not null default now()
);
alter table public.missions enable row level security;

drop policy if exists missions_select on public.missions;
create policy missions_select on public.missions
  for select using (public.is_bureau() or public.is_assesseur());

drop policy if exists missions_insert_bureau on public.missions;
create policy missions_insert_bureau on public.missions
  for insert with check (public.is_bureau());

-- Le bureau modifie tout ; un assesseur peut prendre une mission ouverte
-- ou mettre à jour celles qui lui sont assignées.
drop policy if exists missions_update on public.missions;
create policy missions_update on public.missions
  for update using (
    public.is_bureau()
    or (public.is_assesseur() and (assigne_a = auth.uid() or assigne_a is null))
  ) with check (
    public.is_bureau()
    or (public.is_assesseur() and assigne_a = auth.uid())
  );

drop policy if exists missions_delete_bureau on public.missions;
create policy missions_delete_bureau on public.missions
  for delete using (public.is_bureau());

-- ---------- Commentaires de suivi ----------
create table if not exists public.missions_commentaires (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  auteur uuid references auth.users(id) on delete set null,
  auteur_nom text,
  texte text not null,
  cree_le timestamptz not null default now()
);
alter table public.missions_commentaires enable row level security;

drop policy if exists mcom_select on public.missions_commentaires;
create policy mcom_select on public.missions_commentaires
  for select using (public.is_bureau() or public.is_assesseur());

drop policy if exists mcom_insert on public.missions_commentaires;
create policy mcom_insert on public.missions_commentaires
  for insert with check ((public.is_bureau() or public.is_assesseur()) and auteur = auth.uid());
