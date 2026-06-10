# Communication aux membres

Outils du bureau, dans **Administration** (réservé aux e-mails du bureau).

## Ce qui fonctionne dès la migration

Après avoir exécuté **`migration-complete.sql`** (ou `migration-communication.sql`) :

- **Statistiques des adhérents** : répartition par type d'adhésion, nuisance subie, commune, statut de cotisation, tranche d'âge.
- **Annonces** : « Publier l'annonce » l'enregistre ; les **membres ciblés la voient dans leur espace** (réunions, infos…). Ciblage : tous / à jour / non à jour. Aucun envoi externe, 100 % fiable.
- **E-mail rapide (Cci)** : ouvre **votre** logiciel mail avec les destinataires de l'audience en **copie cachée**. Idéal pour des dizaines de membres (l'envoi part de votre boîte).
- **SMS** : ouvre **votre** application de messagerie avec les numéros et le texte pré-remplis — envoi via **votre abonnement** (Vini/Vodafone…). Selon le téléphone, les destinataires multiples s'ajoutent automatiquement ou non ; au besoin, utilisez **« Copier les numéros »**.
- **Copier les e-mails / les numéros** : pour coller dans n'importe quel outil.

> Les numéros sont collectés via le champ **Téléphone** (inscription + Mon profil).

## Envoi e-mail EN MASSE (optionnel, à déployer)

Pour envoyer à des **centaines** de membres automatiquement (sans passer par votre boîte) :

1. Créez un compte **https://resend.com** (offre gratuite) et vérifiez un domaine d'envoi.
2. CLI Supabase :
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set MAIL_FROM="Te Ora Hau <contact@votre-domaine>"
   supabase functions deploy diffusion-email
   ```
3. Dans l'admin, le bouton **« Envoi e-mail en masse (serveur) »** appellera cette fonction (elle vérifie que vous êtes du bureau, puis envoie en Cci par lots de 50).

Tant que ce n'est pas déployé, ce bouton affiche simplement « indisponible » — les autres canaux fonctionnent.
