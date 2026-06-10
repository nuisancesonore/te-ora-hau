// ============================================================
// Te Ora Hau — Diffusion d'e-mail en masse (réservée au bureau)
// Reçoit { sujet, corps, cible } et envoie aux adhérents de l'audience
// (cible : 'tous' | 'ajour' | 'retard') via Resend, en copie cachée (Cci).
//
// Déploiement :
//   supabase functions deploy diffusion-email
// Secrets requis :
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto),
//   RESEND_API_KEY, MAIL_FROM ("Te Ora Hau <contact@votre-domaine>")
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("MAIL_FROM") ?? "Te Ora Hau <contact@teorahau.net>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    // Vérifie que l'appelant est bien du bureau (is_bureau() avec son JWT).
    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: estBureau } = await asUser.rpc("is_bureau");
    if (!estBureau) return new Response(JSON.stringify({ error: "Réservé au bureau" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    const { sujet, corps, cible } = await req.json();
    if (!sujet || !corps) return new Response(JSON.stringify({ error: "sujet/corps requis" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(URL, SERVICE);
    const { data: membres } = await admin.from("profils")
      .select("email, cotisation_payee, cotisation_echeance").not("email", "is", null);
    const aJour = (m: any) => m.cotisation_payee && (!m.cotisation_echeance || new Date(m.cotisation_echeance) >= new Date());
    const dest = (membres || [])
      .filter((m: any) => cible === "ajour" ? aJour(m) : cible === "retard" ? !aJour(m) : true)
      .map((m: any) => m.email).filter(Boolean);

    let envoyes = 0;
    for (let i = 0; i < dest.length; i += 50) {
      const lot = dest.slice(i, i + 50);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: FROM, bcc: lot, subject: sujet, text: corps }),
      });
      if (r.ok) envoyes += lot.length;
      else console.error("Resend", r.status, await r.text());
    }
    return new Response(JSON.stringify({ ok: true, envoyes }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
