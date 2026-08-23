-- ============================================================================
--  TE ORA HAU — RATTRAPAGE DU 23/08/2026
-- ============================================================================
--
--  POURQUOI
--  Un controle de la base apres sa restauration a montre que deux migrations
--  n'avaient jamais ete appliquees. Rien ne plantait, car le site contient des
--  filets de secours : il retirait silencieusement les champs inconnus et
--  enregistrait quand meme. Consequences invisibles mais reelles :
--
--   1. signalements.auteur_presume et signalements.personnes_foyer manquent.
--      Le formulaire « Signaler une nuisance » demande pourtant l'auteur
--      presume du bruit et le nombre de personnes genees dans le foyer :
--      ces deux reponses etaient PERDUES a chaque envoi.
--
--   2. missions.pour manque, et les politiques RLS des missions ne filtrent
--      donc pas dessus. Les missions declarees « internes au bureau » etaient
--      visibles par tous les assesseurs.
--
--  Ce fichier applique exactement ces deux migrations, rien d'autre.
--
--  MODE D'EMPLOI
--   Supabase -> projet te-ora-hau -> SQL Editor -> New query -> coller -> Run.
--
--  SUR : rejouable autant de fois que voulu. Aucun DROP TABLE, aucun DELETE,
--  aucun TRUNCATE. Colonnes creees « if not exists », policies remplacees a
--  l'identique. Les donnees existantes ne sont pas touchees.
-- ============================================================================


-- ============================================================================
-- Auteur presume + personnes du foyer + ile, et declencheur d'inscription complet
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
-- Missions internes au bureau : colonne « pour » et politiques qui la respectent
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
