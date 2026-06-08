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

/* ---------- Authentification ---------- */
async function inscrire(nom, email, motdepasse, commune) {
  const { data, error } = await sb.auth.signUp({
    email, password: motdepasse,
    options: { data: { nom, commune: commune || "" } },
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
  const redirect = location.origin + location.pathname.replace(/[^/]+$/, "connexion.html");
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
  const aJour = profil.cotisation_payee &&
    (!profil.cotisation_echeance || new Date(profil.cotisation_echeance) >= new Date());
  return {
    aJour,
    echeance: profil.cotisation_echeance ? new Date(profil.cotisation_echeance).toLocaleDateString("fr-FR") : "—",
    numero: profil.id.slice(0, 8).toUpperCase(),
  };
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
    // Membre connecté : Mon espace · Cotiser · (Admin) · Déconnexion
    blocAuth = [
      lien("espace.html", "Mon espace", "espace"),
      `<a href="cotiser.html" class="lien-cotiser ${pageActive === "cotiser" ? "actif" : ""}">Cotiser</a>`,
      (profil.role === "bureau" ? lien("admin.html", "Admin", "admin") : ""),
      `<a href="#" class="bouton" onclick="deconnecter();return false;">Déconnexion</a>`,
    ].join("");
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
    lien("forum.html", "Forum", "forum"),
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
