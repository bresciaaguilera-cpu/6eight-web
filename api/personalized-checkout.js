const Stripe = require("stripe");
const { get, put } = require("@vercel/blob");
const { generate, defaults } = require("../lib/personalizados");
const { getPersonalizedProduct, personalConfig, siteUrl, newPersonalizedOrder, pdfPath } =
  require("../lib/personalized-orders");

const PHOTO_MAX = 210 * 1024;
const PHOTOS_MAX = 2600 * 1024;
const PRIVATE = { access: "private", addRandomSuffix: false, allowOverwrite: false };

function jpegDimensions(bytes) {
  if (bytes[0] !== 255 || bytes[1] !== 216) return false;
  for (let i = 2; i + 8 < bytes.length;) {
    if (bytes[i++] !== 255) return false;
    const marker = bytes[i++];
    const length = bytes.readUInt16BE(i);
    if (length < 2 || i + length > bytes.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
      const height = bytes.readUInt16BE(i + 3), width = bytes.readUInt16BE(i + 5);
      return width > 0 && height > 0 && width <= 1600 && height <= 1600;
    }
    if (marker === 0xda) return false;
    i += length;
  }
  return false;
}

function orderInput(body, product) {
  if (body.photosPermission !== true) throw new Error("Confirma que podéis usar las fotos y los datos del pedido.");
  let totalBytes = 0;
  const image = encoded => {
    if (!encoded) return null;
    if (typeof encoded !== "string" || encoded.length > Math.ceil(PHOTO_MAX / 3) * 4 ||
      !/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Una de las fotos supera el tamaño admitido.");
    const bytes = Buffer.from(encoded, "base64");
    totalBytes += bytes.length;
    if (bytes.length > PHOTO_MAX || totalBytes > PHOTOS_MAX || !jpegDimensions(bytes)) {
      throw new Error("No se pudo procesar una de las fotos. Vuelve a seleccionarla.");
    }
    return { kind: "jpg", bytes: Uint8Array.from(bytes) };
  };
  const data = { product: product.product, a: body.a, b: body.b, date: body.date, cover: image(body.cover) };
  if (product.product === "inspired") data.dedication = body.dedication;
  if (product.product === "historia") {
    if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 12) {
      throw new Error("Añadid entre uno y doce recuerdos.");
    }
    data.events = body.events.map(event => ({
      title: event?.title, date: event?.date, note: event?.note, image: image(event?.image),
    }));
  }
  if (product.product === "calendario") {
    if (!Array.isArray(body.images) || body.images.length !== 12) throw new Error("Añadid una foto por mes.");
    data.year = body.year;
    data.images = body.images.map(image);
  }
  if (product.product === "juego") {
    data.place = body.place;
    data.questions = defaults.questions;
    data.challenges = defaults.challenges;
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const config = personalConfig();
  if (req.method === "GET") return res.status(200).json({ ready: config.ready });
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!config.ready) return res.status(503).json({ error: "Los pedidos personalizados aún no están abiertos." });

  const body = req.body || {};
  if (typeof body.productId !== "string") return res.status(400).json({ error: "Selecciona un producto personalizado." });
  const product = getPersonalizedProduct(body.productId);
  if (!product) return res.status(400).json({ error: "Selecciona un producto personalizado." });
  let data;
  try {
    data = orderInput(body, product);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (data.product === "inspired") {
    try {
      const base = await get("products/inspired-by-68.pdf", { access: "private" });
      if (!base?.stream) throw new Error("Base missing");
      data.book = await new Response(base.stream).arrayBuffer();
    } catch (err) {
      console.error("No se pudo leer el libro original", err.code || err.name);
      return res.status(503).json({ error: "El libro personalizado no está disponible ahora mismo." });
    }
  }

  let pdf;
  try {
    pdf = await generate(data);
  } catch (err) {
    if (/^(Completa |Indica |Hay un |el .+ admite|Introduce |Selecciona |Añade |No se puede abrir)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error("No se pudo generar el PDF personalizado", err.code || err.name);
    return res.status(502).json({ error: "No hemos podido preparar vuestro PDF. El pago no se ha iniciado." });
  }

  const order = newPersonalizedOrder(product);
  try {
    await put(pdfPath(order), Buffer.from(pdf), { ...PRIVATE, contentType: "application/pdf",
      multipart: pdf.length > 8 * 1024 * 1024, cacheControlMaxAge: 60 });
    const site = siteUrl();
    const session = await new Stripe(config.key).checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      expires_at: Math.ceil(Date.now() / 1000) + 3600,
      line_items: [{ quantity: 1, price_data: { currency: "eur",
        unit_amount: product.price, product_data: { name: product.nombre } } }],
      metadata: {
        personalizedProduct: order.productId, personalizedOrder: order.orderId, personalizedAccess: order.access,
      },
      success_url: `${site}/success?session_id={CHECKOUT_SESSION_ID}&access=${order.access}`,
      cancel_url: `${site}/crea-el-vuestro?producto=${order.productId}&cancelado=1`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("No se pudo abrir el pago personalizado", err.code || err.name);
    return res.status(502).json({ error: "No hemos podido abrir el pago. Probad de nuevo en unos minutos." });
  }
};
