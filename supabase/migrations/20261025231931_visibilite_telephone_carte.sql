-- Consentement par signalement, indépendant de l'annuaire et privé par défaut.
-- Le numéro reste dans le profil : une correction du numéro s'applique à la carte.
ALTER TABLE public.signalements
  ADD COLUMN IF NOT EXISTS afficher_telephone boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.signalements.afficher_telephone IS
  'Consentement explicite pour montrer le téléphone du profil aux adhérents validés sur ce signalement. Faux par défaut ; le bureau conserve son accès privé.';

-- Accès délibérément limité à deux champs. SECURITY DEFINER est nécessaire
-- pour lire le téléphone consenti d'un autre profil sans ouvrir profils via RLS.
-- Cette fonction reste dans le schéma privé, avec contrôle du lecteur et du
-- consentement côté serveur ; aucun identifiant d'auteur ou e-mail n'est exposé.
CREATE OR REPLACE FUNCTION toh_private.telephones_carte()
RETURNS TABLE(id uuid, telephone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT s.id, btrim(p.telephone)
  FROM public.signalements s
  JOIN public.profils p ON p.id = s.auteur
  WHERE auth.uid() IS NOT NULL
    AND toh_private.membre_valide()
    AND s.afficher_telephone IS TRUE
    AND NOT coalesce(p.acces_suspendu, false)
    AND nullif(btrim(p.telephone), '') IS NOT NULL
$$;
REVOKE ALL ON FUNCTION toh_private.telephones_carte() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION toh_private.telephones_carte() TO authenticated;

CREATE OR REPLACE VIEW public.signalements_telephones
WITH (security_invoker = true) AS
SELECT id, telephone FROM toh_private.telephones_carte();
REVOKE ALL ON public.signalements_telephones FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.signalements_telephones TO authenticated;

-- Les politiques existantes autorisent seulement le titulaire et le bureau
-- à lire/modifier le signalement privé et son choix. Aucune ouverture de RLS.
NOTIFY pgrst, 'reload schema';
