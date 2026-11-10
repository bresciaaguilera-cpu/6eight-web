const Stripe = require("stripe");
const { getProduct } = require("../lib/products");
const { findPdf } = require("../lib/private-pdfs");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const key = process.env.STRIPE_SECRET_KEY || "";
  const production = process.env.VERCEL_ENV === "production";
  const validKey = production ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/;
  if (!validKey.test(key)) {
    return res.status(503).json({ error: "El pago no está disponible en este momento." });
  }

  const body = req.body || {};
  const items = Array.isArray(body.productIds) ? body.productIds : [body.productId];
  const products = [...new Set(items)].map(getProduct);
  if (!products.length || products.some(product => !product || product.kind === "gift")) {
    return res.status(400).json({ error: "Revisad los productos de la cesta." });
  }

  const core = products.filter(product => product.kind === "core");
  if (!core.length) {
    return res.status(400).json({ error: "Añadid un producto de la tienda antes de continuar." });
  }

  const subtotal = core.reduce((sum, product) => sum + product.precioCentimos, 0);
  const discount = subtotal >= 6800;
  const spicy = getProduct("50-preguntas-picantes");
  const buySpicy = subtotal < 5000 && products.includes(spicy);
  const paid = buySpicy ? [...core, spicy] : core;
  const deliver = [...paid];
  if (body.welcomeGift === true) deliver.push(getProduct("12-mini-citas"));
  if (subtotal >= 5000) deliver.push(spicy);

  try {
    const ready = await Promise.all(deliver.map(product => findPdf(product)));
    const missing = deliver.filter((_, index) => !ready[index]);
    if (missing.length) {
      return res.status(409).json({
        error: `Aún no podemos entregar estos PDF: ${missing.map(product => product.nombre).join(", ")}. El pago no se ha iniciado.`,
      });
    }

    const site = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.SITE_URL || "https://68inspired.com").replace(/\/$/, "");
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: paid.map(product => ({
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: { name: product.nombre },
          unit_amount: discount && product.kind === "core"
            ? Math.round(product.precioCentimos * 0.9)
            : product.precioCentimos,
        },
      })),
      metadata: { deliverIds: deliver.map(product => product.productId).join(",") },
      success_url: `${site}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/tienda`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Error iniciando checkout", err.code || err.name);
    return res.status(502).json({ error: "No hemos podido comprobar la entrega o iniciar el pago. Probad en unos minutos." });
  }
};
