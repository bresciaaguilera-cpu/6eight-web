const { get } = require("@vercel/blob");
const { generate, defaults } = require("../lib/personalizados");
const { personalConfig } = require("../lib/personalized-orders");

async function buildPdf(body, product) {
  const data = { product: product.product, a: body.a, b: body.b, date: body.date };
  if (product.product === "inspired") {
    data.dedication = body.dedication;
    const base = await get("products/inspired-by-68.pdf", { access: "private" });
    if (!base?.stream) throw new Error("El libro base no está disponible.");
    data.book = await new Response(base.stream).arrayBuffer();
  }
  if (product.product === "historia") {
    if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 12) {
      throw new Error("Añadid entre uno y doce recuerdos.");
    }
    data.events = body.events.map(event => ({
      title: event?.title, date: event?.date, note: event?.note, place: event?.place,
    }));
  }
  if (product.product === "calendario") {
    if (!Array.isArray(body.notes) || body.notes.length !== 12) throw new Error("Revisad las notas del calendario.");
    data.year = body.year;
    data.notes = body.notes;
  }
  if (product.product === "juego") {
    data.place = body.place;
    data.questions = defaults.questions;
    data.challenges = defaults.challenges;
  }
  return generate(data);
}

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ ready: personalConfig().ready });
  res.setHeader("Allow", "GET");
  return res.status(405).json({ error: "Añadid vuestro PDF a la cesta para continuar." });
};
module.exports.buildPdf = buildPdf;
