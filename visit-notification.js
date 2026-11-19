(() => {
  if (document.visibilityState !== "visible") return;
  const key = "68inspired_visit_notice";
  const now = Date.now();
  try {
    if (now - Number(sessionStorage.getItem(key)) < 30 * 60 * 1000) return;
  } catch {}
  const page = location.pathname.replace(/\.html$/, "");
  if (!/^\/[a-z0-9/-]*$/.test(page) || page.startsWith("/success")) return;
  fetch("/api/visit-notification", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page }), keepalive: true,
  }).then(response => {
    if (response.ok) {
      try { sessionStorage.setItem(key, String(now)); } catch {}
    }
  }).catch(() => {});
})();
