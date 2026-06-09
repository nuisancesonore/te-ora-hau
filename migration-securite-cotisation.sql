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
  -- Si l'utilisateur courant n'est pas du bureau, on rétablit les valeurs
  -- d'origine : ses tentatives de modification de ces champs sont ignorées.
  if not public.is_bureau() then
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
