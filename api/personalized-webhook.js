const Stripe = require("stripe");
const { sendOrderNotification } = require("../lib/order-notification");
const { getProduct } = require("../lib/products");
const { del, get, put } = require("@vercel/blob");
const { fromStripe, pdfPath, emailMarkerPath, personalConfig, siteUrl, retentionDays, sessionId } =
  require("../lib/personalized-orders");

async function rawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error("Webhook body too large");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const config = personalConfig();
  const secret = process.env.STRIPE_PERSONALIZED_WEBHOOK_SECRET;
  if (!secret || !config.key) return res.status(503).json({ error: "Webhook sin configurar." });

  let event;
  try {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") throw new Error("Missing signature");
    const stripe = new Stripe(config.key);
    event = stripe.webhooks.constructEvent(await rawBody(req), signature, secret);
  } catch {
    return res.status(400).json({ error: "Firma de Stripe inválida." });
  }
  const session = event.data.object;
  const order = fromStripe(session);
  if (event.livemode !== config.production || !sessionId.test(session.id || "")) {
    return res.status(200).json({ received: true });
  }

  const metadata = session.metadata || {};
  const purchasedIds = metadata.deliverIds?.split(",") ?? [metadata.productId];
  const standardOrder = !metadata.personalizedOrder && purchasedIds.some(id => getProduct(id)?.pdfPathname);

  try {
    if (order && event.type === "checkout.session.expired" && session.payment_status === "unpaid") {
      await del(order.products.map(product => pdfPath({ ...order, ...product })));
    }
    if ((order || standardOrder) && event.type === "checkout.session.completed" && session.mode === "payment" &&
        session.payment_status === "paid") {
      const deliverCustomer = async () => {
        const markerPath = order ? emailMarkerPath(order) : `order-delivery/${session.id}/email-sent.txt`;
        const marker = await get(markerPath, { access: "private", useCache: false });
        if (marker) {
          await marker.stream?.cancel();
          return;
        }

        const email = session.customer_details?.email || session.customer_email;
        if (!email || !process.env.RESEND_API_KEY || !process.env.PERSONALIZED_EMAIL_FROM) {
          throw new Error("No delivery address or sender");
        }
        const query = new URLSearchParams({ session_id: session.id });
        if (order) query.set("access", order.access);
        const url = `${siteUrl()}/success?${query}`;
        const expiry = order ? ` El enlace estará disponible durante ${retentionDays} días.` : "";
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json", "Idempotency-Key": `68-inspired-${session.id}` },
          body: JSON.stringify({
            from: process.env.PERSONALIZED_EMAIL_FROM,
            to: [email],
            subject: "Vuestro pedido de 68 Inspired está listo",
            text: `Hola,\n\nYa podéis descargar todos los PDF de vuestro pedido:\n${url}\n\nGuardad el PDF en vuestro dispositivo.${expiry}\n\n68 Inspired`,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
        await put(markerPath, "sent", { access: "private", allowOverwrite: true,
          addRandomSuffix: false, contentType: "text/plain" });
      };
      const deliverSeller = async () => {
        const markerPath = `order-delivery/${session.id}/seller-sent.txt`;
        const marker = await get(markerPath, { access: "private", useCache: false });
        if (marker) {
          await marker.stream?.cancel();
          return;
        }
        const products = [...purchasedIds.map(id => getProduct(id)?.nombre), ...(
          order?.products.map(product => product.nombre) || []
        )].filter(Boolean);
        await sendOrderNotification(session, [...new Set(products)]);
        await put(markerPath, "sent", { access: "private", allowOverwrite: true,
          addRandomSuffix: false, contentType: "text/plain" });
      };
      const deliveries = await Promise.allSettled([deliverCustomer(), ...(event.livemode ? [deliverSeller()] : [])]);
      const failed = deliveries.find(result => result.status === "rejected");
      if (failed) throw failed.reason;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("No se pudo completar la notificación del pedido", err.code || err.name);
    return res.status(502).json({ error: "No se pudo procesar la notificación." });
  }
};
