// POST /api/create-checkout-session
//
// Recibe { productId } del navegador y nada más: el precio, el nombre y
// la ruta del PDF se obtienen SIEMPRE del catálogo del servidor
// (lib/products.js), nunca de lo que mande el cliente.
//
// Devuelve únicamente { url } con el enlace a Stripe Checkout. La clave
// secreta de Stripe no sale nunca de este archivo.

const Stripe = require("stripe");
const { getProduct } = require("../lib/products");

const SITE_URL = process.env.SITE_URL || "https://6eight-web.vercel.app";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY no está configurada.");
    return res.status(500).json({ error: "El servicio de pago no está disponible ahora mismo." });
  }

  const body = req.body || {};
  const productId = body.productId;

  const product = getProduct(productId);
  if (!product) {
    return res.status(400).json({ error: "Producto no reconocido." });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: product.moneda,
            product_data: { name: product.nombre },
            unit_amount: product.precioCentimos,
          },
          quantity: 1,
        },
      ],
      metadata: { productId: product.productId },
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/${product.productId}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Error creando la sesión de Stripe Checkout:", err);
    return res.status(500).json({ error: "No hemos podido iniciar el pago. Probad de nuevo en un momento." });
  }
};
