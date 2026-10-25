# État des rappels de cotisation

Le rappel visible dans Mon espace fonctionne à la connexion.
La fonction rappel-cotisation est déployée et protégée. Aucun planificateur de rappel n’est encore configuré. Le bouton « Vérifier les relances e-mail » dans Administration > Communication lance seulement une simulation et vérifie la présence de la configuration de l’expéditeur.

Le code serveur est préparé, avec authentification bureau ou serveur, simulation par défaut, calcul des jours en Pacific/Tahiti et clé d’idempotence par échéance et palier. Aucun e-mail de test n’a été envoyé aux adhérents.

Pour activer l’envoi quotidien, il reste à vérifier/configurer RESEND_API_KEY et MAIL_FROM pour un expéditeur autorisé, puis configurer un appel quotidien authentifié avec dry_run:false. La clé serveur ne doit apparaître ni dans le site ni dans ce dépôt.

Ne pas utiliser l’ancien exemple d’appel sans authentification. L’activation effective et la réception d’un rappel n’ont pas encore été validées.

La simulation dry_run:true indique le nombre de rappels éligibles et si l’expéditeur est configuré, sans envoyer de mail ni retourner les adresses des membres.
