# Relances Te Ora Hau — relais du bureau

## Règle active au 25 octobre 2026

Contrôle quotidien silencieux, entre 8 h et 9 h Pacific/Tahiti, via la tâche ChatGPT « Relances Te Ora Hau — relais bureau ». À J−30 : alerte privée à JB, trésorier, avec accès à la liste Administration. Le bureau dispose ensuite de la préparation manuelle des relances depuis sa propre messagerie.

Si aucune relance n’a été enregistrée pour cette échéance, un seul e-mail automatique peut partir à partir de J−15. Un contrôle manqué peut être rattrapé après l’échéance. Aucun envoi quotidien répété : une seule relance par échéance, protégée par le marqueur rappel_30j_pour et une référence déterministe recherchée dans les messages envoyés de JB. Un envoi manuel confirmé comme un envoi automatique confirmé arrête ce relais pour cette échéance.

L’automatique utilise exclusivement jbhauata3@gmail.com, signature « Jean-Baptiste HAUATA — Trésorier de Te Ora Hau ». Destinataire individuel, compte confirmé et adresse de profil correspondant au compte, profil non suspendu, échéance toujours actuelle. Les données sont revérifiées juste avant envoi. En cas d’incertitude sur un envoi Gmail, ne pas réessayer aveuglément. Le marqueur n’est écrit qu’après confirmation de l’envoi. Une nouvelle échéance de cotisation constitue un nouveau cycle.

## Confirmer l’envoi manuel

Le bureau sélectionne les adhérents, prépare le message puis l’envoie réellement dans sa messagerie. Il revient ensuite sur le site et appuie sur « Confirmer la relance envoyée » pour les personnes concernées. Une confirmation explicite atteste l’envoi : l’ouverture du message seule ne suffit pas. Le site enregistre rappel_30j_pour avec la date d’échéance concernée, sans modifier le paiement ni les droits. La mise à jour vérifie l’id, l’échéance et l’adresse pour ne pas confirmer une autre échéance entre-temps. En cas de lot partiellement enregistré, seuls les succès disparaissent de la liste et le résultat est indiqué.

La liste et le compteur excluent les personnes dont la relance est déjà enregistrée pour l’échéance actuelle, les profils suspendus et les adresses invalides. Le bouton est masqué si la liste est vide, désactivé si aucune personne n’est cochée. La confirmation de l’envoi repose sur la déclaration du membre du bureau ; ce n’est pas une preuve technique de réception du mail.

## Dépendances et validation

La tâche dépend de ChatGPT, du Gmail de JB et de Supabase connectés. La fonction serveur Resend reste en réserve, sans expéditeur configuré ni planificateur ; ne pas activer un second circuit en parallèle. Le premier traitement automatique reste à observer. Le test Gmail historique depuis l’adresse association ne valide pas un envoi automatique futur depuis JB. Aucun paiement ni échéance réels ne sont modifiés pour les essais.
