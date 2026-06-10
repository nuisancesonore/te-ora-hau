/* ============================================================
   Configuration Supabase — projet "te-ora-hau"
   La clé "publishable" est publique par conception : la sécurité
   repose sur les règles RLS (voir supabase-setup.sql).
   Ne jamais mettre ici une clé "secret" / "service_role".
   ============================================================ */
window.TOH_CONFIG = {
  SUPABASE_URL: "https://alaesbkvfprgpngrowbt.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_R0hXlownDkPs0aCMvGMNaw_qU5gGkcB",
  // Clé publique VAPID pour les notifications push (voir PUSH.md).
  // Laisser vide tant que les push ne sont pas configurées.
  VAPID_PUBLIC_KEY: "",
};
