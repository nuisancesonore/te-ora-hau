-- ============================================================================
--  TE ORA HAU — LE DOSSIER COMME FIL CONDUCTEUR
-- ============================================================================
--
--  POURQUOI
--  Jusqu'ici, un adherent qui subit une nuisance produit trois traces qui ne
--  se connaissent pas : un signalement, des episodes de journal de bruit, et
--  des demarches (courriers, appels). Impossible de reconstituer l'histoire
--  d'un cas, ni de dire « sur 40 signalements, 12 ont donne lieu a un courrier
--  et 3 ont obtenu une reponse ».
--
--  Ce fichier rattache le journal et les demarches a LEUR signalement, et
--  donne au signalement un etat d'avancement. Le signalement devient ainsi le
--  dossier : un cas, sa chronologie, son issue.
--
--  MODE D'EMPLOI
--   Supabase -> projet te-ora-hau -> SQL Editor -> New query -> coller -> Run.
--
--  CE QU'IL FAIT AUX DONNEES EXISTANTES
--  Rien n'est supprime. La section 4 renseigne le rattachement UNIQUEMENT
--  pour les adherents n'ayant qu'un seul signalement, ou il n'y a aucune
--  ambiguite. Les autres choisiront eux-memes depuis la page Outils.
--
--  PREREQUIS : PostgreSQL 15 ou plus (pour « security_invoker » sur la vue).
--  C'est le cas de tout projet Supabase recent.
-- ============================================================================

-- ---------- 1) Rattachement au signalement ----------
-- « on delete set null » : supprimer un signalement ne doit PAS effacer le
-- journal de bruit ni l'historique des demarches, qui gardent leur valeur
-- de preuve. Ils redeviennent simplement non rattaches.
alter table public.journal_bruit
  add column if not exists signalement_id uuid references public.signalements(id) on delete set null;

alter table public.demarches
  add column if not exists signalement_id uuid references public.signalements(id) on delete set null;

-- Lecture rapide d'un dossier (tous les elements rattaches a un signalement).
create index if not exists journal_bruit_signalement_idx on public.journal_bruit(signalement_id);
create index if not exists demarches_signalement_idx on public.demarches(signalement_id);

-- ---------- 2) Etat d'avancement du dossier ----------
-- Ouvert            : signale, rien d'engage
-- En cours          : au moins une demarche engagee
-- Constate          : une autorite est venue constater
-- Resolu            : la nuisance a cesse
-- Classe sans suite : abandonne, ou aucune suite possible
alter table public.signalements
  add column if not exists etat text not null default 'Ouvert';

-- ---------- 3) Vue « dossiers » pour l'exploitation ----------
-- Une ligne par signalement, avec le decompte de ce qui s'y rattache.
--
-- ATTENTION — « security_invoker = true » est INDISPENSABLE. Sans lui, une vue
-- s'execute avec les droits de son proprietaire (postgres) et CONTOURNE le RLS
-- des tables sous-jacentes : n'importe quel adherent connecte lirait alors les
-- signalements de tous les autres, description et adresse comprises.
-- Avec cette option, la vue s'execute avec les droits de celui qui l'interroge :
-- chacun ne voit que ses propres dossiers, le bureau voit ce qu'il a le droit
-- de voir. C'est le RLS des tables qui continue de decider.
drop view if exists public.dossiers;
create view public.dossiers with (security_invoker = true) as
select
  s.id,
  s.auteur,
  s.type,
  s.commune,
  s.quartier,
  s.adresse_source,
  s.auteur_presume,
  s.horaire,
  s.intensite,
  s.recurrence,
  s.constat,
  s.debut,
  s.etat,
  s.description,
  s.personnes_foyer,
  s.voisins_genes,
  s.lat,
  s.lng,
  s.cree_le,
  (select count(*) from public.journal_bruit j where j.signalement_id = s.id) as nb_episodes,
  (select count(*) from public.demarches d where d.signalement_id = s.id)    as nb_demarches,
  (select count(*) from public.demarches d
     where d.signalement_id = s.id and d.reponse = 'Réponse reçue')          as nb_reponses,
  (select max(j.date_episode) from public.journal_bruit j where j.signalement_id = s.id) as dernier_episode,
  (select max(d.date_demarche) from public.demarches d where d.signalement_id = s.id)    as derniere_demarche
from public.signalements s;

grant select on public.dossiers to authenticated;

-- ---------- 4) Rattrapage des donnees deja saisies ----------
-- Uniquement les adherents n'ayant QU'UN SEUL signalement : aucune ambiguite.
-- « (array_agg(id))[1] » plutot que « min(id) » : l'agregat min() n'est pas
-- defini pour le type uuid sur toutes les versions de PostgreSQL.
with un_seul as (
  select auteur, (array_agg(id))[1] as sig_id
  from public.signalements
  group by auteur
  having count(*) = 1
)
update public.journal_bruit j
set signalement_id = u.sig_id
from un_seul u
where j.auteur = u.auteur and j.signalement_id is null;

with un_seul as (
  select auteur, (array_agg(id))[1] as sig_id
  from public.signalements
  group by auteur
  having count(*) = 1
)
update public.demarches d
set signalement_id = u.sig_id
from un_seul u
where d.auteur = u.auteur and d.signalement_id is null;
