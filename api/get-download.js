const Stripe = require("stripe");
const { getProduct } = require("../lib/products");
const { findPdf, DOWNLOAD_TTL_MS } = require("../lib/private-pdfs");
const { fromStripe, hasAccess, pdfPath, retentionDays } = require("../lib/personalized-orders");

function shopOrder(session) {
  const metadata = session.metadata || {};
  return metadata.personalizedOrder || metadata.deliverIds || metadata.productId;
}

async function firstOrder(stripe, session) {
  const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
  if (!email || !shopOrder(session)) return false;
  for await (const earlier of stripe.checkout.sessions.list({
    status: "complete", created: { lte: session.created }, limit: 100,
  })) {
    const earlierEmail = (earlier.customer_details?.email || earlier.customer_email || "").trim().toLowerCase();
    const precedes = earlier.created < session.created ||
      (earlier.created === session.created && earlier.id < session.id);
    if (precedes && earlier.mode === "payment" && earlier.payment_status === "paid" &&
        shopOrder(earlier) && earlierEmail === email) return false;
  }
  return true;
}

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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    if (err.code === "resource_missing") {
      return res.status(404).json({ error: "No hemos encontrado ese pedido." });
    }
    return res.status(502).json({ error: "No hemos podido consultar el pedido en Stripe. Probad de nuevo en unos minutos." });
  }
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return res.status(402).json({ error: "Este pedido todavía no tiene el pago confirmado." });
  }

  const metadata = session.metadata || {};
  const order = fromStripe(session);
  if (metadata.personalizedOrder && (!order || !hasAccess(order, req.query?.access))) {
    return res.status(404).json({ error: "El enlace del pedido personalizado no es válido." });
  }
  if (order && Date.now() >= (session.created + retentionDays * 86400) * 1000) {
    return res.status(410).json({ error: "El enlace del PDF personalizado ha caducado." });
  }

  const ids = metadata.deliverIds?.split(",") ?? [metadata.productId];
  const products = [...new Set(ids)].map(getProduct).filter(Boolean);
  if (order) products.push(...order.products.map(product => ({
    ...product, pdfPathname: pdfPath({ ...order, ...product }),
  })));
  if (!products.length) {
    return res.status(400).json({ error: "No hemos podido identificar los productos de este pedido." });
  }

  if ((metadata.welcomeEligible || order) && !ids.includes("12-mini-citas")) {
    try {
      if (await firstOrder(stripe, session)) products.push(getProduct("12-mini-citas"));
    } catch (err) {
      console.error("No se pudo comprobar el regalo de bienvenida", err.code || err.name);
    }
  }

  const results = await Promise.allSettled(products.map(product => findPdf(product, true)));
  const descargas = results.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
  const pendientes = products.filter((_, i) => results[i].status === "rejected" || !results[i].value)
    .map(product => product.nombre);
  return res.status(200).json({ descargas, pendientes, expiraEn: DOWNLOAD_TTL_MS / 1000, personalizado: Boolean(order), cesta: metadata.welcomeEligible === "1" });
};
