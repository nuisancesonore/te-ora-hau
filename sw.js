// Te Ora Hau — service worker.
// 1) Permet l'installation en vraie application (PWA).
// 2) Reçoit les notifications push (badge sur l'icône, même app fermée).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Réception d'une notification push.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { title: "Te Ora Hau", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Te Ora Hau";
  const options = {
    body: data.body || "",
    icon: "images/icon-192.png",
    badge: "images/icon-192.png",
    data: { url: data.url || "/te-ora-hau/espace.html" },
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // Best-effort : pose aussi un badge sur l'icône (le décompte exact est
    // géré par l'OS à partir des notifications affichées).
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(); } catch (_) {}
  })());
});

// Clic sur la notification → ouvre (ou ramène) l'app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/te-ora-hau/espace.html";
  event.waitUntil((async () => {
    const tousOnglets = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of tousOnglets) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
