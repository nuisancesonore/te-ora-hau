# Te Ora Hau — Vivre en paix

Site de l'association **Te Ora Hau** (Polynésie française), dédiée à la **lutte contre les nuisances sonores**.

Association à but non lucratif (loi 1901) — agréée de protection de l'environnement, reconnue d'intérêt général — **N° TAHITI 532291.001**.

## Fonctionnalités

- Pages d'information : le bruit & la loi, comprendre le son, l'association
- Espace adhérent + carte de membre numérique (QR code)
- Tableau de bord du bureau (gestion des adhérents et cotisations)
- Signalement géolocalisé des nuisances + carte collective (Leaflet / OpenStreetMap)
- Forum des membres
- Outils : générateur de courriers + journal de bruit
- Mentions légales / RGPD

## Pile technique

- Site **statique** (HTML / CSS / JavaScript) — aucun build nécessaire
- Backend **Supabase** (base de données + authentification) appelé côté navigateur
- Cartographie **Leaflet** + **OpenStreetMap**

## Mise en route

Voir **[SETUP.md](SETUP.md)** :

1. Créer un projet gratuit sur [supabase.com](https://supabase.com)
2. Coller l'URL et la clé `anon` dans `js/config.js`
3. Exécuter `supabase-setup.sql` dans le SQL Editor de Supabase
4. (Bureau) se définir comme administrateur via une requête SQL

> La clé `anon` est conçue pour être publique ; la sécurité repose sur les
> règles RLS définies dans `supabase-setup.sql`. Ne jamais publier la clé `service_role`.

## Développement local

Le site doit être servi en HTTP (et non ouvert en `file://`, sinon la vidéo et
Supabase ne fonctionnent pas). Un serveur local PowerShell est fourni :

```powershell
# Clic droit sur serveur-local.ps1 → Exécuter avec PowerShell
# puis ouvrir http://localhost:8000/index.html
```

## Mise en ligne (GitHub Pages)

Le site fonctionne tel quel sur GitHub Pages (statique + HTTPS). Pensez à ajouter
l'URL du site dans Supabase → **Authentication → URL Configuration**.

---

© Te Ora Hau — Directrice de la publication : Maea Linda TEMATUA.
