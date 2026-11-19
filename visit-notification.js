(() => {
  const key = "68inspired_visit_activity";
  const timeout = 30 * 60 * 1000;
  const page = location.pathname.replace(/\.html$/, "");
  if (!/^\/[a-z0-9/-]*$/.test(page) || !crypto.randomUUID) return;
  let visit;
  try {
    visit = JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return;
  }
  const now = Date.now();
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(now);
  const entry = !visit || visit.day !== day || now - visit.updated >= timeout;
  if (entry) visit = { id: crypto.randomUUID(), day, page, shop: false, cart: [], elapsed: 0 };
  visit.shop ||= page === "/tienda";
  let visibleSince = document.visibilityState === "visible" ? now : null;

  function save(isEntry = false, send = true) {
    const timestamp = Date.now();
    if (visibleSince !== null) {
      visit.elapsed += timestamp - visibleSince;
      visibleSince = timestamp;
    }
    visit.updated = timestamp;
    try { sessionStorage.setItem(key, JSON.stringify(visit)); } catch {}
    if (!send) return;
    const { id, page, shop, cart, elapsed } = visit;
    fetch("/api/visit-notification", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, page, shop, cart, seconds: Math.floor(elapsed / 1000), entry: isEntry }),
      keepalive: true,
    }).catch(() => {});
  }
  document.addEventListener("68inspired:cart-add", event => {
    if (!visit.cart.includes(event.detail)) visit.cart.push(event.detail);
    save();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      save();
      visibleSince = null;
    } else {
      visibleSince = Date.now();
    }
  });
  setInterval(() => { if (visibleSince !== null) save(); }, 30000);
  save(entry, entry || visit.shop);
})();
