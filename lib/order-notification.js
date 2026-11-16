const recipient = "bresciaaguilera@gmail.com";

async function sendOrderNotification(session, products, { test = false } = {}) {
  const amount = new Intl.NumberFormat("es-ES", {
    style: "currency", currency: (session.currency || "eur").toUpperCase(),
  }).format(session.amount_total / 100);
  const payment = typeof session.payment_intent === "string" && /^pi_[a-zA-Z0-9]+$/.test(session.payment_intent)
    ? `https://dashboard.stripe.com/payments/${session.payment_intent}`
    : "https://dashboard.stripe.com/payments";
  const subject = test ? "PRUEBA · Aviso de pedido de 68INSPIRED" : `Nuevo pedido en 68INSPIRED · ${amount}`;
  const text = [
    test ? "Este es un aviso de prueba. No se ha realizado ningún cobro." : "Stripe ha confirmado el pago de un pedido.",
    `Pedido: ${session.id}`,
    `Importe ${test ? "de ejemplo" : "cobrado"}: ${amount}`,
    "PDF del pedido:",
    ...products.map(name => `- ${name}`),
    ...(test ? [] : [`Consultar en Stripe: ${payment}`]),
  ].join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `68-inspired-seller-${session.id}`,
    },
    body: JSON.stringify({ from: process.env.PERSONALIZED_EMAIL_FROM, to: [recipient], subject, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}

module.exports = { sendOrderNotification };
