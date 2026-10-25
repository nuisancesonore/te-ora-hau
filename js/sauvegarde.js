// Export privé des données métier. Le serveur contrôle l'appartenance au bureau.
async function exporterDonneesAssociation(btn) {
  const rendre = boutonOccupe(btn, "Préparation de l’export…");
  try {
    const {data,error} = await sb.rpc("export_sauvegarde_application");
    if (error) throw new Error("L’export des données n’est pas disponible. Il doit être activé dans l’administration Supabase.");
    const attendues = ["profils","signalements","journal_bruit","demarches","forum_messages","missions","missions_commentaires","annonces","messages_contact","cotisations","bureau_emails","assesseur_emails"];
    if (!data || data.format !== "te-ora-hau-donnees-v1" || !data.tables || !data.volumes ||
      !attendues.every(n => Array.isArray(data.tables[n]) && data.tables[n].length === data.volumes[n]))
      throw new Error("L’export est incomplet. Aucun fichier n’a été créé.");
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href=url; a.download="te-ora-hau-donnees-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    alert("Le téléchargement des données métier a été lancé. Conservez ce fichier en lieu sûr. Il ne contient pas les comptes de connexion, les fichiers joints ni la configuration de la base.");
  } catch(e) { alert(e.message || "Export impossible. Réessayez."); }
  finally { rendre(); }
}
