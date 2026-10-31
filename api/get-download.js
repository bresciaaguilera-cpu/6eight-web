// GET /api/get-download?session_id=...
//
// Nunca entrega un PDF solo porque alguien visite esta URL. Comprueba
// primero, directamente contra Stripe con la clave secreta, que esa
// Checkout Session existe y que payment_status === 'paid'. El producto
// a entregar se obtiene SIEMPRE del metadata.productId de esa sesión
// (nunca de un parámetro que mande el cliente), y se valida contra el
// catálogo del servidor. El PDF vive en un Vercel Blob store PRIVADO;
// aquí solo se genera una URL firmada de solo lectura que caduca a los
// pocos minutos.

const Stripe = require("stripe");
const { issueSignedToken, presignUrl } = require("@vercel/blob");
const { getProduct } = require("../lib/products");

const DOWNLOAD_TTL_MS = 10 * 60 * 1000; // 10 minutos
const TOKEN_TTL_MS = 15 * 60 * 1000; // algo más de margen que la URL firmada

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido." });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY no está configurada.");
    return res.status(500).json({ error: "El servicio no está disponible ahora mismo." });
  }

  const sessionId = req.query && req.query.session_id;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Falta el identificador del pedido." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // 1. La sesión tiene que existir de verdad en Stripe.
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    return res.status(404).json({ error: "No hemos encontrado ese pedido." });
  }

  // 2. Solo se entrega si el pago está confirmado.
  if (!session || session.payment_status !== "paid") {
    return res.status(402).json({
      error: "Este pedido todavía no tiene el pago confirmado.",
      payment_status: session ? session.payment_status : null,
    });
  }

  // 3. El producto SIEMPRE sale del metadata de la propia sesión pagada,
  //    nunca de algo que el cliente pueda indicar en la petición.
  const productId = session.metadata && session.metadata.productId;
  const product = getProduct(productId);
  if (!product) {
    console.error("Sesión pagada con productId desconocido:", productId);
    return res.status(400).json({ error: "No hemos podido identificar el producto de este pedido." });
  }

  try {
    const signedToken = await issueSignedToken({
      pathname: product.pdfPathname,
      operations: ["head", "get"],
      validUntil: Date.now() + TOKEN_TTL_MS,
    });

    // Comprobación controlada de que el PDF ya se ha subido al store
    // privado, antes de prometer una descarga que no existe todavía.
    const { presignedUrl: headUrl } = await presignUrl(signedToken, {
      operation: "head",
      pathname: product.pdfPathname,
      access: "private",
    });
    const headResponse = await fetch(headUrl, { method: "HEAD" });
    if (headResponse.status === 404) {
      return res.status(404).json({
        error: "El archivo de este producto todavía no está disponible.",
      });
    }
    if (!headResponse.ok) {
      console.error("Error comprobando el PDF en Blob:", headResponse.status);
      return res.status(502).json({ error: "No hemos podido preparar la descarga. Probad de nuevo en unos minutos." });
    }

    const { presignedUrl: downloadUrl } = await presignUrl(signedToken, {
      operation: "get",
      pathname: product.pdfPathname,
      access: "private",
      validUntil: Date.now() + DOWNLOAD_TTL_MS,
      useCache: false,
    });

    return res.status(200).json({
      nombre: product.nombre,
      url: downloadUrl,
      expiraEn: DOWNLOAD_TTL_MS / 1000,
    });
  } catch (err) {
    console.error("Error generando la URL de descarga:", err);
    return res.status(500).json({ error: "No hemos podido preparar la descarga. Probad de nuevo en unos minutos." });
  }
};
