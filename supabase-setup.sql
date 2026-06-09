-- ============================================================
-- Te Ora Hau — schéma de base de données Supabase
-- À exécuter une seule fois dans : Supabase → SQL Editor → New query
-- ============================================================

-- ---------- 1. Table des profils (étend auth.users) ----------
create table if not exists public.profils (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null default '',
  email text,
  commune text default '',
  type_nuisance text default '',
  type_adhesion text,                            -- Adhérent, Assesseur, Sympathisant…
  date_naissance date,                           -- date de naissance de l'adhérent
  adresse text,                                  -- adresse de l'adhérent
  role text not null default 'membre',          -- 'membre' ou 'bureau'
  cotisation_payee boolean not null default false,
  cotisation_echeance date,
  annuaire_optin boolean not null default false,
  cree_le timestamptz not null default now()
);

-- ---------- 2. Signalements de nuisances ----------
create table if not exists public.signalements (
  id uuid primary key default gen_random_uuid(),
  auteur uuid references auth.users(id) on delete set null,
  type text not null,                 -- voisinage, sono voiture, bar, chantier, etc.
  commune text,
  description text,
  intensite text,                     -- faible / moyenne / forte / insupportable
  horaire text,                       -- jour / soir / nuit
  recurrence text,                    -- ponctuel / régulier / permanent
  quartier text,                      -- localité précise (Taravao, Afaahiti…)
  adresse_source text,                -- adresse de la source (auto-remplie)
  adresse_plaignant text,             -- adresse de la personne qui subit
  constat text,                       -- Signalement seul / Constat d'autorité / Constat + plainte
  debut text,                         -- début des nuisances (AAAA-MM)
  lat double precision,
  lng double precision,
  cree_le timestamptz not null default now()
);

-- Mise à jour des bases existantes (idempotent)
alter table public.profils add column if not exists type_adhesion text;
alter table public.profils add column if not exists date_naissance date;
alter table public.profils add column if not exists adresse text;
alter table public.signalements add column if not exists quartier text;
alter table public.signalements add column if not exists constat text;
alter table public.signalements add column if not exists debut text;
alter table public.signalements add column if not exists adresse_source text;
alter table public.signalements add column if not exists adresse_plaignant text;

-- ---------- 3. Journal de bruit personnel ----------
create table if not exists public.journal_bruit (
  id uuid primary key default gen_random_uuid(),
  auteur uuid not null references auth.users(id) on delete cascade,
  date_episode date not null,
  heure text,
  duree_min integer,
  intensite text,
  note text,
  cree_le timestamptz not null default now()
);

-- ---------- 4. Forum des membres ----------
create table if not exists public.forum_messages (
  id uuid primary key default gen_random_uuid(),
  auteur uuid references auth.users(id) on delete set null,
  auteur_nom text not null default 'Membre',
  texte text not null,
  cree_le timestamptz not null default now()
);

-- ============================================================
-- Le bureau = liste blanche d'e-mails (membres actifs habilités à valider).
-- ============================================================
create table if not exists public.bureau_emails (email text primary key);
insert into public.bureau_emails (email) values
  ('contact@teorahau.net'),
  ('lindamaeatematua@gmail.com'),
  ('ariiteab@yahoo.fr'),
  ('terupe@gmail.com'),
  ('hinapumaire.mahuta@gmail.com'),
  ('jbhauata3@gmail.com'),
  ('charlotte.moritz@laposte.net')
on conflict (email) do nothing;

-- ============================================================
-- Fonction d'aide : l'utilisateur courant est-il du bureau ?
-- Vrai uniquement si son e-mail figure dans la liste blanche.
-- SECURITY DEFINER pour éviter la récursion des politiques RLS.
-- ============================================================
create or replace function public.is_bureau()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    join public.bureau_emails b on lower(u.email) = lower(b.email)
    where u.id = auth.uid()
  );
$$;

-- ============================================================
-- Création automatique du profil à l'inscription
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profils (id, nom, email, commune, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'commune', ''),
    case when exists (select 1 from public.bureau_emails b where lower(b.email) = lower(new.email))
         then 'bureau' else 'membre' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Sécurité au niveau des lignes (RLS)
-- ============================================================
alter table public.profils         enable row level security;
alter table public.signalements    enable row level security;
alter table public.journal_bruit   enable row level security;
alter table public.forum_messages  enable row level security;

-- ---- profils ----
drop policy if exists profils_select_self_or_bureau on public.profils;
create policy profils_select_self_or_bureau on public.profils
  for select using (id = auth.uid() or public.is_bureau());

drop policy if exists profils_update_self_or_bureau on public.profils;
create policy profils_update_self_or_bureau on public.profils
  for update using (id = auth.uid() or public.is_bureau());

-- (l'insertion est gérée par le trigger ci-dessus)

-- ---- annuaire : membres ayant accepté d'être visibles ----
drop policy if exists profils_select_annuaire on public.profils;
create policy profils_select_annuaire on public.profils
  for select using (annuaire_optin = true and auth.uid() is not null);

-- ---- signalements ----
drop policy if exists signalements_select_auth on public.signalements;
create policy signalements_select_auth on public.signalements
  for select using (auth.uid() is not null);

drop policy if exists signalements_insert_auth on public.signalements;
create policy signalements_insert_auth on public.signalements
  for insert with check (auth.uid() = auteur);

drop policy if exists signalements_update_owner_bureau on public.signalements;
create policy signalements_update_owner_bureau on public.signalements
  for update using (auteur = auth.uid() or public.is_bureau())
  with check (auteur = auth.uid() or public.is_bureau());

drop policy if exists signalements_delete_owner_bureau on public.signalements;
create policy signalements_delete_owner_bureau on public.signalements
  for delete using (auteur = auth.uid() or public.is_bureau());

-- ---- journal de bruit (privé : propriétaire uniquement) ----
drop policy if exists journal_all_owner on public.journal_bruit;
create policy journal_all_owner on public.journal_bruit
  for all using (auteur = auth.uid()) with check (auteur = auth.uid());

-- ---- forum ----
drop policy if exists forum_select_auth on public.forum_messages;
create policy forum_select_auth on public.forum_messages
  for select using (auth.uid() is not null);

drop policy if exists forum_insert_auth on public.forum_messages;
create policy forum_insert_auth on public.forum_messages
  for insert with check (auth.uid() = auteur);

drop policy if exists forum_delete_owner_bureau on public.forum_messages;
create policy forum_delete_owner_bureau on public.forum_messages
  for delete using (auteur = auth.uid() or public.is_bureau());

-- ============================================================
-- TERMINÉ.
-- Pour devenir membre du bureau (admin) : inscrivez-vous d'abord
-- via le site, puis exécutez (en remplaçant l'e-mail) :
--
--   update public.profils set role = 'bureau'
--   where email = 'vous@exemple.pf';
-- ============================================================
