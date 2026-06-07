# Mise en route — Te Ora Hau

Le site fonctionne avec **Supabase** (base de données + comptes membres, offre gratuite suffisante).
Comptez ~10 minutes. Aucune compétence technique avancée requise.

## 1. Créer le projet Supabase
1. Allez sur https://supabase.com → **Start your project** → créez un compte.
2. **New project** : donnez un nom (ex. `te-ora-hau`), choisissez un mot de passe de base de données (notez-le), région la plus proche.
3. Attendez ~2 min que le projet soit prêt.

## 2. Récupérer les 2 clés
Dans le projet : **Project Settings** (roue dentée) → **API**. Copiez :
- **Project URL** (ex. `https://abcd1234.supabase.co`)
- **Project API keys → `anon` `public`** (longue chaîne)

Ouvrez `js/config.js` et collez-les :
```js
window.TOH_CONFIG = {
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...votre_cle...",
};
```

## 3. Créer les tables
Dans Supabase : menu **SQL Editor** → **New query** → ouvrez le fichier
`supabase-setup.sql`, copiez tout son contenu, collez-le, puis **Run**.
Un message « Success » confirme que tout est créé.

## 4. Autoriser l'inscription par e-mail
**Authentication → Providers → Email** : laissez **Email** activé.
> Astuce : pour tester rapidement, dans **Authentication → Providers → Email**,
> désactivez « Confirm email » afin de ne pas avoir à valider chaque e-mail.
> Réactivez-le en production.

## 5. Tester
Ouvrez `index.html` (double-clic). La bannière rouge « Supabase non configuré »
doit avoir disparu.
1. **Adhérer** → créez un compte → vous arrivez sur **Mon espace** (carte de membre + QR).
2. **Signaler** une nuisance → elle apparaît sur la **Carte**.
3. **Forum** et **Outils** (courrier + journal) sont accessibles.

## 6. Devenir administrateur (bureau)
Pour accéder au **Tableau de bord bureau** (`admin.html`) :
1. Inscrivez-vous normalement via le site.
2. Dans Supabase → **SQL Editor**, exécutez (avec votre e-mail) :
   ```sql
   update public.profils set role = 'bureau'
   where email = 'vous@exemple.pf';
   ```
3. Reconnectez-vous : le lien **Admin** apparaît dans le menu.

## 7. Mettre le site en ligne (optionnel)
Le site est 100 % statique : déposez le dossier sur un hébergeur gratuit
(**Netlify**, **Vercel** ou **GitHub Pages**) par simple glisser-déposer.
Pensez ensuite, dans Supabase → **Authentication → URL Configuration**,
à ajouter l'adresse de votre site.

---

### Récapitulatif des pages
| Page | Rôle |
|------|------|
| `index.html` | Accueil |
| `le-bruit.html` | Réglementation & dangers |
| `comprendre.html` | Le son, l'oreille, l'acoustique |
| `association.html` | Objet, éditoriaux, historique |
| `signaler.html` | Signaler une nuisance (carte) |
| `carte.html` | Carte collective des nuisances |
| `forum.html` | Forum des membres |
| `outils.html` | Générateur de courriers + journal de bruit |
| `espace.html` | Espace adhérent + carte de membre |
| `admin.html` | Tableau de bord du bureau |
| `inscription / connexion / mot-de-passe` | Comptes |

### Sécurité
Les règles d'accès (RLS) sont définies dans `supabase-setup.sql` :
chaque membre ne voit que ses données ; le journal de bruit est strictement privé ;
seul le bureau accède à la liste des adhérents. La clé `anon` est conçue pour
être publique (côté navigateur) — ne partagez **jamais** la clé `service_role`.
