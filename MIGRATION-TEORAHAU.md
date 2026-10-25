# Migration préparée vers https://teorahau.github.io

État : préparation uniquement. L'organisation `teorahau` n'est pas encore créée.
Le formulaire GitHub Free est ouvert dans la session propriétaire `nuisancesonore`.
La création exige l'acceptation du GitHub Customer Agreement par une personne autorisée.
Aucun changement n'a été publié sur l'ancien site et aucun dépôt n'a été supprimé.

## Sauvegarde avant migration

- Référence source : `71ec5a45eb339252c6238d2bb2e348a656ca1c0e`.
- Sur le PC de JB, dossier `TE ORA HAU/Sauvegarde migration teorahau 20261025` :
  bundle Git vérifié (historique, branches et tags), ZIP du site et export privé
  des 13 tables applicatives. Ne jamais ajouter cet export au dépôt public.
- Supabase `alaesbkvfprgpngrowbt` est conservé, sans déplacement ni réinitialisation.
  Point de contrôle : 5 comptes, 5 profils, 15 cotisations, 2 signalements,
  aucun fichier dans Storage. Recompter avant et après mise en ligne sans
  écraser les inscriptions légitimes reçues pendant la migration.
- L'export applicatif n'est pas un dump PostgreSQL complet : mots de passe,
  sessions Auth et secrets en sont exclus. Ils restent dans le projet existant.

## Préparation incluse dans cette branche

- Liens absolus, partage, images sociales, guides HTML, sitemap et robots adaptés.
- Page 404 à la racine ; PWA et notifications compatibles avec les deux chemins.
- Le lien de confirmation d'inscription cible la page connexion du site utilisé.
- Sources des fonctions e-mail compatibles CORS avec l'ancienne et la nouvelle
  origine. Aucun déploiement de ces fonctions avant réservation du nouveau nom.
- Le ping Supabase reste exécuté par l'ancien dépôt ; la copie de ce workflow
  dans le nouveau dépôt ne doit pas lancer un second ping et des alertes doubles.

## Bascule après autorisation de création

1. Créer l'organisation gratuite `teorahau`, contrôlée par l'association et le
   compte actuel. Ne pas renommer le compte personnel `nuisancesonore`.
2. Créer le dépôt public `teorahau/teorahau.github.io`. Y pousser l'historique et
   la branche principale préparée, sans transférer ni supprimer l'ancien dépôt.
3. Configurer Pages : branche `main`, dossier `/ (root)`, HTTPS activé.
4. Dans Supabase Auth, sauvegarder la configuration actuelle puis ajouter sans
   retirer les anciennes URL : `https://teorahau.github.io/connexion.html` et
   `https://teorahau.github.io/mot-de-passe.html`. Conserver les variantes déjà
   autorisées et définir le Site URL sur la nouvelle racine après vérification.
5. Sauvegarder les sources effectivement déployées des trois fonctions Edge,
   comparer aux sources de cette branche, puis déployer les adaptations en
   conservant les secrets et les réglages verify_jwt existants. Ne pas activer
   un nouvel expéditeur ou une nouvelle planification d'e-mails.
6. Vérifier Pages, tous les documents et images, navigation mobile, carte,
   formulaire, connexion et retour de confirmation/réinitialisation, espaces
   membre/bureau, préférences téléphoniques, cotisations et exports. Ne pas
   envoyer de mails, de notifications ou de virements de test aux adhérents.
7. Mettre à jour uniquement les liens du suivi automatique Te Ora Hau dans
   ChatGPT une fois la nouvelle adresse réellement opérationnelle ; conserver
   destinataires, références anti-doublons, horaire et RIB.
8. Conserver l'ancien site fonctionnel jusqu'à validation explicite de JB.
   Ne pas poser de redirection automatique avant les contrôles de connexion.

## Limites normales du changement d'origine

Les comptes et mots de passe restent les mêmes dans Supabase, mais les sessions
de navigateur, permissions de notification et installations PWA appartiennent
à chaque origine. Les adhérents devront se reconnecter à la nouvelle adresse
et réautoriser les notifications s'ils les utilisent. Aucune copie de jetons
de connexion entre domaines ne doit être mise en place.

## Retour arrière

L'ancien dépôt, Pages et le projet Supabase restent disponibles. Revenir à
l'ancienne adresse ne nécessite aucune restauration de données. Restaurer la
configuration Auth enregistrée seulement si nécessaire, sans supprimer les
comptes ou nouvelles données reçus depuis la sauvegarde.
