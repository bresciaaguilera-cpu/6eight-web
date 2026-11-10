const Stripe = require("stripe");
const { getProduct } = require("../lib/products");
const { findPdf, DOWNLOAD_TTL_MS } = require("../lib/private-pdfs");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const sessionId = req.query?.session_id;
  if (typeof sessionId !== "string" || !sessionId) {
    return res.status(400).json({ error: "Falta el identificador del pedido." });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "La descarga no está disponible en este momento." });
  }

  let session;
  try {
    session = await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(sessionId);
  } catch (err) {
    if (err.code === "resource_missing") {
      return res.status(404).json({ error: "No hemos encontrado ese pedido." });
    }
    return res.status(502).json({ error: "No hemos podido consultar el pedido en Stripe. Probad de nuevo en unos minutos." });
  }
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return res.status(402).json({ error: "Este pedido todavía no tiene el pago confirmado." });
  }

  const ids = session.metadata?.deliverIds?.split(",") ?? [session.metadata?.productId];
  const products = [...new Set(ids)].map(getProduct).filter(Boolean);
  if (!products.length) {
    return res.status(400).json({ error: "No hemos podido identificar los productos de este pedido." });
  }

  const results = await Promise.allSettled(products.map(product => findPdf(product, true)));
  const descargas = results.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
  const pendientes = products.filter((_, i) => results[i].status === "rejected" || !results[i].value)
    .map(product => product.nombre);
  return res.status(200).json({ descargas, pendientes, expiraEn: DOWNLOAD_TTL_MS / 1000 });
};
