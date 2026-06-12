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
