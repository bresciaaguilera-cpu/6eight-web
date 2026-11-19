const { createHmac } = require("node:crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  const site = (process.env.SITE_URL || "https://68inspired.com").replace(/\/$/, "");
  if (!["https://68inspired.com", "https://www.68inspired.com", site].includes(req.headers.origin)) {
    return res.status(403).end();
  }
  if (process.env.VERCEL_ENV !== "production") return res.status(204).end();
  const secret = process.env.RESEND_API_KEY;
  const from = process.env.PERSONALIZED_EMAIL_FROM;
  if (!secret || !from) return res.status(503).end();
  const page = req.body?.page;
  if (typeof page !== "string" || page.length > 120 || !/^\/[a-z0-9/-]*$/.test(page)) {
    return res.status(400).end();
  }
  if (/bot|crawler|spider|headless/i.test(req.headers["user-agent"] || "")) return res.status(204).end();
  // Vercel sets this header at the proxy. Use it only to prevent repeated emails.
  const ip = String(req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (!ip) return res.status(204).end();
  const bucket = Math.floor(Date.now() / (30 * 60 * 1000));
  const key = createHmac("sha256", secret).update(ip + ":" + bucket).digest("hex");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `68-visit-${key}`,
      },
      // Keep the body identical across retries sharing an idempotency key.
      body: JSON.stringify({
        from, to: ["bresciaaguilera@gmail.com"],
        subject: "Nueva visita a 68INSPIRED",
        text: "Se ha detectado una visita a 68inspired.com. Los avisos se agrupan por conexión en intervalos de 30 minutos. No identifican a la persona visitante.",
        html: '<div style="background:#f7efe2;padding:24px;font-family:Arial;color:#22362b"><div style="max-width:520px;margin:auto;background:white;padding:24px"><img src="https://68inspired.com/images/logo-aviso-68.png" alt="68INSPIRED" width="80" height="80"><h1 style="font-size:24px">Nueva visita a vuestra web</h1><p>Alguien ha abierto una página de <a href="https://68inspired.com">68inspired.com</a>.</p><p>Los avisos se agrupan por conexión en intervalos de 30 minutos. No identifican a la persona visitante.</p></div></div>',
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Visit notification rejected");
    return res.status(204).end();
  } catch {
    return res.status(502).end();
  }
};
