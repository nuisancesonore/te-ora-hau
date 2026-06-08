// ============================================================
// Te Ora Hau — Rappel de cotisation par e-mail
// Envoie un rappel 2 mois avant l'échéance, puis 1 mois avant,
// uniquement aux membres dont la cotisation n'est pas encore renouvelée.
//
// Déploiement :
//   supabase functions deploy rappel-cotisation --no-verify-jwt
//
// Secrets requis (supabase secrets set ...) :
//   SUPABASE_URL                = https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = (clé service_role — JAMAIS exposée au site)
//   RESEND_API_KEY              = clé d'un compte Resend (resend.com, offre gratuite)
//   MAIL_FROM                   = "Te Ora Hau <cotisation@votre-domaine>"
//   SITE_URL                    = https://nuisancesonore.github.io/te-ora-hau
//
// Planification quotidienne : voir RAPPELS-COTISATION.md (pg_cron).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "Te Ora Hau <cotisation@teorahau.net>";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://nuisancesonore.github.io/te-ora-hau";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function joursAvant(dateStr: string): number {
  const ech = new Date(dateStr + "T00:00:00");
  return Math.ceil((ech.getTime() - Date.now()) / 86400000);
}

async function envoyer(to: string, nom: string, echeance: string, palier: string) {
  const echFr = new Date(echeance + "T00:00:00").toLocaleDateString("fr-FR");
  const sujet = `Rappel : votre cotisation Te Ora Hau arrive à échéance (${echFr})`;
  const texte =
`Bonjour ${nom || ""},

Votre cotisation à l'association Te Ora Hau arrive à échéance le ${echFr} (rappel ${palier}).

Pour continuer à soutenir notre action contre les nuisances sonores et bénéficier de l'aide de l'association, pensez à la renouveler :
${SITE_URL}/cotiser.html

Merci de votre engagement.
L'équipe Te Ora Hau — « Vivre en paix »`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to, subject: sujet, text: texte }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

Deno.serve(async () => {
  const { data, error } = await sb
    .from("profils")
    .select("id, nom, email, cotisation_echeance, rappel_60j_pour, rappel_30j_pour")
    .not("cotisation_echeance", "is", null)
    .not("email", "is", null);
  if (error) return new Response(error.message, { status: 500 });

  let envoyes = 0;
  for (const m of data ?? []) {
    const j = joursAvant(m.cotisation_echeance);
    try {
      // 1 mois avant (≤ 30 jours, encore à venir) — prioritaire
      if (j <= 30 && j >= 0 && m.rappel_30j_pour !== m.cotisation_echeance) {
        await envoyer(m.email, m.nom, m.cotisation_echeance, "à un mois");
        await sb.from("profils").update({ rappel_30j_pour: m.cotisation_echeance }).eq("id", m.id);
        envoyes++;
      }
      // 2 mois avant (≤ 60 jours, > 30)
      else if (j <= 60 && j > 30 && m.rappel_60j_pour !== m.cotisation_echeance) {
        await envoyer(m.email, m.nom, m.cotisation_echeance, "à deux mois");
        await sb.from("profils").update({ rappel_60j_pour: m.cotisation_echeance }).eq("id", m.id);
        envoyes++;
      }
    } catch (e) {
      console.error("Échec rappel pour", m.email, String(e));
    }
  }
  return new Response(JSON.stringify({ ok: true, envoyes }), {
    headers: { "Content-Type": "application/json" },
  });
});
