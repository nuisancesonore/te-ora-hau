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
  // (La clé PRIVÉE correspondante reste secrète, côté Supabase uniquement.)
  VAPID_PUBLIC_KEY: "BPeHR_Okyy-LH_aIDmDCPSKMl5F6RD7tSNjfzDLAe9oP3F79XDBuOSmWRxnlx7YWxRsk1qKCyBbAYedQcGJ8BMs",
};
