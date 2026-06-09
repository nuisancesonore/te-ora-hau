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
