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
async function inscrire(nom, prenom, email, motdepasse, commune, extra) {
  // Toutes les infos passent dans les métadonnées du compte : le profil est
  // créé complet par le trigger SQL, même si l'e-mail doit être confirmé.
  const meta = Object.assign({ nom, prenom: prenom || "", commune: commune || "" }, extra || {});
  const { data, error } = await sb.auth.signUp({
    email, password: motdepasse,
    options: { data: meta },
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
  // Date « AAAA-MM-JJ » lue en heure locale (le suffixe T00:00:00 évite le
  // décalage d'un jour dû au fuseau UTC — ex. Polynésie -10h).
  const ech = profil.cotisation_echeance ? new Date(String(profil.cotisation_echeance).slice(0,10) + "T00:00:00") : null;
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
  m = String(m || "");
  if (/already registered/i.test(m)) return "Un compte existe déjà avec cet e-mail.";
  if (/Invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (/at least (\d+)/i.test(m)) return "Le mot de passe doit contenir au moins " + m.match(/at least (\d+)/i)[1] + " caractères.";
  if (/Email not confirmed/i.test(m)) return "Votre adresse e-mail n'a pas encore été confirmée : ouvrez le message reçu lors de votre inscription.";
  // Limitation anti-abus de Supabase : « you can only request this after N seconds ».
  const attente = m.match(/after (\d+) seconds?/i);
  if (attente) return "Trop de demandes rapprochées. Merci de patienter " + attente[1] + " secondes avant de réessayer.";
  if (/rate limit/i.test(m)) return "Trop de demandes d'e-mail en peu de temps. Réessayez dans quelques minutes.";
  if (/New password should be different/i.test(m)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/Auth session missing|session_not_found|invalid claim|JWT/i.test(m)) return "Votre lien n'est plus valable. Redemandez un lien de réinitialisation.";
  if (/expired|otp_expired/i.test(m)) return "Ce lien a expiré. Redemandez un lien de réinitialisation.";
  // Peut venir du reseau du membre OU d'une indisponibilite du serveur :
  // on ne met pas la faute sur le membre sans reserve.
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Connexion au serveur impossible. Vérifiez votre connexion Internet ; si le problème persiste, le service est momentanément indisponible — prévenez le bureau à contact@teorahau.net.";
  if (/User not found/i.test(m)) return "Aucun compte ne correspond à cette adresse e-mail.";
  return m;
}

/* ---------- Navigation dynamique ---------- */
async function rendreNav(pageActive) {
  const profil = await monProfil();
  const lien = (href, label, id) =>
    `<a href="${href}" class="${id === pageActive ? "actif" : ""}">${label}</a>`;

  // ------------------------------------------------------------------
  // Menu simplifie : six categories au maximum, orientees ACTION.
  // Les pages d'information sont regroupees sous « Comprendre » ; les
  // fonctions du membre ne sont plus enfouies dans un deroulant, elles
  // vivent dans « Mon espace », qui est le tableau de bord.
  // ------------------------------------------------------------------
  const pagesComprendre = ["association", "comprendre", "bruit"];
  const comprendre = `
    <div class="menu-drop">
      <a href="association.html" class="drop-trigger ${pagesComprendre.includes(pageActive) ? "actif" : ""}">Comprendre <span class="caret">▾</span></a>
      <div class="drop-menu">
        <a href="association.html">Qui sommes-nous&nbsp;?</a>
        <a href="comprendre.html#audition">Le son &amp; l'audition</a>
        <a href="comprendre.html#sante">Bruit &amp; santé</a>
        <a href="le-bruit.html">Les textes de lois</a>
      </div>
    </div>`;

  let blocAuth;
  if (profil) {
    // Membre connecte : l'action principale (signaler) et son espace, rien de plus.
    const acces = aDroitAcces(profil);
    const espaceActif = ["espace", "profil", "mes-signalements", "annuaire", "forum",
                         "outils", "missions", "cotiser"].includes(pageActive) ? "actif" : "";
    blocAuth =
      `<a href="${acces ? "signaler.html" : "cotiser.html"}" class="${pageActive === "signaler" ? "actif" : ""}">${acces ? "" : "🔒 "}Signaler une nuisance</a>` +
      `<a href="espace.html" id="nav-espace-trigger" class="${espaceActif}">Mon espace</a>` +
      (profil.role === "bureau" ? lien("admin.html", "Admin", "admin") : "") +
      `<a href="#" class="bouton" onclick="deconnecter();return false;">Déconnexion</a>`;
  } else {
    // Visiteur : une seule action mise en avant, adherer.
    blocAuth =
      `<a href="inscription.html" class="lien-cotiser ${pageActive === "inscription" ? "actif" : ""}">Adhérer</a>` +
      lien("connexion.html", "Connexion", "connexion");
  }

  const menuHTML = [
    lien("index.html", "Accueil", "accueil"),
    comprendre,
    lien("carte.html", "Carte des nuisances", "carte"),
    blocAuth,
  ].join("");

  const mount = document.getElementById("nav-mount");
  mount.innerHTML = `
    <section class="banniere">
      <a href="index.html"><img src="images/bandeau.jpg" width="1536" height="364"
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
          <span class="logo"><img src="images/logo-192.png" width="192" height="181" alt="Logo Te Ora Hau"></span>
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
  // Missions : nouvelles missions qui concernent l'assesseur (le bureau, lui,
  // pilote les missions depuis l'Administration).
  let missions = 0;
  if (profil.type_adhesion === "Assesseur") try {
    const { data } = await sb.from("missions")
      .select("cree_le, assigne_a, statut").order("cree_le", { ascending: false }).limit(50);
    const vu = parseInt(localStorage.getItem("TOH_vu_missions") || "0", 10);
    missions = (data || []).filter(m =>
      new Date(m.cree_le).getTime() > vu &&
      m.statut !== "Terminée" && m.statut !== "Abandonnée" &&
      (!m.assigne_a || m.assigne_a === profil.id)).length;
  } catch (_) {}
  return { annonces, forum, missions, total: annonces + forum + missions };
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
  if (c.annonces > 0) marquerNotif("nav-espace-trigger", c.annonces);
  if (c.forum > 0 && !document.getElementById("nav-forum")) marquerNotif("nav-espace-trigger", c.forum);
  else if (c.forum > 0) marquerNotif("nav-forum", c.forum);
  if (c.missions > 0 && !document.getElementById("nav-missions")) marquerNotif("nav-espace-trigger", c.missions);
  else if (c.missions > 0) marquerNotif("nav-missions", c.missions);
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
          <h2 class="foot-titre">Te Ora Hau</h2>
          <p>« Vivre en paix » — association polynésienne de lutte contre les nuisances sonores, fondée en 1998.</p>
        </div>
        <div>
          <h2 class="foot-titre">Agir</h2>
          <p><a href="signaler.html">Signaler une nuisance</a></p>
          <p><a href="outils.html">Courriers &amp; journal de bruit</a></p>
          <p><a href="carte.html">Carte des nuisances</a></p>
          <p><a href="inscription.html">Adhérer</a></p>
          <p><a href="guide-membre.html">Mode d'emploi</a></p>
        </div>
        <div>
          <h2 class="foot-titre">Contact</h2>
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

/* ============================================================
   Champs « mot de passe » — briques partagées
   (utilisées par connexion.html, inscription.html, mot-de-passe.html)
   ============================================================ */

/* Ajoute un œil « Afficher / Masquer » à droite d'un champ mot de passe.
   Indispensable sur téléphone : on tape à l'aveugle sinon. */
function oeilMotDePasse(input) {
  if (!input || input.dataset.oeil) return;
  input.dataset.oeil = "1";
  const boite = document.createElement("div");
  boite.className = "champ-mdp";
  input.parentNode.insertBefore(boite, input);
  boite.appendChild(input);
  const b = document.createElement("button");
  b.type = "button"; b.className = "oeil";
  b.setAttribute("aria-label", "Afficher le mot de passe");
  b.textContent = "👁";
  b.addEventListener("click", () => {
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    b.classList.toggle("actif", visible);
    b.setAttribute("aria-label", visible ? "Masquer le mot de passe" : "Afficher le mot de passe");
    input.focus();
  });
  boite.appendChild(b);
}

/* Note de robustesse d'un mot de passe : 0 (vide) à 4 (solide). */
function forceMotDePasse(v) {
  v = v || "";
  if (!v) return 0;
  let n = 0;
  if (v.length >= 8) n++;
  if (v.length >= 12) n++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++;
  if (/[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v)) n++;
  else if (/[0-9]/.test(v) || /[^A-Za-z0-9]/.test(v)) n += 0.5;
  if (v.length < 8) n = Math.min(n, 1);
  return Math.max(1, Math.min(4, Math.round(n)));
}

/* Jauge visuelle sous un champ mot de passe + contrôle de concordance
   avec le champ de confirmation (mis à jour à chaque frappe). */
function jaugeMotDePasse(input, confirmation) {
  if (!input || input.dataset.jauge) return;
  input.dataset.jauge = "1";
  const NIVEAUX = ["", "Trop faible", "Correct", "Bon", "Solide"];
  const bloc = document.createElement("div");
  bloc.className = "jauge-bloc";
  bloc.innerHTML = `<div class="jauge"><span></span></div><p class="jauge-txt"></p>`;
  (input.closest(".champ-mdp") || input).insertAdjacentElement("afterend", bloc);
  const barre = bloc.querySelector("span");
  const txt = bloc.querySelector(".jauge-txt");

  function maj() {
    const n = forceMotDePasse(input.value);
    bloc.className = "jauge-bloc n" + n;
    barre.style.width = (n * 25) + "%";
    let t = input.value ? NIVEAUX[n] : "";
    if (input.value && n <= 1) t += " — visez 8 caractères minimum, avec chiffres et majuscules";
    if (confirmation && confirmation.value) {
      t += (t ? " · " : "") + (confirmation.value === input.value
        ? "les deux saisies correspondent ✔"
        : "les deux saisies diffèrent ✘");
      confirmation.classList.toggle("champ-ko", confirmation.value !== input.value);
    }
    txt.textContent = t;
  }
  input.addEventListener("input", maj);
  if (confirmation) confirmation.addEventListener("input", maj);
  maj();
}

/* Un envoi est-il déjà en cours pour ce formulaire ?
   À tester en TÊTE de chaque gestionnaire « submit » : désactiver le bouton
   n'empêche PAS la touche Entrée de soumettre le formulaire une seconde fois. */
function envoiEnCours(form) {
  return !!(form && form.dataset && form.dataset.envoiEnCours === "1");
}

/* Verrouille un bouton pendant un envoi (évite les doubles soumissions).
   Renvoie la fonction à appeler pour le rendre à son état initial. */
function boutonOccupe(btn, texte) {
  if (!btn) return () => {};
  const form = btn.form || btn.closest("form");
  // Déjà verrouillé : on ne re-verrouille pas, sinon le libellé d'attente
  // (« Envoi… ») deviendrait le libellé définitif du bouton.
  if (btn.dataset.occupe === "1") return () => {};

  const initial = btn.textContent;
  btn.dataset.occupe = "1";
  btn.disabled = true;
  btn.classList.add("occupe");
  if (texte) btn.textContent = texte;
  if (form) form.dataset.envoiEnCours = "1";

  return () => {
    delete btn.dataset.occupe;
    btn.disabled = false;
    btn.classList.remove("occupe");
    btn.textContent = initial;
    if (form) delete form.dataset.envoiEnCours;
  };
}

/* Compte à rebours sur un bouton (anti-renvoi en rafale des e-mails). */
function boutonAttente(btn, secondes, gabarit) {
  if (!btn) return;
  const initial = btn.dataset.libelle || btn.textContent;
  btn.dataset.libelle = initial;
  let reste = secondes;
  btn.disabled = true;
  btn.classList.add("occupe");
  const tic = () => {
    btn.textContent = (gabarit || "Réessayer dans %s s").replace("%s", reste);
    if (reste-- <= 0) {
      clearInterval(minuteur);
      btn.disabled = false;
      btn.classList.remove("occupe");
      btn.textContent = initial;
    }
  };
  tic();
  const minuteur = setInterval(tic, 1000);
}

/* ---------- Soumission de formulaire — comportement unique du site ----------
   Verrouille le bouton pendant l'appel réseau (fin des doubles envois),
   puis le rend quoi qu'il arrive. Utilisé par tous les formulaires. */
function boutonForm(form) {
  return form ? form.querySelector('button[type="submit"], button:not([type])') : null;
}
async function soumettre(form, texteAttente, action) {
  if (envoiEnCours(form)) return undefined;
  const rendre = boutonOccupe(boutonForm(form), texteAttente);
  try { return await action(); }
  finally { rendre(); }
}

/* Message d'erreur destiné à un adhérent : jamais d'anglais brut, jamais de
   jargon SQL. "indice" ajoute une précision réservée au bureau (nom de
   migration à lancer, par exemple). */
function messageErreur(error, indice) {
  if (!error) return "";
  const brut = error.message || String(error);
  const traduit = traduireErreur(brut);
  // Erreurs techniques de la base : on n'expose pas le détail à l'adhérent.
  if (traduit === brut && /column|schema cache|does not exist|relation|violates|PGRST|permission denied|row-level security/i.test(brut)) {
    return "Enregistrement impossible pour le moment." +
      (indice ? " (" + indice + ")" : " Réessayez, et prévenez le bureau si cela persiste.");
  }
  return traduit;
}

/* ---------- Action declenchee par un bouton (hors formulaire) ----------
   Meme protection que pour les formulaires, mais pour les boutons d'action
   du bureau : valider une cotisation, publier une annonce, supprimer une
   mission... Un double clic ne doit pas creer de doublon en base.

   Usage :  <button onclick="validerCoti('id', this)">Valider</button>
            async function validerCoti(id, btn){
              return actionBouton(btn, "…", async () => { ... });
            }                                                              */
async function actionBouton(btn, texte, action) {
  if (btn && btn.dataset && btn.dataset.occupe === "1") return undefined;
  const rendre = boutonOccupe(btn, texte);
  try { return await action(); }
  finally { rendre(); }
}


/* ============================================================
   Referentiel des demarches contre une nuisance sonore
   ------------------------------------------------------------
   Etabli a partir des dossiers reels de l'association (mairie,
   gendarmerie, DIREN, IJSPF, ministeres, Presidence, tribunal
   administratif). Chaque etape porte :
     v     le libelle enregistre en base
     dest  le destinataire suggere
     mode  le mode d'envoi conseille
     delai le delai de reponse raisonnable, en jours
     aide  ce que l'adherent doit savoir avant de l'engager
   ============================================================ */
const DEMARCHES_REF = [
  { g: "1 · À l'amiable", items: [
    { v: "Courrier amiable au responsable du bruit", dest: "L'auteur du bruit (voisin, exploitant, gérant)",
      mode: "Courrier simple", delai: 15,
      aide: "Première étape presque toujours indispensable : elle prouve votre bonne foi et conditionne la suite. Restez factuel, datez les faits." },
    { v: "Mise en demeure", dest: "L'auteur du bruit", mode: "Recommandé A.R.", delai: 15,
      aide: "Après un courrier amiable resté sans effet. Conservez précieusement l'avis de réception : il fait courir les délais." },
    { v: "Courrier au bailleur ou au syndic", dest: "Propriétaire, bailleur ou syndic de copropriété",
      mode: "Recommandé A.R.", delai: 30,
      aide: "Le bailleur est tenu d'assurer la jouissance paisible du logement ; il peut agir sur son locataire." },
  ]},
  { g: "2 · La commune", items: [
    { v: "Demande d'intervention au Maire", dest: "Mairie de votre commune", mode: "Recommandé A.R.", delai: 60,
      aide: "Le maire est chargé du bon ordre et de la tranquillité publique. La police municipale peut constater les infractions aux arrêtés municipaux par procès-verbal." },
    { v: "Demande d'arrêté municipal anti-bruit", dest: "Mairie de votre commune", mode: "Recommandé A.R.", delai: 60,
      aide: "Quand la nuisance est récurrente et collective. Un arrêté municipal peut encadrer les horaires et les niveaux sonores." },
  ]},
  { g: "3 · Forces de l'ordre", items: [
    { v: "Signalement gendarmerie / police municipale", dest: "Brigade de gendarmerie ou police municipale",
      mode: "Sur place", delai: 30,
      aide: "Pour un bruit de nuit : le tapage nocturne est réprimé par l'article R. 623-2 du code pénal. Appelez pendant les faits — le constat sur le moment a le plus de valeur." },
    { v: "Dépôt de plainte", dest: "Brigade de gendarmerie", mode: "Sur place", delai: 60,
      aide: "Demandez systématiquement le récépissé de dépôt : il vous sera réclamé par la suite." },
  ]},
  { g: "4 · Services du Pays", items: [
    { v: "Saisine de la DIREN (environnement)", dest: "Direction de l'environnement de la Polynésie française",
      mode: "Recommandé A.R.", delai: 60,
      aide: "Compétente pour la réglementation sur le bruit du Code de l'environnement polynésien, notamment les installations classées." },
    { v: "Saisine de l'IJSPF (sports mécaniques)", dest: "Institut de la jeunesse et des sports de la Polynésie française",
      mode: "Recommandé A.R.", delai: 60,
      aide: "Compétent pour les sites et manifestations sportives : circuits, terrains de motocross, compétitions." },
    { v: "Saisine de la Direction de la santé", dest: "Direction de la santé de la Polynésie française",
      mode: "Recommandé A.R.", delai: 60,
      aide: "Quand la nuisance a des effets documentés sur la santé : sommeil, acouphènes, stress. Joignez vos certificats médicaux." },
    { v: "Saisine du Ministre concerné", dest: "Ministère en charge du secteur (Sports, Environnement, Logement…)",
      mode: "Recommandé A.R.", delai: 60,
      aide: "Quand le service compétent n'a pas répondu ou s'est déclaré incompétent. Mettez en copie les autres services déjà saisis." },
    { v: "Saisine de la Présidence de la Polynésie française", dest: "Présidence de la Polynésie française, BP 2551, 98713 Papeete",
      mode: "Recommandé A.R.", delai: 60,
      aide: "Étape haute de la voie administrative. Souvent adressée en parallèle du ministère et du service concerné." },
    { v: "Saisine du Haut-Commissariat", dest: "Haut-Commissariat de la République en Polynésie française",
      mode: "Recommandé A.R.", delai: 60,
      aide: "Représentant de l'État. Utile lorsque l'ordre public ou une compétence de l'État est en jeu." },
  ]},
  { g: "5 · Voie contentieuse", items: [
    { v: "Réclamation préalable indemnitaire (art. R. 421-1 CJA)", dest: "L'administration responsable (Pays, IJSPF, commune…)",
      mode: "Recommandé A.R.", delai: 60, cle: "prealable",
      aide: "ÉTAPE OBLIGATOIRE avant de saisir le tribunal administratif. Le silence gardé pendant 2 mois vaut refus, et ouvre alors un délai de 2 mois pour déposer votre recours. Chiffrez votre préjudice." },
    { v: "Recours au tribunal administratif de Papeete", dest: "Tribunal administratif de Papeete",
      mode: "Recommandé A.R.", delai: 180,
      aide: "À déposer dans les 2 mois suivant le refus, explicite ou implicite, de votre réclamation préalable. L'avocat n'est pas obligatoire mais vivement conseillé." },
    { v: "Plainte au Procureur de la République", dest: "Procureur de la République, Tribunal de première instance de Papeete",
      mode: "Recommandé A.R.", delai: 90,
      aide: "Voie pénale, distincte de la voie administrative. Joignez les procès-verbaux et constats déjà obtenus." },
    { v: "Saisine d'un avocat", dest: "Cabinet d'avocats", mode: "E-mail", delai: 15,
      aide: "Pour un trouble anormal de voisinage ou un contentieux administratif. Rassemblez d'abord votre dossier complet." },
  ]},
  { g: "6 · Preuves et appuis", items: [
    { v: "Constat d'huissier", dest: "Huissier de justice", mode: "Sur place", delai: 30,
      aide: "La preuve la plus solide, mais payante. À faire réaliser pendant les nuisances, aux horaires que vous aurez relevés." },
    { v: "Attestation de témoin", dest: "Voisin, visiteur, proche", mode: "Dépôt en main propre", delai: 15,
      aide: "Modèle disponible sur le site. Le témoin doit joindre une copie de sa pièce d'identité." },
    { v: "Certificat médical ou ORL", dest: "Médecin traitant ou médecin ORL", mode: "Sur place", delai: 15,
      aide: "Documente le préjudice de santé : troubles du sommeil, acouphènes, anxiété. Pièce décisive pour une demande d'indemnisation." },
    { v: "Mesure sonométrique", dest: "Organisme de mesure ou service technique", mode: "Sur place", delai: 45,
      aide: "Chiffre la nuisance en décibels et la confronte aux valeurs limites réglementaires." },
    { v: "Pétition du voisinage", dest: "Voisins concernés", mode: "Dépôt en main propre", delai: 30,
      aide: "Montre que la gêne est collective et non individuelle. Modèle disponible sur le site." },
    { v: "Signalement à la presse", dest: "Rédaction (Tahiti Infos, La Dépêche, radios…)", mode: "E-mail", delai: 15,
      aide: "À manier avec prudence : efficace pour faire bouger un dossier enlisé, mais peut durcir les positions." },
  ]},
  { g: "7 · Autres", items: [
    { v: "Appel téléphonique", dest: "", mode: "Téléphone", delai: 7, aide: "Notez la date, l'heure et le nom de votre interlocuteur." },
    { v: "Rencontre / visite", dest: "", mode: "Sur place", delai: 7, aide: "Notez qui était présent et ce qui a été convenu." },
    { v: "Autre", dest: "", mode: "", delai: 0, aide: "" },
  ]},
];

/* Suites possibles d'une demarche, du plus courant au plus definitif. */
const DEMARCHE_SUITES = ["En attente", "Accusé de réception", "Réponse reçue",
  "Engagement pris", "Refus", "Sans réponse", "Résolu", "Classé sans suite"];

/* Retrouve la fiche d'une demarche a partir du libelle enregistre en base. */
function ficheDemarche(libelle) {
  for (const groupe of DEMARCHES_REF) {
    for (const it of groupe.items) if (it.v === libelle) return Object.assign({ groupe: groupe.g }, it);
  }
  return null;
}

/* Ou en est une demarche par rapport au delai raisonnable de reponse ?
   Renvoie null si la question ne se pose pas (deja repondu, pas de date). */
function echeanceDemarche(d) {
  if (!d || !d.date_demarche) return null;
  const enAttente = !d.reponse || d.reponse === "En attente" || d.reponse === "Accusé de réception";
  if (!enAttente) return null;
  const fiche = ficheDemarche(d.type);
  const delai = fiche && fiche.delai ? fiche.delai : 60;
  const jours = Math.floor((Date.now() - new Date(String(d.date_demarche).slice(0, 10) + "T00:00:00")) / 86400000);
  if (jours < 0) return null;
  const depasse = jours >= delai;
  // Cas particulier de la reclamation prealable : le silence de 2 mois vaut
  // refus et ouvre un delai de 2 mois pour saisir le tribunal administratif.
  if (fiche && fiche.cle === "prealable" && jours >= 60) {
    const reste = 120 - jours;
    return { jours, delai, depasse: true, urgent: reste <= 30,
      texte: reste > 0
        ? "Silence depuis " + jours + " jours : refus implicite acquis. Il vous reste " + reste + " jours pour saisir le tribunal administratif."
        : "Silence depuis " + jours + " jours : le délai de recours devant le tribunal administratif est dépassé." };
  }
  return { jours, delai, depasse, urgent: false,
    texte: depasse
      ? "Sans réponse depuis " + jours + " jours (délai raisonnable : " + delai + " jours) — une relance ou l'étape suivante s'impose."
      : "En attente depuis " + jours + " jour" + (jours > 1 ? "s" : "") + " (délai raisonnable : " + delai + " jours)." };
}



