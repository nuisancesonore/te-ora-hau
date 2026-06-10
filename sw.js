// Te Ora Hau — service worker minimal.
// But : permettre l'installation en vraie application (PWA) sur Android,
// ce qui active le badge chiffré sur l'icône. Pas de cache hors-ligne ici
// (la requête réseau reste gérée normalement par le navigateur).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
