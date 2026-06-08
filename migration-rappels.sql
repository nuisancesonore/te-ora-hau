-- ============================================================
-- Te Ora Hau — Rappels de cotisation par e-mail
-- Colonnes qui mémorisent l'échéance pour laquelle un rappel a déjà
-- été envoyé, afin de ne pas renvoyer le même rappel chaque jour.
-- À coller dans Supabase → SQL Editor → Run. Sans risque (if not exists).
-- ============================================================

alter table public.profils add column if not exists rappel_60j_pour date;  -- rappel "2 mois avant" déjà envoyé pour cette échéance
alter table public.profils add column if not exists rappel_30j_pour date;  -- rappel "1 mois avant" déjà envoyé pour cette échéance
