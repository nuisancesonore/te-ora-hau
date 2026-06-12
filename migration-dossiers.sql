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
