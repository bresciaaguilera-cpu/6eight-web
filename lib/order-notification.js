const recipient = "bresciaaguilera@gmail.com";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

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
  const html = `
    <div style="background:#f7efe2;padding:24px;font-family:Arial,sans-serif;color:#22362b">
      <div style="max-width:540px;margin:auto;background:#fff;border:1px solid #e2d4c2">
        <div style="background:#22362b;padding:20px;text-align:center">
          <img src="https://68inspired.com/favicon-68.png" width="80" height="80" alt="68INSPIRED" style="display:block;margin:auto;border-radius:40px">
        </div>
        <div style="padding:24px">
          <h1 style="font-size:24px;margin:0 0 12px">${test ? "Aviso de prueba" : "Nuevo pedido pagado"}</h1>
          ${test ? "<p>No se ha realizado ningún cobro.</p>" : ""}
          <p style="font-size:30px;margin:8px 0 16px"><strong>${escapeHtml(amount)}</strong></p>
          <p style="overflow-wrap:anywhere">Pedido <strong>${escapeHtml(session.id)}</strong></p>
          <h2 style="font-size:17px">PDF del pedido</h2>
          <ul style="padding-left:20px">${products.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>
          ${test ? "" : `<p><a href="${payment}" style="display:inline-block;background:#22362b;color:#fff;padding:12px 16px;text-decoration:none;border-radius:4px">Ver pago en Stripe</a></p>`}
        </div>
      </div>
    </div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `68-inspired-seller-${session.id}`,
    },
    body: JSON.stringify({ from: process.env.PERSONALIZED_EMAIL_FROM, to: [recipient], subject, text, html }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}

module.exports = { sendOrderNotification };
