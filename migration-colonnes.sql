-- ============================================================
-- Te Ora Hau — Migration : colonnes manquantes
-- À coller dans Supabase → SQL Editor → New query → Run.
-- 100 % sans risque : "if not exists" ignore une colonne déjà présente,
-- rien n'est supprimé ni écrasé.
-- ============================================================

-- Signalements : démarche (constat) et mois de début des nuisances
alter table public.signalements add column if not exists constat text;
alter table public.signalements add column if not exists debut text;

-- Profils : type d'adhésion, date de naissance, adresse
alter table public.profils add column if not exists type_adhesion text;
alter table public.profils add column if not exists date_naissance date;
alter table public.profils add column if not exists adresse text;

-- Vérification : liste les colonnes après migration
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('signalements', 'profils')
  and column_name in ('constat', 'debut', 'type_adhesion', 'date_naissance', 'adresse')
order by table_name, column_name;
