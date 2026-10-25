# Rappels de cotisation — 25 octobre 2026

## Circuit actif

Une tâche ChatGPT « Relances cotisations Te Ora Hau » est activée quotidiennement, à partir du 26 octobre, entre 8 h et 9 h Pacific/Tahiti. Elle lit les échéances dans Supabase et utilise le Gmail connecté de l’association, nuisancesonore987@gmail.com. Elle dépend du maintien de ces connexions et de la tâche ChatGPT active ; ce n’est pas un cron Supabase autonome.

Seuls les membres non suspendus, payés, avec échéance non passée et compte confirmé dont l’adresse correspond au profil sont concernés. Deux fenêtres : 31–60 jours (J60), puis 0–30 jours (J30). Un seul rappel par échéance et par palier, contrôlé par les marqueurs rappel_60j_pour / rappel_30j_pour et une référence déterministe recherchée dans les e-mails envoyés. En cas d’incertitude sur un envoi, pas de nouvelle tentative aveugle. Les marqueurs sont mis à jour seulement après confirmation Gmail.

Le 25 octobre : aucun membre éligible. Un seul e-mail technique a été envoyé à JB depuis l’association et retrouvé dans sa boîte de réception. Cela valide le trajet de test ; le premier traitement quotidien programmé reste à observer. Aucun autre adhérent contacté pour le test, aucun paiement ni échéance modifié.

Administration > Communication décrit la programmation et renvoie au suivi ChatGPT ; cette information n’est pas une vérification de santé en direct. Les notifications push disposent toujours de leur propre bouton de test sur l’appareil courant.

## Circuit serveur en réserve

La fonction Supabase rappel-cotisation est déployée et protégée, mais son expéditeur Resend n’est pas configuré et elle n’a pas de planificateur. Elle reste inactive pour les envois. Ne pas activer un second circuit sans désactiver le premier et réconcilier les marqueurs pour éviter les doubles rappels. Aucun secret serveur ne doit être placé dans le site ou le dépôt.
