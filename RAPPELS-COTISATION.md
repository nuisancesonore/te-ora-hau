# Rappels de cotisation par e-mail

Deux niveaux de rappel cohabitent :

| Rappel | Où | Fonctionne |
|--------|----|-----------|
| **À la connexion** (dans *Mon espace*) | Site (déjà actif) | ✅ immédiatement |
| **Par e-mail** 2 mois puis 1 mois avant l'échéance | Serveur (à déployer) | ⚙️ après mise en place ci-dessous |

> Un site statique (GitHub Pages) **ne peut pas** envoyer d'e-mails programmés.
> L'envoi automatique nécessite une **Edge Function Supabase planifiée** + un **fournisseur d'e-mail**.
> Tout le code est fourni ; il reste à le déployer **une fois**.

---

## 1. Préparer la base

Dans Supabase → **SQL Editor**, exécutez :

- `migration-colonnes.sql` (si ce n'est pas déjà fait) ;
- `migration-rappels.sql` (colonnes anti-doublon).

## 2. Créer un compte d'envoi d'e-mails (Resend)

1. Créez un compte gratuit sur **https://resend.com**.
2. Vérifiez votre domaine d'envoi (ou utilisez l'adresse de test fournie au début).
3. Copiez votre **API key** (`re_...`).

## 3. Déployer la fonction

Avec la CLI Supabase (`npm i -g supabase`, puis `supabase login` et `supabase link`) :

```bash
# Secrets (jamais commités, jamais exposés au site)
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set MAIL_FROM="Te Ora Hau <cotisation@votre-domaine>"
supabase secrets set SITE_URL=https://nuisancesonore.github.io/te-ora-hau
# SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement à la fonction.

supabase functions deploy rappel-cotisation --no-verify-jwt
```

Test manuel :

```bash
curl -X POST https://<ref>.functions.supabase.co/rappel-cotisation
# → {"ok":true,"envoyes":N}
```

## 4. Planifier l'envoi quotidien

Dans Supabase → **SQL Editor** (active `pg_cron` et `pg_net`) :

```sql
select cron.schedule(
  'rappel-cotisation-quotidien',
  '0 8 * * *',                                  -- tous les jours à 8 h
  $$
    select net.http_post(
      url := 'https://<ref>.functions.supabase.co/rappel-cotisation',
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  $$
);
```

La fonction parcourt chaque jour les adhérents ; elle envoie le rappel **2 mois avant**
l'échéance, puis **1 mois avant**, et **mémorise** l'échéance traitée pour ne jamais
renvoyer deux fois le même rappel. Dès que le bureau enregistre le paiement (nouvelle
échéance), le cycle repart pour l'année suivante.

## Remarques

- Les e-mails ne partent que pour les membres ayant une **échéance** et un **e-mail** renseignés.
- Le rappel « à la connexion » sur le site, lui, fonctionne déjà sans rien déployer.
