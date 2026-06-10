-- ============================================================
-- Te Ora Hau — Notifications push (abonnements des appareils)
-- À coller dans Supabase → SQL Editor → Run. Sans risque.
-- ============================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  cree_le timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- Chaque membre gère uniquement ses propres abonnements.
drop policy if exists push_own_insert on public.push_subscriptions;
create policy push_own_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
drop policy if exists push_own_update on public.push_subscriptions;
create policy push_own_update on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());
drop policy if exists push_own_select on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions
  for select using (user_id = auth.uid());
-- (La fonction d'envoi utilise la clé service_role et lit tous les abonnements.)
