-- ============================================================================
--  TE ORA HAU — RECONNAISSANCE AUTOMATIQUE A L'INSCRIPTION (cas n°1)
-- ============================================================================
--
--  A QUOI CA SERT
--  Quand le comptable a deja enregistre un paiement AVANT que la personne ne
--  s'inscrive sur le site (especes en reunion, virement anticipe), le paiement
--  reste « sans compte relie ». Jusqu'ici, le comptable devait cliquer sur
--  « Relier et debloquer les acces » quand la personne finissait par s'inscrire.
--
--  Ce fichier rend cette liaison AUTOMATIQUE : des qu'une personne s'inscrit,
--  la base cherche un paiement orphelin portant exactement son NOM Prenom
--  (ou Prenom NOM). Si elle en trouve, elle le relie toute seule — et le
--  declencheur des cotisations debloque aussitot l'acces (cotisation validee,
--  echeance a un an). La personne arrive sur son espace deja valide.
--
--  GARDE-FOU HOMONYMES : si un AUTRE compte porte deja exactement le meme
--  nom, aucune liaison automatique — on risquerait de donner l'acces au
--  mauvais. Le paiement reste alors visible dans la bannière « 🔗 » de
--  l'onglet Cotisations, et c'est le comptable qui tranche.
--
--  MODE D'EMPLOI
--   Supabase -> projet te-ora-hau -> SQL Editor -> New query -> coller -> Run.
--
--  SUR : rejouable, aucun DROP TABLE / DELETE / TRUNCATE.
-- ============================================================================

-- Nom « normalise » : minuscules, espaces en trop supprimes. La meme regle
-- que celle de l'onglet Cotisations, pour que les deux tombent d'accord.
create or replace function public.nom_normalise(t text)
returns text language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.relier_cotisations_au_profil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cle_nom_prenom text := public.nom_normalise(coalesce(new.nom,'') || ' ' || coalesce(new.prenom,''));
  cle_prenom_nom text := public.nom_normalise(coalesce(new.prenom,'') || ' ' || coalesce(new.nom,''));
begin
  -- Pas de nom exploitable -> rien a faire.
  if length(trim(coalesce(new.nom,'') || coalesce(new.prenom,''))) = 0 then
    return new;
  end if;

  -- GARDE-FOU : un autre compte porte exactement le meme nom -> on ne relie
  -- rien automatiquement, le comptable tranchera dans l'onglet Cotisations.
  if exists (
    select 1 from public.profils p
    where p.id <> new.id
      and public.nom_normalise(coalesce(p.nom,'') || ' ' || coalesce(p.prenom,'')) = cle_nom_prenom
  ) then
    return new;
  end if;

  -- Relie tous les paiements orphelins a ce nom (les deux ordres d'ecriture).
  -- Cette mise a jour declenche trg_appliquer_cotisation, qui valide la
  -- cotisation et ouvre l'acces — c'est la reconnaissance automatique.
  update public.cotisations c
    set profil_id = new.id
  where c.profil_id is null
    and public.nom_normalise(c.nom) in (cle_nom_prenom, cle_prenom_nom);

  return new;
end;
$$;

-- A l'inscription (insert par handle_new_user), et aussi si la personne
-- corrige son nom/prenom ensuite dans « Mon profil ».
drop trigger if exists trg_relier_cotisations on public.profils;
create trigger trg_relier_cotisations
  after insert or update of nom, prenom on public.profils
  for each row execute function public.relier_cotisations_au_profil();

-- ---------- Rattrapage immediat ----------
-- Relie des maintenant les paiements orphelins dont le nom correspond a UN
-- SEUL compte deja inscrit (meme garde-fou homonymes).
update public.cotisations c
  set profil_id = seul.id
from (
  select public.nom_normalise(coalesce(p.nom,'') || ' ' || coalesce(p.prenom,'')) as cle,
         min(public.nom_normalise(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,''))) as cle2,
         (array_agg(p.id))[1] as id
  from public.profils p
  group by 1
  having count(*) = 1
) seul
where c.profil_id is null
  and public.nom_normalise(c.nom) in (seul.cle, seul.cle2);
