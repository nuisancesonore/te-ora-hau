-- ============================================================================
--  TE ORA HAU — RECONSTRUCTION COMPLETE DE LA BASE
-- ============================================================================
--
--  A QUOI CA SERT
--  Recreer d'un seul coup toute la STRUCTURE de la base sur un projet Supabase
--  neuf, apres la disparition du projet d'origine (alaesbkvfprgpngrowbt).
--
--  CE QUE CA NE FAIT PAS
--  Cela ne restaure AUCUNE donnee : adherents, cotisations, signalements et
--  messages du forum ne sont pas dans ce fichier. Seule la structure revient.
--
--  MODE D'EMPLOI
--   1. Supabase -> votre projet -> SQL Editor -> New query
--   2. Coller TOUT ce fichier, puis Run
--   3. Reporter l'URL et la cle "publishable" du projet dans js/config.js
--   4. Remettre la ligne du projet dans .github/workflows/keep-alive.yml
--   5. Authentication -> URL Configuration : ajouter
--      https://nuisancesonore.github.io/te-ora-hau/
--      (sinon les liens de reinitialisation de mot de passe ne marcheront pas)
--   6. Se creer un compte sur le site, puis se donner le role bureau :
--      update public.profils set role = 'bureau' where id = (
--        select id from auth.users where email = 'VOTRE@EMAIL' );
--
--  SUR : rejouable autant de fois que voulu. Aucun DROP TABLE, aucun DELETE,
--  aucun TRUNCATE. Tables et colonnes sont creees "if not exists" ; policies
--  et triggers sont supprimes puis recrees a l'identique.
--
--  Genere le 23/08/2026 a partir des 17 fichiers du depot, dans l'ordre chronologique
--  de leur creation (dependances respectees).
-- ============================================================================


-- ============================================================================
-- ETAPE 1/17 — Socle : tables, RLS, creation automatique du profil a l'inscription
-- (source : supabase-setup.sql)
-- ============================================================================

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

-- ============================================================================
-- ETAPE 2/17 — Colonnes complementaires des signalements et des profils
-- (source : migration-colonnes.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Migration : colonnes manquantes
-- À coller dans Supabase → SQL Editor → New query → Run.
-- 100 % sans risque : "if not exists" ignore une colonne déjà présente,
-- rien n'est supprimé ni écrasé.
-- ============================================================

-- Signalements : démarche (constat) et mois de début des nuisances
alter table public.signalements add column if not exists constat text;
alter table public.signalements add column if not exists debut text;

-- Profils : type d'adhésion, date de naissance, adresse
alter table public.profils add column if not exists type_adhesion text;
alter table public.profils add column if not exists date_naissance date;
alter table public.profils add column if not exists adresse text;

-- Vérification : liste les colonnes après migration
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('signalements', 'profils')
  and column_name in ('constat', 'debut', 'type_adhesion', 'date_naissance', 'adresse')
order by table_name, column_name;

-- ============================================================================
-- ETAPE 3/17 — Rappels de cotisation (anti-doublon)
-- (source : migration-rappels.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Rappels de cotisation par e-mail
-- Colonnes qui mémorisent l'échéance pour laquelle un rappel a déjà
-- été envoyé, afin de ne pas renvoyer le même rappel chaque jour.
-- À coller dans Supabase → SQL Editor → Run. Sans risque (if not exists).
-- ============================================================

alter table public.profils add column if not exists rappel_60j_pour date;  -- rappel "2 mois avant" déjà envoyé pour cette échéance
alter table public.profils add column if not exists rappel_30j_pour date;  -- rappel "1 mois avant" déjà envoyé pour cette échéance

-- ============================================================================
-- ETAPE 4/17 — Vue publique de la carte (sans donnees personnelles)
-- (source : migration-carte-publique.sql)
-- ============================================================================

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

-- ============================================================================
-- ETAPE 5/17 — Formulaire de contact
-- (source : migration-contact.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Messages de contact
-- Stocke les messages du formulaire de contact. Le bureau les consulte
-- dans le tableau de bord admin. À coller dans Supabase → SQL Editor → Run.
-- ============================================================

create table if not exists public.messages_contact (
  id uuid primary key default gen_random_uuid(),
  nom text,
  prenom text,
  commune text,
  email text,
  sujet text,
  message text not null,
  traite boolean not null default false,
  cree_le timestamptz not null default now()
);

alter table public.messages_contact enable row level security;

-- N'importe qui (même non connecté) peut envoyer un message.
drop policy if exists contact_insert_public on public.messages_contact;
create policy contact_insert_public on public.messages_contact
  for insert with check (true);

-- Seul le bureau peut lire les messages…
drop policy if exists contact_select_bureau on public.messages_contact;
create policy contact_select_bureau on public.messages_contact
  for select using (public.is_bureau());

-- …et les marquer comme traités.
drop policy if exists contact_update_bureau on public.messages_contact;
create policy contact_update_bureau on public.messages_contact
  for update using (public.is_bureau()) with check (public.is_bureau());

-- ============================================================================
-- ETAPE 6/17 — Membres du bureau et droits d'administration
-- (source : migration-bureau.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Le bureau = liste blanche d'e-mails
-- SEULS ces e-mails (membres actifs de l'association) sont reconnus comme
-- "bureau" : eux seuls peuvent valider une adhésion, voir les adhérents et
-- les messages de contact. À coller dans Supabase → SQL Editor → Run.
-- ============================================================

-- 1) Liste blanche des e-mails du bureau
create table if not exists public.bureau_emails (
  email text primary key
);

insert into public.bureau_emails (email) values
  ('contact@teorahau.net'),
  ('lindamaeatematua@gmail.com'),
  ('ariiteab@yahoo.fr'),
  ('terupe@gmail.com'),
  ('hinapumaire.mahuta@gmail.com'),
  ('jbhauata3@gmail.com'),
  ('charlotte.moritz@laposte.net')
on conflict (email) do nothing;

-- 2) is_bureau() : vrai uniquement si l'e-mail de l'utilisateur connecté
--    figure dans la liste blanche (source de vérité de la sécurité).
create or replace function public.is_bureau()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from auth.users u
    join public.bureau_emails b on lower(u.email) = lower(b.email)
    where u.id = auth.uid()
  );
$$;

-- 3) Attribution automatique du rôle "bureau" à l'inscription si l'e-mail
--    est dans la liste blanche (sinon "membre"). Sert à l'affichage (menu Admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
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

-- 4) Met à jour les comptes déjà existants : bureau pour les e-mails listés,
--    "membre" pour tous les autres (révoque un éventuel rôle bureau usurpé).
update public.profils set role = 'bureau'
  where lower(email) in (select lower(email) from public.bureau_emails);
update public.profils set role = 'membre'
  where lower(email) not in (select lower(email) from public.bureau_emails)
    and role = 'bureau';

-- ============================================================================
-- ETAPE 7/17 — Protection : un adherent ne peut pas valider sa propre cotisation
-- (source : migration-securite-cotisation.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Validation réservée au bureau
-- Empêche un adhérent de se "valider" lui-même : seuls les membres du
-- bureau peuvent modifier cotisation_payee, cotisation_echeance et role.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

create or replace function public.protege_cotisation()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Si un utilisateur connecté (non bureau) tente de modifier ces champs, on
  -- rétablit les valeurs d'origine. Quand auth.uid() est nul (éditeur SQL,
  -- clé service_role, cron), on laisse passer : ce sont des opérations d'admin.
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

-- ============================================================================
-- ETAPE 8/17 — Annonces + telephone des adherents
-- (source : migration-communication.sql)
-- ============================================================================

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

-- ============================================================================
-- ETAPE 9/17 — Date d'evenement sur les annonces (depend de la table annonces)
-- (source : migration-annonce-date.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Date/heure d'événement sur les annonces
-- Permet à une annonce de "clignoter" jusqu'à la date, puis d'expirer.
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================
alter table public.annonces add column if not exists date_evenement timestamptz;

-- ============================================================================
-- ETAPE 10/17 — Abonnements aux notifications push
-- (source : migration-push.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Notifications push (abonnements des appareils)
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  cree_le timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- Chaque membre gère uniquement ses propres abonnements.
drop policy if exists push_own_insert on public.push_subscriptions;
create policy push_own_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
drop policy if exists push_own_update on public.push_subscriptions;
create policy push_own_update on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());
drop policy if exists push_own_select on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions
  for select using (user_id = auth.uid());
-- (La fonction d'envoi utilise la clé service_role et lit tous les abonnements.)

-- ============================================================================
-- ETAPE 11/17 — Suivi des demarches des adherents
-- (source : migration-demarches.sql)
-- ============================================================================

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

-- ============================================================================
-- ETAPE 12/17 — Missions confiees aux assesseurs
-- (source : migration-missions.sql)
-- ============================================================================

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

-- ============================================================================
-- ETAPE 13/17 — Separation nom / prenom et roles
-- (source : migration-noms-roles.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Nom/prénom séparés + statut par e-mail
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================

-- 1) Prénom séparé (le champ "nom" garde le NOM de famille)
alter table public.profils add column if not exists prenom text;

-- 2) Liste blanche des e-mails ASSESSEURS (liste complète)
create table if not exists public.assesseur_emails (email text primary key);
insert into public.assesseur_emails (email) values
  ('b2b99t@gmail.com'),           -- Bill DE BRATH (Paea)
  ('belleileric@gmail.com'),      -- Éric BELLEIL (Puurai, Faa'a)
  ('richstan11@outlook.com'),     -- Brigitte RICHMOND (Tautira)
  ('giserch@gmail.com'),          -- Gisèle ROCHE (Faa'a)
  ('patvongue@yahoo.com')         -- Patrick VONGUE (Rés. Menahere, Pirae)
on conflict (email) do nothing;

-- 3) À l'inscription : statut (rôle + type) attribué automatiquement selon l'e-mail
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text; v_type text;
begin
  if exists (select 1 from public.bureau_emails b where lower(b.email) = lower(new.email)) then
    v_role := 'bureau'; v_type := 'Bureau';
  elsif exists (select 1 from public.assesseur_emails a where lower(a.email) = lower(new.email)) then
    v_role := 'membre'; v_type := 'Assesseur';
  else
    v_role := 'membre'; v_type := 'Adhérent';
  end if;
  insert into public.profils (id, nom, prenom, email, commune, role, type_adhesion,
                              date_naissance, adresse, telephone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'commune', ''),
    v_role, v_type,
    nullif(new.raw_user_meta_data->>'date_naissance', '')::date,
    coalesce(new.raw_user_meta_data->>'adresse', ''),
    coalesce(new.raw_user_meta_data->>'telephone', '')
  );
  return new;
end;
$$;

-- 4) Met à jour les comptes existants (rôle + type selon les listes blanches)
update public.profils p set
  role = case when lower(p.email) in (select lower(email) from public.bureau_emails) then 'bureau' else 'membre' end,
  type_adhesion = case
    when lower(p.email) in (select lower(email) from public.bureau_emails) then 'Bureau'
    when lower(p.email) in (select lower(email) from public.assesseur_emails) then 'Assesseur'
    else 'Adhérent' end;

-- ============================================================================
-- ETAPE 14/17 — Preuves jointes aux signalements
-- (source : migration-preuves.sql)
-- ============================================================================

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

-- ============================================================================
-- ETAPE 15/17 — Dossiers des adherents
-- (source : migration-dossiers.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Champs « fichier dossiers » (export Excel enrichi)
-- Auteur présumé du bruit, nombre de personnes du foyer gênées,
-- île de résidence. À coller dans Supabase → SQL Editor → Run.
-- ============================================================
alter table public.signalements add column if not exists auteur_presume text;
alter table public.signalements add column if not exists personnes_foyer int;
alter table public.profils add column if not exists ile text;

-- L'inscription crée le profil avec l'île également.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text; v_type text;
begin
  if exists (select 1 from public.bureau_emails b where lower(b.email) = lower(new.email)) then
    v_role := 'bureau'; v_type := 'Bureau';
  elsif exists (select 1 from public.assesseur_emails a where lower(a.email) = lower(new.email)) then
    v_role := 'membre'; v_type := 'Assesseur';
  else
    v_role := 'membre'; v_type := 'Adhérent';
  end if;
  insert into public.profils (id, nom, prenom, email, commune, role, type_adhesion,
                              date_naissance, adresse, telephone, ile)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'commune', ''),
    v_role, v_type,
    nullif(new.raw_user_meta_data->>'date_naissance', '')::date,
    coalesce(new.raw_user_meta_data->>'adresse', ''),
    coalesce(new.raw_user_meta_data->>'telephone', ''),
    coalesce(new.raw_user_meta_data->>'ile', '')
  );
  return new;
end;
$$;

-- ============================================================================
-- ETAPE 16/17 — Missions internes au bureau
-- (source : migration-missions-bureau.sql)
-- ============================================================================

-- ============================================================
-- Te Ora Hau — Missions internes au bureau
-- Une mission peut viser les assesseurs (défaut) ou le bureau (interne).
-- Les assesseurs ne voient JAMAIS les missions « bureau ».
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================
alter table public.missions add column if not exists pour text not null default 'assesseurs';

-- Lecture : le bureau voit tout ; un assesseur ne voit que les missions « assesseurs ».
drop policy if exists missions_select on public.missions;
create policy missions_select on public.missions
  for select using (
    public.is_bureau()
    or (public.is_assesseur() and pour = 'assesseurs')
  );

-- Mise à jour : bureau = tout ; assesseur = prendre/MAJ une mission « assesseurs »
-- ouverte ou qui lui est assignée.
drop policy if exists missions_update on public.missions;
create policy missions_update on public.missions
  for update using (
    public.is_bureau()
    or (public.is_assesseur() and pour = 'assesseurs' and (assigne_a = auth.uid() or assigne_a is null))
  ) with check (
    public.is_bureau()
    or (public.is_assesseur() and pour = 'assesseurs' and assigne_a = auth.uid())
  );

-- Commentaires : un assesseur ne peut lire/écrire que sur les missions « assesseurs ».
drop policy if exists mcom_select on public.missions_commentaires;
create policy mcom_select on public.missions_commentaires
  for select using (
    public.is_bureau()
    or (public.is_assesseur() and exists (
      select 1 from public.missions m where m.id = mission_id and m.pour = 'assesseurs'))
  );

drop policy if exists mcom_insert on public.missions_commentaires;
create policy mcom_insert on public.missions_commentaires
  for insert with check (
    auteur = auth.uid() and (
      public.is_bureau()
      or (public.is_assesseur() and exists (
        select 1 from public.missions m where m.id = mission_id and m.pour = 'assesseurs'))
    )
  );

-- ============================================================================
-- ETAPE 17/17 — Regroupement final (idempotent, rattrape tout ce qui manquerait)
-- (source : migration-complete.sql)
-- ============================================================================

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

-- ---------- 7) Communication : téléphone + annonces ----------
alter table public.profils add column if not exists telephone text;

create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  corps text not null,
  cible text not null default 'tous',
  auteur_nom text,
  cree_le timestamptz not null default now()
);
alter table public.annonces add column if not exists date_evenement timestamptz;
alter table public.annonces enable row level security;
drop policy if exists annonces_select_auth on public.annonces;
create policy annonces_select_auth on public.annonces
  for select using (auth.uid() is not null);
drop policy if exists annonces_insert_bureau on public.annonces;
create policy annonces_insert_bureau on public.annonces
  for insert with check (public.is_bureau());
drop policy if exists annonces_update_bureau on public.annonces;
create policy annonces_update_bureau on public.annonces
  for update using (public.is_bureau()) with check (public.is_bureau());
drop policy if exists annonces_delete_bureau on public.annonces;
create policy annonces_delete_bureau on public.annonces
  for delete using (public.is_bureau());

-- ---------- 8) Notifications push (abonnements des appareils) ----------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  cree_le timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own_insert on public.push_subscriptions;
create policy push_own_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
drop policy if exists push_own_update on public.push_subscriptions;
create policy push_own_update on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());
drop policy if exists push_own_select on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions
  for select using (user_id = auth.uid());

-- ---------- 9) Nom/prénom séparés + statut par e-mail ----------
alter table public.profils add column if not exists prenom text;
create table if not exists public.assesseur_emails (email text primary key);
insert into public.assesseur_emails (email) values
  ('b2b99t@gmail.com'),           -- Bill DE BRATH (Paea)
  ('belleileric@gmail.com'),      -- Éric BELLEIL (Puurai, Faa'a)
  ('richstan11@outlook.com'),     -- Brigitte RICHMOND (Tautira)
  ('giserch@gmail.com'),          -- Gisèle ROCHE (Faa'a)
  ('patvongue@yahoo.com')         -- Patrick VONGUE (Rés. Menahere, Pirae)
on conflict (email) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text; v_type text;
begin
  if exists (select 1 from public.bureau_emails b where lower(b.email) = lower(new.email)) then
    v_role := 'bureau'; v_type := 'Bureau';
  elsif exists (select 1 from public.assesseur_emails a where lower(a.email) = lower(new.email)) then
    v_role := 'membre'; v_type := 'Assesseur';
  else
    v_role := 'membre'; v_type := 'Adhérent';
  end if;
  insert into public.profils (id, nom, prenom, email, commune, role, type_adhesion,
                              date_naissance, adresse, telephone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'commune', ''),
    v_role, v_type,
    nullif(new.raw_user_meta_data->>'date_naissance', '')::date,
    coalesce(new.raw_user_meta_data->>'adresse', ''),
    coalesce(new.raw_user_meta_data->>'telephone', '')
  );
  return new;
end;
$$;

update public.profils p set
  role = case when lower(p.email) in (select lower(email) from public.bureau_emails) then 'bureau' else 'membre' end,
  type_adhesion = case
    when lower(p.email) in (select lower(email) from public.bureau_emails) then 'Bureau'
    when lower(p.email) in (select lower(email) from public.assesseur_emails) then 'Assesseur'
    else 'Adhérent' end;

-- ---------- 10) Suivi des démarches des adhérents ----------
create table if not exists public.demarches (
  id uuid primary key default gen_random_uuid(),
  auteur uuid not null references auth.users(id) on delete cascade,
  type text not null,
  date_demarche date,
  mode text,
  destinataire text,
  reponse text not null default 'En attente',
  note text,
  cree_le timestamptz not null default now()
);
alter table public.demarches enable row level security;
drop policy if exists demarches_own on public.demarches;
create policy demarches_own on public.demarches
  for all using (auteur = auth.uid()) with check (auteur = auth.uid());
drop policy if exists demarches_select_bureau on public.demarches;
create policy demarches_select_bureau on public.demarches
  for select using (public.is_bureau());

-- ---------- 11) Missions confiées aux assesseurs ----------
create or replace function public.is_assesseur()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from auth.users u
    join public.assesseur_emails a on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
  );
$$;

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  assigne_a uuid references auth.users(id) on delete set null,
  statut text not null default 'À faire',
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
-- Colonne « pour » : missions destinées aux assesseurs (défaut) ou au bureau.
alter table public.missions add column if not exists pour text not null default 'assesseurs';

drop policy if exists missions_select on public.missions;
create policy missions_select on public.missions
  for select using (public.is_bureau() or (public.is_assesseur() and pour = 'assesseurs'));

drop policy if exists missions_update on public.missions;
create policy missions_update on public.missions
  for update using (
    public.is_bureau()
    or (public.is_assesseur() and pour = 'assesseurs' and (assigne_a = auth.uid() or assigne_a is null))
  ) with check (
    public.is_bureau()
    or (public.is_assesseur() and pour = 'assesseurs' and assigne_a = auth.uid())
  );

drop policy if exists mcom_select on public.missions_commentaires;
create policy mcom_select on public.missions_commentaires
  for select using (
    public.is_bureau()
    or (public.is_assesseur() and exists (
      select 1 from public.missions m where m.id = mission_id and m.pour = 'assesseurs'))
  );

drop policy if exists mcom_insert on public.missions_commentaires;
create policy mcom_insert on public.missions_commentaires
  for insert with check (
    auteur = auth.uid() and (
      public.is_bureau()
      or (public.is_assesseur() and exists (
        select 1 from public.missions m where m.id = mission_id and m.pour = 'assesseurs'))
    )
  );

-- ---------- 12) Renforcement du dossier des signalements ----------
alter table public.signalements add column if not exists horaire_detail text;
alter table public.signalements add column if not exists voisins_genes boolean not null default false;
alter table public.signalements add column if not exists preuves text;

create or replace view public.signalements_publics as
select
  id, type, commune, quartier, intensite, horaire, recurrence,
  constat, debut, adresse_source, description, lat, lng, cree_le,
  horaire_detail
from public.signalements;
grant select on public.signalements_publics to anon, authenticated;

-- ---------- 13) Champs « fichier dossiers » (export enrichi) ----------
alter table public.signalements add column if not exists auteur_presume text;
alter table public.signalements add column if not exists personnes_foyer int;
alter table public.profils add column if not exists ile text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text; v_type text;
begin
  if exists (select 1 from public.bureau_emails b where lower(b.email) = lower(new.email)) then
    v_role := 'bureau'; v_type := 'Bureau';
  elsif exists (select 1 from public.assesseur_emails a where lower(a.email) = lower(new.email)) then
    v_role := 'membre'; v_type := 'Assesseur';
  else
    v_role := 'membre'; v_type := 'Adhérent';
  end if;
  insert into public.profils (id, nom, prenom, email, commune, role, type_adhesion,
                              date_naissance, adresse, telephone, ile)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'commune', ''),
    v_role, v_type,
    nullif(new.raw_user_meta_data->>'date_naissance', '')::date,
    coalesce(new.raw_user_meta_data->>'adresse', ''),
    coalesce(new.raw_user_meta_data->>'telephone', ''),
    coalesce(new.raw_user_meta_data->>'ile', '')
  );
  return new;
end;
$$;

-- ============================================================
-- TERMINÉ. Rechargez le site (Ctrl+F5) après exécution.
-- ============================================================
