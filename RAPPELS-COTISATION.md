# Cotisations à relancer — 25 octobre 2026

## Alerte du trésorier, sans envoi automatique aux adhérents

La tâche ChatGPT « Cotisations à relancer — J30 » contrôle les échéances chaque matin entre 8 h et 9 h Pacific/Tahiti, à partir du 26 octobre. Elle notifie JB dans ChatGPT uniquement pour les cotisations qui atteignent 30 jours avant expiration ce jour-là. Le contrôle reste silencieux sinon. La notification regroupe les personnes concernées et renvoie vers Administration > Cotisations à relancer. Aucun outil d’envoi Gmail n’est autorisé dans cette tâche, aucun marqueur de rappel n’est modifié. L’ancien circuit J60/J30 avec envoi automatique est remplacé.

Le calcul utilise la date Tahiti, les membres payés non suspendus, une échéance valide et un compte confirmé avec adresse correspondant au profil. La tâche dépend de la connexion Supabase et de son activation dans ChatGPT. Le premier contrôle programmé reste à observer ; le test Gmail précédent ne prouve pas l’exécution future de cette alerte.

## Relance manuelle par le bureau

Administration affiche le nombre et la liste des cotisations dont l’échéance est dans 30 jours ou moins, y compris les échéances dépassées. Les profils suspendus ou sans adresse valide sont exclus. La liste est recalculée à l’ouverture de la page et après modification d’une cotisation. Elle reste consultable si l’alerte du jour a été manquée.

Le membre du bureau vérifie les paiements, sélectionne une ou plusieurs personnes et appuie sur « Relancer les adhérents sélectionnés ». Le message s’ouvre dans sa messagerie, destinataires en copie cachée, pour validation et envoi. Il doit vérifier le champ « De » ; le site ne peut pas imposer le compte de la messagerie par défaut. JB utilise jbhauata3@gmail.com en tant que trésorier ; un autre membre du bureau utilise son propre compte.

L’ouverture d’un message n’est pas une confirmation d’envoi : les relances manuelles ne sont pas enregistrées automatiquement. Vérifier les messages envoyés avant une nouvelle relance.

## Circuit serveur en réserve

La fonction Supabase rappel-cotisation reste déployée et protégée mais sans expéditeur Resend configuré ni planificateur d’envoi. Ne pas activer d’envois automatiques : la décision et la validation d’envoi appartiennent au bureau.
