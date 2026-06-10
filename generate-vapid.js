// Génère une paire de clés VAPID pour les notifications push.
// Aucune dépendance. Lancez :  node generate-vapid.js
const crypto = require("crypto");
const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();
const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
console.log("");
console.log("VAPID_PUBLIC_KEY  =", b64url(ecdh.getPublicKey()));   // -> js/config.js (publique, non secrète)
console.log("VAPID_PRIVATE_KEY =", b64url(ecdh.getPrivateKey()));  // -> secret Supabase (NE JAMAIS committer)
console.log("");
