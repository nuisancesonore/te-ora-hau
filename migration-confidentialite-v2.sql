-- HISTORIQUE : ne pas réappliquer sur la base actuelle. Voir FINALISATION-V2.md.
-- Te Ora Hau : réduction des données publiques.
-- A appliquer dans Supabase après la sauvegarde administrateur.
-- Transaction : toute erreur annule la migration. Aucune donnée supprimée.
begin;

-- Le détail des dossiers appartient à son auteur et au bureau.
-- La politique restrictive s'ajoute aux politiques existantes et les limite.
drop policy if exists signalements_confidentialite_v2 on public.signalements;
create policy signalements_confidentialite_v2 on public.signalements
as restrictive for select to anon, authenticated
using (auteur = (select auth.uid()) or public.is_bureau());

-- Même signature que la vue précédente pour préserver les consommateurs.
-- Vue propriétaire volontaire : la projection publique ne contient ni texte
-- libre, ni adresse, ni auteur. Position arrondie au centième de degré.
create or replace view public.signalements_publics
with (security_barrier = true) as
select
  s.id, s.type, s.commune, null::text as quartier, s.intensite,
  null::text as horaire, null::text as recurrence, null::text as constat,
  null::text as debut, null::text as adresse_source, null::text as description,
  round(s.lat::numeric, 2)::double precision as lat,
  round(s.lng::numeric, 2)::double precision as lng, s.cree_le
from public.signalements s;
revoke all on public.signalements_publics from public, anon, authenticated;
grant select on public.signalements_publics to anon, authenticated;

-- La carte des membres conserve les détails prévus, sans adresse du
-- plaignant ni identité de l'auteur. Le contrôle est exécuté côté serveur.
create or replace view public.signalements_membres
with (security_barrier = true) as
select
  s.id, s.type, s.commune, s.quartier, s.intensite, s.horaire, s.recurrence,
  s.constat, s.debut, s.adresse_source, s.description, s.lat, s.lng, s.cree_le
from public.signalements s
where (select auth.uid()) is not null
and (
  public.is_bureau()
  or exists (
    select 1 from public.profils p
    where p.id = (select auth.uid())
      and p.cotisation_payee
      and (p.cotisation_echeance is null or p.cotisation_echeance >= (now() at time zone 'Pacific/Tahiti')::date)
  )
);
revoke all on public.signalements_membres from public, anon, authenticated;
grant select on public.signalements_membres to authenticated;

-- Journal privé : le bureau peut consulter un dossier pour son suivi.
drop policy if exists journal_select_bureau_v2 on public.journal_bruit;
create policy journal_select_bureau_v2 on public.journal_bruit
for select to authenticated using (public.is_bureau());

notify pgrst, 'reload schema';
commit;

-- Contrôles à exécuter ensuite :
-- 1. anon : description/adresse_source/quartier NULL, coordonnées arrondies.
-- 2. anon : signalements_membres inaccessible.
-- 3. membre non validé : signalements_membres vide.
-- 4. membre validé : détail de carte accessible, dossier privé d'autrui absent.
-- 5. bureau : accès aux dossiers conservé.
