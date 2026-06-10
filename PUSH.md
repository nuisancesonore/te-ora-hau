# Notifications push (badge sur l'icône, façon WhatsApp)

Affiche une notification + le **chiffre sur l'icône** de l'app, **même app fermée**.
Gratuit. Marche sur **Android (Chrome)** et **iPhone** (site installé sur l'écran d'accueil, iOS 16.4+).

## 1) Générer les clés VAPID (une fois)
Sur votre PC (Node installé) :
```bash
node generate-vapid.js
```
Notez les deux valeurs : `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`.

## 2) Clé publique dans le site
Dans **js/config.js**, renseignez :
```js
VAPID_PUBLIC_KEY: "votre_cle_publique"
```
Puis commit + push (la clé publique n'est pas secrète).

## 3) Créer la table
Supabase → **SQL Editor** → coller **migration-push.sql** → **Run**.

## 4) Déployer la fonction d'envoi
Avec la CLI Supabase :
```bash
supabase secrets set VAPID_PUBLIC_KEY=...        # même valeur qu'au point 2
supabase secrets set VAPID_PRIVATE_KEY=...        # la clé PRIVÉE (secrète, jamais committée)
supabase secrets set VAPID_SUBJECT="mailto:contact@teorahau.net"
supabase functions deploy envoi-push
```

## 5) Côté membre (une fois)
- **Installer** le site sur l'écran d'accueil (obligatoire sur iPhone).
- **Mon espace → « Activer les notifications »** → **Autoriser**.

## 6) Envoyer
**Admin → Communication → « Publier et notifier (push) »**.
Tant que la fonction n'est pas déployée, ce bouton publie l'annonce mais signale que le push est indisponible (les autres canaux marchent).
