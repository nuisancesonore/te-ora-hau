-- Complément de confidentialité après sécurisation des cartes et des rôles.
-- Aucune donnée métier modifiée ou supprimée.
CREATE OR REPLACE FUNCTION toh_private.annuaire_membres()
RETURNS TABLE(id uuid,nom text,prenom text,commune text,type_nuisance text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
SELECT p.id,p.nom,p.prenom,p.commune,p.type_nuisance FROM public.profils p
WHERE auth.uid() IS NOT NULL AND toh_private.membre_valide()
AND p.annuaire_optin AND NOT coalesce(p.acces_suspendu,false)
$$;
REVOKE ALL ON FUNCTION toh_private.annuaire_membres() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION toh_private.annuaire_membres() TO authenticated;
CREATE OR REPLACE VIEW public.annuaire_membres WITH(security_invoker=true) AS
SELECT * FROM toh_private.annuaire_membres();
REVOKE ALL ON public.annuaire_membres FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.annuaire_membres TO authenticated;
-- Les profils complets restent accessibles uniquement au titulaire et au bureau.
ALTER POLICY profils_select_annuaire ON public.profils TO authenticated USING(false);
-- Les restrictions complètent les règles existantes par rôle et propriétaire.
DROP POLICY IF EXISTS forum_membres_valides ON public.forum_messages;
CREATE POLICY forum_membres_valides ON public.forum_messages AS RESTRICTIVE
FOR ALL TO authenticated USING(toh_private.membre_valide()) WITH CHECK(toh_private.membre_valide());
DROP POLICY IF EXISTS missions_membres_valides ON public.missions;
CREATE POLICY missions_membres_valides ON public.missions AS RESTRICTIVE
FOR ALL TO authenticated USING(toh_private.membre_valide()) WITH CHECK(toh_private.membre_valide());
DROP POLICY IF EXISTS commentaires_membres_valides ON public.missions_commentaires;
CREATE POLICY commentaires_membres_valides ON public.missions_commentaires AS RESTRICTIVE
FOR ALL TO authenticated USING(toh_private.membre_valide()) WITH CHECK(toh_private.membre_valide());
-- Le bureau doit pouvoir lire le journal lors de la préparation du PDF.
DROP POLICY IF EXISTS journal_select_bureau_v2 ON public.journal_bruit;
CREATE POLICY journal_select_bureau_v2 ON public.journal_bruit FOR SELECT TO authenticated
USING(toh_private.is_bureau());
-- Réactivation des notifications sur le même compte (upsert existant).
DROP POLICY IF EXISTS push_own_update ON public.push_subscriptions;
CREATE POLICY push_own_update ON public.push_subscriptions FOR UPDATE TO authenticated
USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
NOTIFY pgrst,'reload schema';

-- Export cohérent des données applicatives, réservé au bureau côté serveur.
-- Ne remplace PAS une sauvegarde PostgreSQL : auth, fichiers Storage,
-- fonctions, politiques, secrets et schéma ne sont pas inclus.
create or replace function public.export_sauvegarde_application()
returns jsonb language plpgsql security invoker stable
set search_path = ''
as $$
declare
  nom_table text;
  contenu jsonb;
  tables_exportees jsonb := '{}'::jsonb;
  volumes jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not public.is_bureau() then
    raise exception 'Réservé au bureau' using errcode = '42501';
  end if;
  foreach nom_table in array array[
    'profils','signalements','journal_bruit','demarches','forum_messages',
    'missions','missions_commentaires','annonces','messages_contact','cotisations'
  ] loop
    if to_regclass(format('public.%I',nom_table)) is null then
      raise exception 'Table attendue absente : %',nom_table;
    end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t',nom_table)
      into contenu;
    tables_exportees := tables_exportees || jsonb_build_object(nom_table,contenu);
    volumes := volumes || jsonb_build_object(nom_table,jsonb_array_length(contenu));
  end loop;
  return jsonb_build_object(
    'format','te-ora-hau-donnees-v1',
    'cree_le',now(),
    'tables',tables_exportees,
    'volumes',volumes,
    'limites',jsonb_build_array(
      'Comptes et mots de passe Supabase Auth exclus',
      'Fichiers Storage, abonnements push et secrets exclus',
      'Schema, fonctions, politiques et listes techniques de roles exclus',
      'Restauration a effectuer par un administrateur, aucun import automatique'
    )
  );
end;
$$;
revoke all on function public.export_sauvegarde_application() from public, anon, authenticated;
grant execute on function public.export_sauvegarde_application() to authenticated;
notify pgrst, 'reload schema';
