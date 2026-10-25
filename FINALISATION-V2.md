# Vérification des parcours et de la confidentialité

## Appliqué dans la base

- Cartes publiques expurgées et positions arrondies; détails de carte pour les adhérents validés.
- Signalements complets réservés à leur auteur et au bureau.
- Fonctions privilégiées de contrôle des rôles dans le schéma privé; interfaces publiques sans privilèges supplémentaires.
- Annuaire via annuaire_membres : seulement identifiant, nom, prénom, commune et type de nuisance, après consentement. Les autres champs de profils restent privés.
- Forum et missions : contrôle serveur de l'adhésion validée et de la suspension, en complément des rôles/propriétaires.
- Lecture du journal par le bureau pour préparer les dossiers.
- Réactivation des notifications limitée au propriétaire de l'abonnement.
- Export métier du bureau en SECURITY INVOKER : uniquement les dix tables déjà accessibles au bureau. Les listes techniques d'adresses des rôles sont exclues.

La migration supabase/migrations/*_finalisation_acces_et_export.sql contient le complément de cette passe. Les scripts migration-confidentialite-v2.sql et migration-sauvegarde-v2.sql sont historiques; ne pas les réappliquer sur le projet actuel. Le schéma actuel complet est conservé dans le snapshot privé de sauvegarde, avec les migrations réelles enregistrées dans Supabase.

## Site et notifications

- Contrôles d'accès alignés sur la suspension et la date de Tahiti, jusqu'au jour d'échéance inclus.
- PDF : identité du véritable auteur, journal lisible par le bureau, date Tahiti, arrêt si lecture incomplète, mise en page A4 vérifiée sur quatre pages artificielles.
- Les preuves déclarées restent du texte : aucun fichier justificatif n'est inclus automatiquement dans le PDF.
- Notifications push : groupes validés, comptes suspendus exclus, erreurs de lecture signalées, simulation sans envoi, bilan des échecs explicite. Fonction envoi-push redéployée.

## Validation

- Copie locale PostgreSQL isolée : restauration des 13 tables et 45 lignes du snapshot, comparaison de chaque champ, schéma/fonctions/vues/politiques réinstallés.
- 35 contrôles d'accès et d'export sur copie restaurée, dont comptes non validés/suspendus, adhérent, assesseur, bureau et propriété des abonnements.
- Contrôles de lecture et export également effectués dans la base réelle sans modifier les données.
- 12 contrôles interface/PDF, 10 contrôles lectures/pastilles/export, 24 contrôles push simulés, 10 contrôles de rappels simulés.
- Aucun message, e-mail ou push réel de test envoyé aux adhérents.

Pour reproduire : Node 24+, Playwright avec navigateur Chromium installé et @electric-sql/pglite. Les dépendances de QA sont temporaires, hors du site.

```
TOH_PGLITE=/chemin/node_modules/@electric-sql/pglite node tests/restauration.cjs /chemin/snapshot-prive.json
TOH_PGLITE=/chemin/node_modules/@electric-sql/pglite node tests/droits-finalisation.cjs /chemin/snapshot-prive.json
TOH_QA_NODE_MODULES=/chemin/node_modules node tests/parcours-fonctions.cjs
node tests/pdf-et-interface.cjs
node tests/push-serveur.cjs
node tests/rappels-serveur.cjs
```

TOH_CHROMIUM permet d'indiquer le binaire du navigateur et TOH_CHROMIUM_ARGS un tableau JSON d'options spécifiques à l'environnement. Les snapshots contenant des données privées ne doivent jamais être ajoutés au dépôt public.

## Limites restantes

- Rappels automatiques par e-mail : fonction déployée, simulation accessible au bureau et aucun envoi quotidien planifié. L'expéditeur et sa configuration restent à vérifier avant activation.
- Réception push sur un appareil volontaire : non vérifiée; le bouton « Tester mes notifications » vérifie l’abonnement local et cible exclusivement cet appareil, en contrôlant son propriétaire côté serveur; les contrôles actuels couvrent l'abonnement, l'autorisation, la sélection et les réponses simulées du service.
- Le snapshot n'est pas un pg_dump intégral : références Auth incluses, mots de passe/identités/sessions et secrets externes exclus. La restauration testée concerne le métier et le schéma applicatif, pas une restauration complète de l'authentification Supabase.
- Aucun objet Storage présent à la capture : aucun fichier à restaurer.
- Protection Supabase contre les mots de passe compromis : option Pro non activée; organisation maintenue sur l'offre gratuite.

Le nettoyage automatique des notifications ignore désormais le test (tag toh-test). Le test ne prouve la réception qu’après observation sur l’appareil.
