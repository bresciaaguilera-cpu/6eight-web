const { createHmac, timingSafeEqual } = require("node:crypto");

const { put } = require("@vercel/blob");
const { prefix, madridDate, sendVisitReport } = require("../lib/visit-report");
const { getProduct } = require("../lib/products");
const { getPersonalizedProduct } = require("../lib/personalized-orders");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secret = process.env.RESEND_API_KEY;
  const from = process.env.PERSONALIZED_EMAIL_FROM;
  async function send(key, subject, text, html) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ from, to: ["bresciaaguilera@gmail.com"], subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Visit notification rejected");
  }
  if (req.method === "GET") {
    const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ""}`);
    const supplied = Buffer.from(req.headers.authorization || "");
    if (!process.env.CRON_SECRET || supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)) return res.status(404).end();
    try {
      await sendVisitReport(send);
      return res.status(204).end();
    } catch {
      return res.status(502).end();
    }
  }
  if (req.method !== "POST") return res.status(405).end();
  const site = (process.env.SITE_URL || "https://68inspired.com").replace(/\/$/, "");
  if (!["https://68inspired.com", "https://www.68inspired.com", site].includes(req.headers.origin)) {
    return res.status(403).end();
  }
  if (process.env.VERCEL_ENV !== "production") return res.status(204).end();
  if (!secret || !from) return res.status(503).end();
  const page = req.body?.page;
  if (typeof page !== "string" || page.length > 120 || !/^\/[a-z0-9/-]*$/.test(page)) {
    return res.status(400).end();
  }
  if (/bot|crawler|spider|headless/i.test(req.headers["user-agent"] || "")) return res.status(204).end();
  const { id, seconds, shop, cart, entry } = req.body;
  if (!/^[a-f0-9-]{36}$/.test(typeof id === "string" ? id : "") ||
      !Number.isInteger(seconds) || seconds < 0 || seconds > 86400 ||
      typeof shop !== "boolean" || !Array.isArray(cart) || cart.length > 25 ||
      cart.some(product => typeof product !== "string" || product.length > 80)) {
    return res.status(400).end();
  }
  try {
    const day = madridDate.format(new Date());
    const names = [...new Set(cart.map(product =>
      getProduct(product)?.nombre || getPersonalizedProduct(product)?.nombre
    ).filter(Boolean))];
    await put(`${prefix}${day}/${id}.json`, JSON.stringify({ id, page, seconds, shop, cart: names }), {
      access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json",
    });
    const ip = String(req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (entry === true && ip) {
      const bucket = Math.floor(Date.now() / (30 * 60 * 1000));
      const key = createHmac("sha256", secret).update(ip + ":" + bucket).digest("hex");
      await send(`68-visit-${key}`, "Nueva visita a 68INSPIRED",
        "Se ha registrado una visita. Consulta las páginas de entrada y la actividad en el resumen diario.");
    }
    return res.status(204).end();
  } catch {
    return res.status(502).end();
  }
};
