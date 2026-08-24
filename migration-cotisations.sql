-- ============================================================================
--  TE ORA HAU — REGISTRE DES COTISATIONS RELIE AU SITE
-- ============================================================================
--
--  A QUOI CA SERT
--  Le bureau tenait deux choses en parallele : un outil local de compta des
--  cotisations (montant, mode, date) et la validation manuelle des acces dans
--  l'Admin du site. Ce fichier cree le registre EN LIGNE : chaque paiement
--  enregistre pour un adherent identifie debloque AUTOMATIQUEMENT son acces
--  au site (cotisation validee, echeance a un an). Plus de double saisie.
--
--  MODE D'EMPLOI
--   Supabase -> projet te-ora-hau -> SQL Editor -> New query -> coller -> Run.
--
--  SUR : rejouable, aucun DROP TABLE / DELETE / TRUNCATE. Reserve au bureau
--  par RLS : ni les adherents ni les visiteurs ne voient ce registre.
-- ============================================================================

-- ---------- 1) Le registre ----------
create table if not exists public.cotisations (
  id uuid primary key default gen_random_uuid(),
  -- L'adherent concerne, s'il a un compte sur le site. « on delete set null » :
  -- supprimer un compte n'efface jamais une ligne de comptabilite.
  profil_id uuid references public.profils(id) on delete set null,
  -- Le nom tel qu'ecrit dans le registre (conserve meme sans compte relie,
  -- pour les paiements en especes de personnes pas encore inscrites).
  nom text not null,
  montant integer not null check (montant >= 0),
  mode text not null default 'Espèces',           -- Espèces / Chèque / Virement
  ref text not null default '',                   -- n° de cheque / banque
  note text not null default '',
  date_paiement date not null default current_date,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id) on delete set null
);
create index if not exists cotisations_profil_idx on public.cotisations(profil_id);
create index if not exists cotisations_date_idx on public.cotisations(date_paiement);

-- ---------- 2) Reserve au bureau ----------
alter table public.cotisations enable row level security;
drop policy if exists cotisations_bureau on public.cotisations;
create policy cotisations_bureau on public.cotisations
  for all using (public.is_bureau()) with check (public.is_bureau());

-- ---------- 3) Le deblocage automatique ----------
-- Des qu'un paiement est enregistre (ou relie) a un adherent, son acces
-- s'ouvre : cotisation validee, echeance un an apres le paiement.
-- Renouvellement anticipe : si l'echeance actuelle court encore, on ajoute
-- un an A L'ECHEANCE (l'adherent ne perd pas les jours deja payes).
-- La suppression d'une ligne ne retire JAMAIS un acces automatiquement :
-- c'est une correction comptable, pas une radiation (le bureau garde la main
-- via l'Admin s'il faut vraiment fermer un acces).
create or replace function public.appliquer_cotisation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profil_id is not null then
    -- Echeance calculee :
    --  - renouvellement anticipe (echeance encore valable) -> echeance + 1 an,
    --    l'adherent ne perd pas les jours deja payes ;
    --  - sinon -> date du paiement + 1 an.
    -- Ce calcul ne peut jamais raccourcir une echeance existante.
    update public.profils p
      set cotisation_payee = true,
          cotisation_echeance = case
            when p.cotisation_echeance is not null
                 and p.cotisation_echeance > new.date_paiement
              then (p.cotisation_echeance + interval '1 year')::date
            else (new.date_paiement + interval '1 year')::date
          end
    where p.id = new.profil_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_appliquer_cotisation on public.cotisations;
create trigger trg_appliquer_cotisation
  after insert or update of profil_id, date_paiement on public.cotisations
  for each row execute function public.appliquer_cotisation();
