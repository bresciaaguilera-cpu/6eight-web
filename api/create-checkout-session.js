const Stripe = require("stripe");
const { put, del } = require("@vercel/blob");
const { buildPdf } = require("./personalized-checkout");
const { getPersonalizedProduct, personalConfig, newPersonalizedOrder, pdfPath, siteUrl } =
  require("../lib/personalized-orders");
const { getProduct, christmasOffer } = require("../lib/products");
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
  const inputs = body.personalizations ?? [];
  if (!Array.isArray(inputs) || inputs.length > 4 || inputs.some(input => input?.permission !== true)) {
    return res.status(400).json({ error: "Revisad las personalizaciones de la cesta." });
  }
  const custom = inputs.map(input => getPersonalizedProduct(input.productId));
  if (custom.some(product => !product) || new Set(custom.map(product => product.productId)).size !== custom.length) {
    return res.status(400).json({ error: "Revisad los productos personalizados de la cesta." });
  }
  if (custom.length && !personalConfig().ready) {
    return res.status(503).json({ error: "Los pedidos personalizados aún no están abiertos." });
  }
  const products = [...new Set(items)].map(getProduct);
  if (products.some(product => !product || product.kind === "gift")) {
    return res.status(400).json({ error: "Revisad los productos de la cesta." });
  }

  const core = products.filter(product => product.kind === "core" || product.kind === "pack");
  if (!core.length && !custom.length) {
    return res.status(400).json({ error: "Añadid un producto de la tienda antes de continuar." });
  }

  const subtotal = core.reduce((sum, product) => sum + product.precioCentimos, 0) +
    custom.reduce((sum, product) => sum + product.price, 0);
  const discount = subtotal >= 6800;
  const spicy = getProduct("50-preguntas-picantes");
  const buySpicy = subtotal < 5000 && products.includes(spicy);
  const paid = buySpicy ? [...core, spicy] : core;
  const deliver = paid.flatMap(product => product.includes ? product.includes.map(getProduct) : [product]);
  if (new Set(deliver).size !== deliver.length) {
    return res.status(400).json({ error: "La cesta repite un PDF incluido en un pack. Quitad el duplicado para continuar." });
  }
  if (subtotal >= 5000) deliver.push(spicy);

  if (body.christmasGift !== undefined) {
    const now = Date.now();
    const gift = getProduct(body.christmasGift);
    if (now < christmasOffer.start || now >= christmasOffer.end ||
        !items.includes(christmasOffer.pack) || !gift ||
        !christmasOffer.gifts.includes(gift.productId) || deliver.includes(gift)) {
      return res.status(400).json({ error: "Ese PDF de regalo no está disponible para esta cesta." });
    }
    deliver.push(gift);
  }

  const order = custom.length ? newPersonalizedOrder(custom[0]) : null;
  const stored = [];
  try {
    const ready = await Promise.all(deliver.map(product => findPdf(product)));
    const missing = deliver.filter((_, index) => !ready[index]);
    if (missing.length) {
      return res.status(409).json({
        error: `Aún no podemos entregar estos PDF: ${missing.map(product => product.nombre).join(", ")}. El pago no se ha iniciado.`,
      });
    }

    const site = siteUrl();
    for (const [index, product] of custom.entries()) {
      let pdf;
      try {
        pdf = await buildPdf(inputs[index], product);
      } catch (err) {
        if (stored.length) await del(stored.splice(0));
        return res.status(400).json({ error: err.message });
      }
      const pathname = pdfPath({ ...product, orderId: order.orderId });
      const blob = await put(pathname, Buffer.from(pdf), {
        access: "private", addRandomSuffix: false, allowOverwrite: false,
        contentType: "application/pdf", multipart: pdf.length > 8 * 1024 * 1024,
      });
      stored.push(blob.url);
    }
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [...paid, ...custom.map(product => ({
        ...product, precioCentimos: product.price, kind: "core",
      }))].map(product => ({
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: { name: product.nombre },
          unit_amount: discount && product.kind !== "bump"
            ? Math.round(product.precioCentimos * 0.9)
            : product.precioCentimos,
        },
      })),
      ...(order && { expires_at: Math.ceil(Date.now() / 1000) + 3600 }),
      metadata: {
        deliverIds: deliver.map(product => product.productId).join(","),
        welcomeEligible: "1",
        ...(order && { personalizedProducts: custom.map(product => product.productId).join(","),
          personalizedOrder: order.orderId, personalizedAccess: order.access }),
      },
      success_url: `${site}/success?session_id={CHECKOUT_SESSION_ID}${order ? `&access=${order.access}` : ""}`,
      cancel_url: `${site}/tienda`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    if (stored.length) await del(stored).catch(() => {});
    console.error("Error iniciando checkout", err.code || err.name);
    return res.status(502).json({ error: "No hemos podido comprobar la entrega o iniciar el pago. Probad en unos minutos." });
  }
};
