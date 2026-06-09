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

-- ---------- 5) Validation de cotisation réservée au bureau ----------
-- Un adhérent ne peut pas se "valider" lui-même : seuls les membres du
-- bureau peuvent modifier cotisation_payee, cotisation_echeance et role.
create or replace function public.protege_cotisation()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nul = éditeur SQL / service_role / cron → opérations d'admin autorisées.
  if auth.uid() is not null and not public.is_bureau() then
    new.cotisation_payee    := old.cotisation_payee;
    new.cotisation_echeance := old.cotisation_echeance;
    new.role                := old.role;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protege_cotisation on public.profils;
create trigger trg_protege_cotisation
  before update on public.profils
  for each row execute function public.protege_cotisation();

-- ---------- 6) Le bureau = liste blanche d'e-mails (membres actifs) ----------
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

create or replace function public.is_bureau()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from auth.users u
    join public.bureau_emails b on lower(u.email) = lower(b.email)
    where u.id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

update public.profils set role = 'bureau'
  where lower(email) in (select lower(email) from public.bureau_emails);
update public.profils set role = 'membre'
  where lower(email) not in (select lower(email) from public.bureau_emails) and role = 'bureau';

-- ============================================================
-- TERMINÉ. Rechargez le site (Ctrl+F5) après exécution.
-- ============================================================
