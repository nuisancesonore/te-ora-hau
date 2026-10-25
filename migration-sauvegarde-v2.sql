-- Export cohérent des données applicatives, réservé au bureau côté serveur.
-- Ne remplace PAS une sauvegarde PostgreSQL : auth, fichiers Storage,
-- fonctions, politiques, secrets et schéma ne sont pas inclus.
begin;
create or replace function public.export_sauvegarde_application()
returns jsonb language plpgsql security definer stable
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
    'missions','missions_commentaires','annonces','messages_contact','cotisations',
    'bureau_emails','assesseur_emails'
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
      'Schema, fonctions et politiques exclus',
      'Restauration a effectuer par un administrateur, aucun import automatique'
    )
  );
end;
$$;
revoke all on function public.export_sauvegarde_application() from public, anon, authenticated;
grant execute on function public.export_sauvegarde_application() to authenticated;
notify pgrst, 'reload schema';
commit;
