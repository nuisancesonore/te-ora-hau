-- ============================================================
-- Te Ora Hau — Date/heure d'événement sur les annonces
-- Permet à une annonce de "clignoter" jusqu'à la date, puis d'expirer.
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================
alter table public.annonces add column if not exists date_evenement timestamptz;
