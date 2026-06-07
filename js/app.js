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

function traduireErreur(m) {
  if (/already registered/i.test(m)) return "Un compte existe déjà avec cet e-mail.";
  if (/Invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (/at least 6/i.test(m)) return "Le mot de passe doit contenir au moins 6 caractères.";
  return m;
}

/* ---------- Navigation dynamique ---------- */
async function rendreNav(pageActive) {
  const profil = await monProfil();
  const liens = [
    { href: "index.html", label: "Accueil", id: "accueil" },
    { href: "le-bruit.html", label: "Le bruit & la loi", id: "bruit" },
    { href: "comprendre.html", label: "Comprendre le son", id: "comprendre" },
    { href: "carte.html", label: "Carte des nuisances", id: "carte" },
    { href: "association.html", label: "L'association", id: "association" },
    { href: "forum.html", label: "Forum", id: "forum" },
  ];

  let menuLiens = liens.map(l =>
    `<a href="${l.href}" class="${l.id === pageActive ? "actif" : ""}">${l.label}</a>`
  ).join("");

  let droite;
  if (profil) {
    if (profil.role === "bureau") {
      menuLiens += `<a href="admin.html" class="${pageActive === "admin" ? "actif" : ""}">Admin</a>`;
    }
    droite = `<a href="espace.html" class="${pageActive === "espace" ? "actif" : ""}">🌺 Mon espace</a>
              <a href="#" class="bouton" onclick="deconnecter();return false;">Déconnexion</a>`;
  } else {
    droite = `<a href="connexion.html" class="${pageActive === "connexion" ? "actif" : ""}">Connexion</a>
              <a href="inscription.html" class="bouton">Adhérer</a>`;
  }

  document.getElementById("nav-mount").innerHTML = `
    <section class="banniere">
      <a href="index.html"><img src="images/bandeau.png"
         alt="STOP au bruit — Pour vivre en paix sans nuisances sonores"></a>
    </section>
    <header class="site">
      <div class="nav-inner">
        <a href="index.html" class="brand">
          <span class="logo"><img src="images/logo%20TOH.PNG" alt="Logo Te Ora Hau"></span>
          <span>
            <span class="titre">Te Ora Hau</span>
            <span class="sous">Vivre en paix · Lutte contre le bruit</span>
          </span>
        </a>
        <nav class="menu">${menuLiens}${droite}</nav>
      </div>
    </header>`;

  if (!TOH_PRET) afficherBanniereConfig();
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
          <p><a href="inscription.html">Devenir membre</a></p>
        </div>
        <div>
          <h4>Contact</h4>
          <p>📍 Papeete, Tahiti</p>
          <p>✉️ contact@teorahau.net</p>
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
const COMMUNES_PF = ["Papeete","Faa'a","Punaauia","Pirae","Arue","Mahina","Paea","Papara","Moorea-Maiao","Taiarapu-Est","Taiarapu-Ouest","Teva I Uta","Autre"];
