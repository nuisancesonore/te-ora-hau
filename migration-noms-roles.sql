-- ============================================================
-- Te Ora Hau — Nom/prénom séparés + statut par e-mail
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================

-- 1) Prénom séparé (le champ "nom" garde le NOM de famille)
alter table public.profils add column if not exists prenom text;

-- 2) Liste blanche des e-mails ASSESSEURS (à compléter quand vous aurez les e-mails)
create table if not exists public.assesseur_emails (email text primary key);
-- Exemple : insert into public.assesseur_emails (email) values ('prenom.nom@exemple.pf');

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
  insert into public.profils (id, nom, prenom, email, commune, role, type_adhesion)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'commune', ''),
    v_role, v_type
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
