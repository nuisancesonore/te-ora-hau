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
  if (req.method !== "POST") return json({error:"Méthode non autorisée"},405);
  try {
    // Seul le bureau peut envoyer.
    const auth = req.headers.get("Authorization") || "";
    const asUser = createClient(SB_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: estBureau } = await asUser.rpc("is_bureau");
    if (!estBureau) return json({ error: "Réservé au bureau" }, 403);

    const input = await req.json();
    const testPersonnel = input.action === "test_perso";
    if (testPersonnel && (typeof input.endpoint !== "string" || !input.endpoint.startsWith("https://") || input.endpoint.length > 4096))
      return json({error:"Abonnement de l’appareil requis. Rechargez la page et réactivez les notifications dans Mon espace."},400);
    if (input.action && !["send","test_perso"].includes(input.action)) return json({error:"Action invalide"},400);
    const { titre, corps, cible, dry_run = false } = testPersonnel
      ? {titre:"Test Te Ora Hau",corps:"Si vous voyez ce message, votre appareil reçoit les notifications Te Ora Hau.",cible:"tous",dry_run:false}
      : input;
    if (!["tous","ajour","retard"].includes(cible) || typeof titre !== "string" || !titre.trim() || titre.length > 200 || typeof corps !== "string" || corps.length > 4000 || typeof dry_run !== "boolean")
      return json({error:"Message ou groupe invalide"},400);
    const admin = createClient(SB_URL, SERVICE);

    let ids: string[];
    if (testPersonnel) {
      const {data, error} = await asUser.auth.getUser();
      if (error || !data.user) return json({error:"Connexion requise"},401);
      // Aucun identifiant envoyé par le navigateur ne peut changer la cible.
      ids = [data.user.id];
    } else {
      const { data: profs, error: profError } = await admin.from("profils").select("id, cotisation_payee, cotisation_echeance, acces_suspendu");
      if (profError) return json({error:"Lecture des destinataires impossible"},503);
      const today = new Date().toLocaleDateString("en-CA", {timeZone:"Pacific/Tahiti"});
      const aJour = (m: any) => m.cotisation_payee && (!m.cotisation_echeance || String(m.cotisation_echeance).slice(0,10) >= today);
      ids = (profs || [])
        .filter((m: any) => !m.acces_suspendu)
        .filter((m: any) => cible === "ajour" ? aJour(m) : cible === "retard" ? !aJour(m) : true)
        .map((m: any) => m.id);
    }
    if (!ids.length) return json({ ok: true, envoyes: 0 });

    let query = admin.from("push_subscriptions").select("endpoint, subscription").in("user_id", ids);
    if (testPersonnel) query = query.eq("endpoint", input.endpoint);
    const { data: subs, error: subError } = await query;
    if (subError) return json({error:"Lecture des abonnements impossible"},503);
    if (dry_run) return json({ok:true,simulation:true,membres:ids.length,appareils:(subs||[]).length,envoyes:0});
    const payload = JSON.stringify({ title: titre || "Te Ora Hau", body: corps || "", url: "/te-ora-hau/espace.html", ...(testPersonnel ? {tag:"toh-test",requireInteraction:true} : {}) });

    let envoyes = 0, echecs = 0;
    for (const s of subs || []) {
      try { await webpush.sendNotification(s.subscription, payload); envoyes++; }
      catch (e: any) {
        echecs++;
        const code = e?.statusCode;
        // Abonnement expiré / invalide → on le supprime.
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
    return json({ ok: echecs === 0, envoyes, echecs, test_personnel:testPersonnel });
  } catch (e) {
    return json({ error: "Erreur d'envoi des notifications" }, 500);
  }
});
