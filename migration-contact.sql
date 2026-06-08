-- ============================================================
-- Te Ora Hau — Messages de contact
-- Stocke les messages du formulaire de contact. Le bureau les consulte
-- dans le tableau de bord admin. À coller dans Supabase → SQL Editor → Run.
-- ============================================================

create table if not exists public.messages_contact (
  id uuid primary key default gen_random_uuid(),
  nom text,
  prenom text,
  commune text,
  email text,
  sujet text,
  message text not null,
  traite boolean not null default false,
  cree_le timestamptz not null default now()
);

alter table public.messages_contact enable row level security;

-- N'importe qui (même non connecté) peut envoyer un message.
drop policy if exists contact_insert_public on public.messages_contact;
create policy contact_insert_public on public.messages_contact
  for insert with check (true);

-- Seul le bureau peut lire les messages…
drop policy if exists contact_select_bureau on public.messages_contact;
create policy contact_select_bureau on public.messages_contact
  for select using (public.is_bureau());

-- …et les marquer comme traités.
drop policy if exists contact_update_bureau on public.messages_contact;
create policy contact_update_bureau on public.messages_contact
  for update using (public.is_bureau()) with check (public.is_bureau());
