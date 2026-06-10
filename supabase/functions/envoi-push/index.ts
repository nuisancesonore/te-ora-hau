// ============================================================
// Te Ora Hau — Envoi de notifications push (réservé au bureau)
// Reçoit { titre, corps, cible } et envoie un push aux membres ciblés.
//
// Déploiement :
//   supabase secrets set VAPID_PUBLIC_KEY=...
//   supabase secrets set VAPID_PRIVATE_KEY=...        # clé PRIVÉE (secrète)
//   supabase secrets set VAPID_SUBJECT="mailto:contact@teorahau.net"
//   supabase functions deploy envoi-push
// ============================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@teorahau.net";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Seul le bureau peut envoyer.
    const auth = req.headers.get("Authorization") || "";
    const asUser = createClient(SB_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: estBureau } = await asUser.rpc("is_bureau");
    if (!estBureau) return json({ error: "Réservé au bureau" }, 403);

    const { titre, corps, cible } = await req.json();
    const admin = createClient(SB_URL, SERVICE);

    // Membres de l'audience visée
    const { data: profs } = await admin.from("profils").select("id, cotisation_payee, cotisation_echeance");
    const aJour = (m: any) => m.cotisation_payee && (!m.cotisation_echeance || new Date(m.cotisation_echeance) >= new Date());
    const ids = (profs || [])
      .filter((m: any) => cible === "ajour" ? aJour(m) : cible === "retard" ? !aJour(m) : true)
      .map((m: any) => m.id);
    if (!ids.length) return json({ ok: true, envoyes: 0 });

    const { data: subs } = await admin.from("push_subscriptions").select("endpoint, subscription").in("user_id", ids);
    const payload = JSON.stringify({ title: titre || "Te Ora Hau", body: corps || "", url: "/te-ora-hau/espace.html" });

    let envoyes = 0;
    for (const s of subs || []) {
      try { await webpush.sendNotification(s.subscription, payload); envoyes++; }
      catch (e: any) {
        const code = e?.statusCode;
        // Abonnement expiré / invalide → on le supprime.
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
    return json({ ok: true, envoyes });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
