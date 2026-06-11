/* ============================================================
   Te Ora Hau — logique partagée (backend Supabase)
   Nécessite : js/config.js + le SDK supabase-js (chargé via CDN
   dans chaque page) + le schéma de supabase-setup.sql.
   ============================================================ */

let sb = null;          // client Supabase
let TOH_PRET = false;   // config valide ?

(function initClient() {
  const c = window.TOH_CONFIG || {};
  const ok = c.SUPABASE_URL && c.SUPABASE_ANON_KEY
    && !c.SUPABASE_URL.includes("VOTRE-PROJET")
    && !c.SUPABASE_ANON_KEY.includes("VOTRE_CLE");
  if (ok && window.supabase) {
    sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
    TOH_PRET = true;
  }
})();

/* ---------- Récupération de mot de passe (sur toutes les pages) ----------
   Quelle que soit la page d'atterrissage du lien reçu par e-mail, on bascule
   vers la page dédiée pour saisir un nouveau mot de passe. */
(function gererRecovery() {
  if (!sb) return;
  const surMdp = /mot-de-passe\.html$/.test(location.pathname);
  const cible = location.origin + location.pathname.replace(/[^/]*$/, "") + "mot-de-passe.html";
  // Le jeton est encore dans l'URL → on redirige en le conservant.
  if (location.hash.includes("type=recovery") && !surMdp) {
    location.replace(cible + "?recovery=1" + location.hash);
    return;
  }
  // Sinon, Supabase signale l'événement (jeton déjà consommé).
  sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY" && !/mot-de-passe\.html$/.test(location.pathname)) {
      location.replace(cible + "?recovery=1");
    }
  });
})();

/* ---------- Icône « Ajouter à l'écran d'accueil » (favicon + PWA) ---------- */
(function injecterIconesPWA() {
  const head = document.head;
  if (!head) return;
  const lien = (rel, href, attrs) => {
    if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = rel; l.href = href;
    if (attrs) for (const k in attrs) l.setAttribute(k, attrs[k]);
    head.appendChild(l);
  };
  const meta = (name, content) => {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const m = document.createElement("meta"); m.name = name; m.content = content; head.appendChild(m);
  };
  lien("icon", "favicon.ico", { sizes: "any" });
  lien("icon", "images/favicon-32.png", { type: "image/png", sizes: "32x32" });
  lien("apple-touch-icon", "images/apple-touch-icon.png");
  lien("manifest", "manifest.webmanifest");
  meta("theme-color", "#064a54");
  meta("apple-mobile-web-app-title", "Te Ora Hau");
  meta("apple-mobile-web-app-capable", "yes");
  meta("mobile-web-app-capable", "yes");
})();

/* ---------- Service worker (installation en vraie app + badge d'icône) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* ---------- Notifications push (abonnement de l'appareil) ---------- */
const TOH_VAPID = (window.TOH_CONFIG || {}).VAPID_PUBLIC_KEY || "";
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function etatNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "non-supporte";
  if (!TOH_VAPID) return "non-configure";
  if (Notification.permission === "denied") return "refuse";
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); return sub ? "actif" : "inactif"; }
  catch (_) { return "inactif"; }
}
async function activerNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) { alert("Les notifications ne sont pas supportées sur cet appareil/navigateur."); return false; }
  if (!TOH_VAPID) { alert("Les notifications ne sont pas encore configurées par l'association."); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { alert("Notifications non autorisées. Vous pourrez les activer dans les réglages du navigateur."); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(TOH_VAPID) });
    const s = await sessionActive();
    if (!s) { alert("Connectez-vous d'abord."); return false; }
    const { error } = await sb.from("push_subscriptions").upsert({ user_id: s.user.id, endpoint: sub.endpoint, subscription: sub.toJSON() }, { onConflict: "endpoint" });
    if (error) { alert("Erreur d'enregistrement : " + error.message); return false; }
    return true;
  } catch (e) { alert("Activation impossible : " + (e.message || e)); return false; }
}
async function desactiverNotifications() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { try { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); } catch (_) {} await sub.unsubscribe(); }
    return true;
  } catch (_) { return false; }
}

/* ---------- Authentification ---------- */
async function inscrire(nom, prenom, email, motdepasse, commune) {
  const { data, error } = await sb.auth.signUp({
    email, password: motdepasse,
    options: { data: { nom, prenom: prenom || "", commune: commune || "" } },
  });
  if (error) return { ok: false, msg: traduireErreur(error.message) };
  // Le profil est créé automatiquement par un trigger SQL.
  return { ok: true, msg: "Inscription réussie. Bienvenue dans la communauté Te Ora Hau !", session: data.session };
}

async function connecter(email, motdepasse) {
  const { error } = await sb.auth.signInWithPassword({ email, password: motdepasse });
  if (error) return { ok: false, msg: traduireErreur(error.message) };
  return { ok: true, msg: "Connexion réussie." };
}

async function deconnecter() {
  await sb.auth.signOut();
  location.href = "index.html";
}

async function reinitMotDePasse(email) {
  const redirect = location.origin + location.pathname.replace(/[^/]+$/, "mot-de-passe.html");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
  return { ok: !error, msg: error ? traduireErreur(error.message) : "" };
}

async function sessionActive() {
  if (!TOH_PRET) return null;
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

async function monProfil() {
  const s = await sessionActive();
  if (!s) return null;
  const { data } = await sb.from("profils").select("*").eq("id", s.user.id).single();
  return data || null;
}

// Statut de cotisation — source de vérité unique (utilisée par Mon espace et Cotiser)
function statutCotisation(profil) {
  const ech = profil.cotisation_echeance ? new Date(profil.cotisation_echeance) : null;
  const aJour = profil.cotisation_payee && (!ech || ech >= new Date());
  // La cotisation est annuelle : la période débute un an avant l'échéance.
  let debut = null;
  if (ech) { debut = new Date(ech); debut.setFullYear(debut.getFullYear() - 1); }
  const jours = ech ? Math.ceil((ech.getTime() - Date.now()) / 86400000) : null;
  const fmt = d => d ? d.toLocaleDateString("fr-FR") : "—";
  return {
    aJour,
    echeance: fmt(ech),
    debut: fmt(debut),
    echeanceDate: ech,
    debutDate: debut,
    joursRestants: jours,           // négatif si la cotisation est échue
    numero: profil.id.slice(0, 8).toUpperCase(),
  };
}

// Accès complet au site = cotisation à jour (validée par le bureau),
// ou être soi-même membre du bureau.
function aDroitAcces(profil) {
  return !!(profil && (profil.role === "bureau" || statutCotisation(profil).aJour));
}

// Verrou pour les pages réservées aux adhérents validés. Renvoie le HTML du
// blocage à afficher, ou null si l'accès est accordé.
function verrouAcces(profil) {
  if (!profil) {
    return `<div class="verrou"><div class="ico">🔒</div>
      <h2 style="color:var(--bleu-fonce)">Connexion requise</h2>
      <p style="color:var(--gris);margin:0.6rem 0 1.2rem">Cette section est réservée aux adhérents. Connectez-vous, ou adhérez pour rejoindre Te Ora Hau.</p>
      <a href="connexion.html" class="btn btn-primaire">Se connecter</a>
      <a href="inscription.html" class="btn btn-clair">Adhérer</a></div>`;
  }
  if (profil.role !== "bureau" && !statutCotisation(profil).aJour) {
    return `<div class="verrou"><div class="ico">⏳</div>
      <h2 style="color:var(--bleu-fonce)">Adhésion en attente de validation</h2>
      <p style="color:var(--gris);margin:0.6rem 0 1.2rem">Votre compte est bien créé&nbsp;! L'accès complet se débloque dès que votre <strong>cotisation</strong> a été reçue et <strong>validée par le bureau</strong> de Te Ora Hau.</p>
      <a href="cotiser.html" class="btn btn-primaire">Régler ma cotisation</a>
      <a href="espace.html" class="btn btn-clair">Mon espace</a></div>`;
  }
  return null;
}

function traduireErreur(m) {
  if (/already registered/i.test(m)) return "Un compte existe déjà avec cet e-mail.";
  if (/Invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (/at least 6/i.test(m)) return "Le mot de passe doit contenir au moins 6 caractères.";
  return m;
}

/* ---------- Navigation dynamique ---------- */
async function rendreNav(pageActive) {
  const profil = await monProfil();
  const lien = (href, label, id) =>
    `<a href="${href}" class="${id === pageActive ? "actif" : ""}">${label}</a>`;

  // Déroulant "Comprendre" : Le son & l'audition / Bruit & santé
  const dropdown = `
    <div class="menu-drop">
      <a href="comprendre.html" class="drop-trigger ${pageActive === "comprendre" ? "actif" : ""}">Comprendre <span class="caret">▾</span></a>
      <div class="drop-menu">
        <a href="comprendre.html#audition">Le son &amp; l'audition</a>
        <a href="comprendre.html#sante">Bruit &amp; santé</a>
      </div>
    </div>`;

  // Liens dépendant de la connexion
  let blocAuth;
  if (profil) {
    // Membre connecté : déroulant "Mon espace" (tableau de bord, signalements,
    // annuaire, forum) · Cotiser · (Admin) · Déconnexion
    const espaceActif = ["espace", "signaler", "mes-signalements", "annuaire", "forum", "outils"].includes(pageActive) ? "actif" : "";
    // Les entrées réservées sont marquées d'un cadenas tant que la cotisation
    // n'est pas validée par le bureau (les pages expliquent alors quoi faire).
    const acces = aDroitAcces(profil);
    const lk = acces ? "" : "🔒 ";
    const dropEspace = `
      <div class="menu-drop">
        <a href="espace.html" id="nav-espace-trigger" class="drop-trigger ${espaceActif}">Mon espace <span class="caret">▾</span></a>
        <div class="drop-menu">
          <a href="espace.html" id="nav-tableau">Tableau de bord</a>
          <a href="signaler.html">${lk}Signaler une nuisance</a>
          <a href="mes-signalements.html">${lk}Mes signalements</a>
          <a href="outils.html">${lk}Courriers &amp; journal</a>
          <a href="annuaire.html">${lk}Annuaire des adhérents</a>
          <a href="forum.html" id="nav-forum">${lk}Forum</a>
        </div>
      </div>`;
    blocAuth = dropEspace +
      `<a href="cotiser.html" class="lien-cotiser ${pageActive === "cotiser" ? "actif" : ""}">Cotiser</a>` +
      (profil.role === "bureau" ? lien("admin.html", "Admin", "admin") : "") +
      `<a href="#" class="bouton" onclick="deconnecter();return false;">Déconnexion</a>`;
  } else {
    // Visiteur : déroulant "Inscription" (Adhérer · Cotiser) puis Connexion
    const inscriptionActif = (pageActive === "inscription" || pageActive === "cotiser") ? "actif" : "";
    const dropInscription = `
      <div class="menu-drop">
        <a href="inscription.html" class="drop-trigger ${inscriptionActif}">Inscription <span class="caret">▾</span></a>
        <div class="drop-menu">
          <a href="inscription.html">Adhérer</a>
          <a href="cotiser.html">Cotiser</a>
        </div>
      </div>`;
    blocAuth = dropInscription + lien("connexion.html", "Connexion", "connexion");
  }

  const menuHTML = [
    lien("index.html", "Accueil", "accueil"),
    lien("association.html", "Qui sommes-nous ?", "association"),
    lien("carte.html", "Carte des nuisances", "carte"),
    dropdown,
    lien("le-bruit.html", "Les textes de lois", "bruit"),
    blocAuth,
  ].join("");

  const mount = document.getElementById("nav-mount");
  mount.innerHTML = `
    <section class="banniere">
      <a href="index.html"><img src="images/bandeau.png"
         alt="STOP au bruit — Pour vivre en paix sans nuisances sonores"></a>
    </section>`;

  // Le menu est inséré comme enfant direct du <body> (après #nav-mount),
  // pour que "position: sticky" fonctionne sur tout le défilement.
  const ancien = document.getElementById("toh-header");
  if (ancien) ancien.remove();
  mount.insertAdjacentHTML("afterend", `
    <header class="site" id="toh-header">
      <div class="nav-inner">
        <a href="index.html" class="brand">
          <span class="logo"><img src="images/logo%20TOH.PNG" alt="Logo Te Ora Hau"></span>
          <span>
            <span class="titre">Te Ora Hau</span>
            <span class="sous">Vivre en paix · Lutte contre le bruit</span>
          </span>
        </a>
        <button class="hamburger" id="hamburger" aria-label="Ouvrir le menu" aria-expanded="false">☰</button>
        <nav class="menu" id="menu-principal">${menuHTML}</nav>
      </div>
    </header>`);

  // Hamburger : ouvre/ferme le menu sur mobile
  const burger = document.getElementById("hamburger");
  const menuEl = document.getElementById("menu-principal");
  if (burger && menuEl) {
    burger.addEventListener("click", () => {
      const ouvert = menuEl.classList.toggle("ouvert");
      burger.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
    menuEl.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      menuEl.classList.remove("ouvert");
      burger.setAttribute("aria-expanded", "false");
    }));
  }

  if (profil) verifierNotifications(profil);

  if (!TOH_PRET) afficherBanniereConfig();

  // Effet fluide au défilement : le menu remonte et "avale" la bannière
  // par le haut ; sous la barre, le contenu reste propre (pas d'image).
  const headerEl = document.getElementById("toh-header");
  const banniereEl = document.querySelector(".banniere");
  const banImg = banniereEl ? banniereEl.querySelector("img") : null;
  let _banH = 0, _menuH = 0;

  function ajusterDefilement() {
    _banH = banImg ? banImg.offsetHeight : (banniereEl ? banniereEl.offsetHeight : 0);
    _menuH = headerEl ? headerEl.offsetHeight : 0;
    document.body.style.paddingTop = (_banH + _menuH) + "px";
    appliquerScroll();
  }

  function appliquerScroll() {
    const sc = window.scrollY || window.pageYOffset || 0;
    const visible = Math.max(_banH - sc, 0);   // hauteur de bannière encore visible
    if (banniereEl) {
      banniereEl.style.height = visible + "px";
      banniereEl.style.opacity = _banH ? Math.max(visible / _banH, 0) : 1;
    }
    if (headerEl) {
      headerEl.style.top = visible + "px";       // le menu reste collé sous la bannière
      headerEl.classList.toggle("collee", visible < 2);
    }
  }

  window.addEventListener("scroll", appliquerScroll, { passive: true });
  window.addEventListener("resize", ajusterDefilement);
  if (banImg && !banImg.complete) banImg.addEventListener("load", ajusterDefilement);
  ajusterDefilement();
}

/* ---------- Pastilles de notification (annonces + forum) ---------- */
function marquerNotif(id, n) {
  const el = document.getElementById(id);
  if (!el || el.querySelector(".notif-dot")) return;
  el.insertAdjacentHTML("beforeend", `<span class="notif-dot">${n > 9 ? "9+" : n}</span>`);
  const trig = document.getElementById("nav-espace-trigger");
  if (trig && !trig.querySelector(".notif-point")) {
    trig.insertAdjacentHTML("beforeend", `<span class="notif-point"></span>`);
  }
}
// Badge chiffré sur l'icône de l'app installée (PWA).
// Pris en charge par Android Chrome et Chrome/Edge sur ordinateur ; pas par iOS.
function majBadgeApp(total) {
  try {
    if ("setAppBadge" in navigator) {
      if (total > 0) navigator.setAppBadge(total); else navigator.clearAppBadge();
    }
  } catch (_) {}
}
// Compte les éléments non lus : annonces ciblées (hors événements passés) + forum.
async function compterNonLus(profil) {
  let annonces = 0, forum = 0;
  if (!sb) return { annonces, forum, total: 0 };
  try {
    const { data } = await sb.from("annonces")
      .select("cree_le, cible, date_evenement").order("cree_le", { ascending: false }).limit(30);
    const now = new Date();
    const st = statutCotisation(profil);
    const voitTout = profil.role === "bureau";
    const visibles = (data || []).filter(a => {
      const okCible = voitTout || a.cible === "tous" || (a.cible === "ajour" && st.aJour) || (a.cible === "retard" && !st.aJour);
      if (!okCible) return false;
      if (a.date_evenement && new Date(a.date_evenement) < now) return false;
      return true;
    });
    const vu = parseInt(localStorage.getItem("TOH_vu_annonces") || "0", 10);
    annonces = visibles.filter(a => new Date(a.cree_le).getTime() > vu).length;
  } catch (_) {}
  // Forum : compté uniquement si le membre y a accès (cotisation validée),
  // sinon la pastille ne pourrait jamais s'effacer.
  if (aDroitAcces(profil)) try {
    const { data } = await sb.from("forum_messages")
      .select("cree_le").order("cree_le", { ascending: false }).limit(100);
    const vu = parseInt(localStorage.getItem("TOH_vu_forum") || "0", 10);
    forum = (data || []).filter(m => new Date(m.cree_le).getTime() > vu).length;
  } catch (_) {}
  return { annonces, forum, total: annonces + forum };
}
// Retire les notifications encore affichées dans la barre du téléphone.
async function fermerNotifsAffichees() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    (await reg.getNotifications()).forEach((n) => n.close());
  } catch (_) {}
}
async function verifierNotifications(profil) {
  const c = await compterNonLus(profil);
  if (c.annonces > 0) marquerNotif("nav-tableau", c.annonces);
  if (c.forum > 0) marquerNotif("nav-forum", c.forum);
  majBadgeApp(c.total);
  if (c.total === 0) fermerNotifsAffichees();   // plus rien à lire → on nettoie tout
}
// À appeler après lecture (Mon espace / Forum) : met à jour le chiffre ET
// retire les bannières de notification affichées (le membre est en train de lire).
async function rafraichirBadge(profil) {
  const c = await compterNonLus(profil);
  majBadgeApp(c.total);
  fermerNotifsAffichees();
}

function afficherBanniereConfig() {
  const d = document.createElement("div");
  d.style.cssText = "background:#b2381f;color:#fff;padding:0.6rem 1rem;text-align:center;font-size:0.9rem";
  d.innerHTML = "⚙️ Supabase n'est pas encore configuré — voir <strong>SETUP.md</strong>. Le site s'affiche mais les comptes, signalements et le forum ne fonctionneront qu'après configuration.";
  document.getElementById("nav-mount").appendChild(d);
}

function rendreFooter() {
  document.getElementById("footer-mount").innerHTML = `
    <footer class="site">
      <div class="foot-inner">
        <div>
          <h4>Te Ora Hau</h4>
          <p>« Vivre en paix » — association polynésienne de lutte contre les nuisances sonores, fondée en 1998.</p>
        </div>
        <div>
          <h4>Agir</h4>
          <p><a href="signaler.html">Signaler une nuisance</a></p>
          <p><a href="outils.html">Courriers &amp; journal de bruit</a></p>
          <p><a href="carte.html">Carte des nuisances</a></p>
          <p><a href="inscription.html">Adhérer</a></p>
        </div>
        <div>
          <h4>Contact</h4>
          <p>BP 2524, 98713 Papeete — Tahiti</p>
          <p><a href="mailto:contact@teorahau.net">contact@teorahau.net</a></p>
          <p><a href="tel:+68987721687">87 72 16 87</a> · <a href="tel:+68989750415">89 75 04 15</a></p>
          <p style="margin-top:0.5rem"><a href="contact.html"><strong>Nous contacter →</strong></a></p>
        </div>
      </div>
      <div class="foot-bas">
        © ${new Date().getFullYear()} Te Ora Hau · <a href="mentions-legales.html" style="color:var(--or)">Mentions légales</a>
      </div>
    </footer>`;
}

/* ---------- Initialisation de page ---------- */
async function initPage(pageActive) {
  await rendreNav(pageActive);
  rendreFooter();
}

/* ---------- Garde d'accès ---------- */
async function exigerConnexion(redir) {
  const s = await sessionActive();
  if (!s && redir !== false) return null;
  return s;
}

/* ---------- Utilitaires ---------- */
function echapper(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
// Nom complet pour l'affichage = "NOM Prénom" (rétro-compatible : si "nom"
// contient déjà le nom complet et que "prenom" est vide, renvoie "nom").
function nomComplet(p) {
  if (!p) return "";
  return ((p.nom || "") + (p.prenom ? " " + p.prenom : "")).trim();
}
function maintenantTexte() {
  const d = new Date(); const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
// Communes simples + districts (pour les communes qui en comptent plusieurs).
const COMMUNES_PF = [
  "Papeete", "Pirae", "Arue", "Mahina",
  // Hitiaa O Te Ra
  "Papenoo", "Tiarei", "Maha'ena", "Hitia'a",
  // Taiarapu-Est
  "Faaone", "Afaahiti", "Pueu", "Tautira",
  // Taiarapu-Ouest
  "Toahotu", "Vairao", "Teahupo'o",
  // Teva I Uta
  "Mataiea", "Papeari",
  "Papara", "Paea", "Punaauia", "Faa'a",
  "Moorea-Maiao", "Autre"
];

// Communes détaillées en localités (uniquement celles qui le nécessitent).
// Les autres communes restent au nom de la commune ; l'adresse précise le lieu.
const COMMUNES_DETAIL = {
  "Teva I Uta": ["Mataiea","Papeari"],
  "Taiarapu-Ouest": ["Teahupoo","Toahotu","Vairao"],
  "Taiarapu-Est": ["Taravao","Afaahiti","Faaone","Pueu","Tautira"],
  "Hitiaa O Te Ra": ["Hitiaa","Mahaena","Papenoo","Tiarei"],
};

// Liste simple des communes, triées par ordre alphabétique ("Autre" en dernier).
function optionsCommunes(selected) {
  const liste = COMMUNES_PF.filter(c => c !== "Autre").sort((a, b) => a.localeCompare(b, "fr"));
  liste.push("Autre");
  return '<option value="">— Choisir —</option>' +
    liste.map(c => `<option${c === selected ? " selected" : ""}>${c}</option>`).join("");
}

// Affiche un champ "préciser" quand la commune choisie est "Autre".
// Retourne valeurCommune() : le texte saisi si "Autre", sinon la commune.
function brancherCommuneAutre(select, input) {
  const maj = () => { if (input) input.style.display = (select.value === "Autre") ? "" : "none"; };
  select.addEventListener("change", maj); maj();
  return () => (select.value === "Autre") ? ((input && input.value.trim()) || "Autre") : select.value;
}

/* ---------- Listes de référence des signalements (source unique) ----------
   Utilisées par signaler.html, mes-signalements.html et carte.html, pour
   éviter toute divergence entre la création, l'édition et l'affichage. */
const SIG_TYPES = [
  "Voisinage (habitation)", "Sono de voiture", "Bar / restaurant / discothèque",
  "Chantier / travaux", "Deux-roues / moteur", "Animaux", "Manifestation / fête", "Autre"
];
const SIG_HORAIRES = ["Jour", "Soir", "Nuit (après 22h)"];
const SIG_INTENSITES = ["Faible", "Moyenne", "Forte", "Insupportable"];
const SIG_RECURRENCES = ["Ponctuel", "Régulier", "Permanent"];
const SIG_CONSTATS = ["Signalement seul", "Constat d'autorité", "Constat + plainte"];
const MOIS_FR = ["janvier","février","mars","avril","mai","juin",
  "juillet","août","septembre","octobre","novembre","décembre"];

// Génère des <option> à partir d'une liste ; "selected" présélectionne une
// valeur, "placeholder" ajoute une première option vide (ex. "— Choisir —").
function optionsListe(liste, selected, placeholder) {
  return (placeholder ? `<option value="">${placeholder}</option>` : "") +
    liste.map(o => `<option${o === selected ? " selected" : ""}>${o}</option>`).join("");
}

// Formate une valeur "AAAA-MM" en "mois AAAA" (ex. 2026-06 -> "juin 2026").
function moisAnnee(v) {
  if (!v) return "";
  const p = String(v).split("-");
  return (MOIS_FR[parseInt(p[1]) - 1] || "") + " " + p[0];
}

// Géocodage inverse : coordonnées -> commune + quartier + adresse (OpenStreetMap)
async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&addressdetails=1&accept-language=fr&lat=" + lat + "&lon=" + lng);
    const d = await r.json();
    const a = d.address || {};
    return {
      commune: a.municipality || a.town || a.city || a.county || a.region || "",
      quartier: a.suburb || a.neighbourhood || a.quarter || a.village || a.hamlet || a.locality || "",
      adresse: d.display_name || "",
    };
  } catch (_) { return null; }
}
