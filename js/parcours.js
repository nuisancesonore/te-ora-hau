const TOH_SUJETS = ["Général","Entraide","Démarches","Vie associative"];
function sujetForum(texte) {
  const m = /^\[(Général|Entraide|Démarches|Vie associative)\] ([\s\S]*)$/.exec(texte || "");
  return m ? {sujet:m[1],texte:m[2]} : {sujet:"Général",texte:texte || ""};
}
// Améliorations des parcours : utilise les données existantes, sans migration.
function tohFiltre(liste, options) {
  if (!liste.length) return;
  const ancien = document.getElementById("toh-filtres");
  if (ancien) ancien.remove();
  const bloc = document.createElement("section");
  bloc.id = "toh-filtres";
  bloc.className = "toh-filtres";
  bloc.innerHTML = '<div><label for="toh-recherche">' + options.label +
    '</label><input id="toh-recherche" type="search" placeholder="Rechercher…"></div>' +
    '<div><label for="toh-selection">' + options.selection +
    '</label><select id="toh-selection"><option value="">Tout afficher</option>' +
    options.valeurs.map(v => '<option>' + echapper(v) + '</option>').join("") +
    '</select></div><p id="toh-resultats" role="status" aria-live="polite"></p>';
  options.avant.before(bloc);
  const recherche = bloc.querySelector("input"), select = bloc.querySelector("select");
  let sujet = null;
  if (liste[0].classList.contains("msg-forum")) {
    const champ = document.createElement("div");
    champ.innerHTML = '<label for="toh-sujet">Sujet</label><select id="toh-sujet"><option value="">Tous les sujets</option>' + TOH_SUJETS.map(v => '<option>' + echapper(v) + '</option>').join("") + '</select>';
    bloc.insertBefore(champ,bloc.querySelector("p")); sujet = champ.querySelector("select");
  }
  const normaliser = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  function appliquer() {
    let n = 0;
    liste.forEach(c => {
      const visible = normaliser(c.textContent).includes(normaliser(recherche.value)) &&
        (!select.value || options.valeur(c) === select.value) &&
        (!sujet || !sujet.value || c.dataset.sujet === sujet.value);
      c.hidden = !visible;
      if (visible) n++;
    });
    bloc.querySelector("p").textContent = n + " résultat(s) sur " + liste.length +
      (n ? "." : ". Modifiez les filtres pour retrouver vos éléments.");
  }
  if (sujet) sujet.addEventListener("change",appliquer);
  recherche.addEventListener("input", appliquer);
  select.addEventListener("change", appliquer);
  appliquer();
}
function tohSignalements() {
  const data = window.TOH_SIGNALEMENTS || [];
  data.forEach(s => {
    const carte = document.getElementById("sig-" + s.id);
    if (!carte) return;
    carte.dataset.etat = s.etat || "Ouvert";

  });
  const cartes = [...document.querySelectorAll(".sig[id]")];
  tohFiltre(cartes, {label:"Rechercher dans mes signalements", selection:"État du dossier",
    valeurs:[...new Set(cartes.map(c => c.dataset.etat))].sort(), avant:cartes[0],
    valeur:c => c.dataset.etat});
}
async function tohResumeEspace(profil) {
  const zone = document.getElementById("resume-activite");
  if (!zone) return;
  let html = "";
  const lien = (href,n,texte) => '<a class="toh-indicateur" href="' + href + '"><strong>' +
    n + '</strong>' + texte + '<span>Consulter →</span></a>';
  if (aDroitAcces(profil)) {
    const {data,error} = await sb.from("signalements").select("id,etat").eq("auteur",profil.id);
    html += error ? '<p role="status">Suivi des signalements indisponible. <a href="mes-signalements.html">Réessayer</a>.</p>' :
      lien("mes-signalements.html",(data || []).length,"mes signalements") +
      lien("mes-signalements.html",(data || []).filter(s => !["Résolu","Classé sans suite"].includes(s.etat)).length,"dossiers à suivre");
    const nonLus = await compterNonLus(profil);
    html += nonLus.indisponible ? '<p role="status">Le nombre de nouveautés est temporairement indisponible.</p>' : lien("forum.html",nonLus.forum || 0,"messages du forum non lus");
    if (profil.type_adhesion === "Assesseur" && !nonLus.indisponible) html += lien("missions.html",nonLus.missions || 0,"nouvelles missions disponibles");
  } else {
    html = '<a class="toh-indicateur" href="cotiser.html">Suivre ma cotisation<span>Voir les modalités →</span></a>';
  }
  zone.innerHTML = html;
}
document.addEventListener("DOMContentLoaded", () => {
  const contenu = document.getElementById("contenu");
  if (!contenu) return;
  const installe = new WeakSet();
  function ameliorer() {
    const messages = [...contenu.querySelectorAll(".msg-forum")];
    const missions = [...contenu.querySelectorAll(".mission")];
    const cartes = messages.length ? messages : missions;
    if (!cartes.length || installe.has(cartes[0])) return;
    cartes.forEach(c => installe.add(c));
    const forum = !!messages.length;
    const valeur = c => (c.querySelector(forum ? ".meta strong" : ".pill")?.textContent || "").trim();
    tohFiltre(cartes,{label:forum ? "Rechercher dans les échanges" : "Rechercher une mission",
      selection:forum ? "Auteur" : "Avancement",valeurs:[...new Set(cartes.map(valeur))].sort(),
      avant:forum ? document.getElementById("liste-msg") : contenu.querySelector(".sect-titre"),
      valeur});
  }
  new MutationObserver(ameliorer).observe(contenu,{childList:true,subtree:true});
  ameliorer();
});
