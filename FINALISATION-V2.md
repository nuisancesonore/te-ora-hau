# Finalisation des parcours

## Modifications côté site

- Forum : sujets Général, Entraide, Démarches, Vie associative ; messages historiques conservés.
- Missions : responsable, prochaine action, échéance proche ou dépassée, prise concurrente contrôlée.
- Signalements : prochaine action, dossiers clos distingués.
- PDF : état des démarches séparé de la chronologie pour ne pas attribuer une date fictive à une réponse.
- Notifications : lecture propre à chaque compte, pastilles recalculées, vérification de la souscription enregistrée.
- Export JSON des données métier réservé au bureau par une fonction serveur.

## Activation Supabase restante

Ces migrations sont préparées et testées dans PostgreSQL isolé ; leur présence dans Git ne les applique pas à Supabase.

1. Réaliser et vérifier une sauvegarde administrateur du projet, y compris les comptes Auth et les fichiers Storage ; conserver aussi le schéma et les politiques.
2. Appliquer migration-sauvegarde-v2.sql, exporter les données métier et vérifier les volumes.
3. Appliquer migration-confidentialite-v2.sql dans le SQL Editor du projet existant.
4. Contrôler les cas anonyme, membre non validé, membre validé et bureau, puis les dossiers privés d'autrui.
5. Vérifier que la vue publique ne livre ni description, ni adresse, ni quartier précis ; les coordonnées publiques sont arrondies.
6. Le serveur de notifications push n'a pas été redéployé et aucun envoi réel aux adhérents n'a été déclenché.

L'export JSON ne contient ni comptes Auth, ni fichiers Storage, ni secrets, ni abonnements push, ni schéma et ne constitue pas une sauvegarde complète de Supabase. Aucun import automatique n'est ajouté.

## Vérification reproductible

Les tests utilisent uniquement des données artificielles. Aucune écriture dans la base de production.

Installer Playwright et @electric-sql/pglite depuis npm dans un répertoire temporaire et définir TOH_QA_NODE_MODULES sur son dossier node_modules.

- node tests/confidentialite.cjs : permissions, masquage public, export réservé au bureau, migrations rejouables.
- node tests/parcours-fonctions.cjs : lectures par compte, pastilles, sujets, téléchargement JSON et refus des exports incomplets.
- Réception push sur un appareil volontaire à compléter après activation.

Références : https://supabase.com/docs/guides/database/postgres/row-level-security et https://www.postgresql.org/docs/16/sql-createview.html
