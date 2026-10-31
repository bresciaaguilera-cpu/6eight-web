// Catálogo central de productos — SOLO lado servidor.
//
// El navegador nunca debe decidir precio, nombre ni ruta del PDF: solo
// manda un `productId` y todo lo demás se resuelve aquí, en el servidor.
// Los precios están en céntimos de euro y deben coincidir exactamente con
// los que se muestran en /tienda.
//
// Los productos personalizados (crea-el-vuestro) NO están en este
// catálogo todavía: usan un flujo distinto y no se conectan a este sistema
// automático por ahora.

const PRODUCTS = {
  "inspired-by-68": {
    productId: "inspired-by-68",
    nombre: "Inspired by 68",
    precioCentimos: 990,
    moneda: "eur",
    pdfPathname: "products/inspired-by-68.pdf",
  },
  "calendario-12-citas": {
    productId: "calendario-12-citas",
    nombre: "Calendario de 12 citas",
    precioCentimos: 1490,
    moneda: "eur",
    pdfPathname: "products/calendario-12-citas.pdf",
  },
  "calendario-52-citas": {
    productId: "calendario-52-citas",
    nombre: "Calendario de 52 citas",
    precioCentimos: 1990,
    moneda: "eur",
    pdfPathname: "products/calendario-52-citas.pdf",
  },
  "cuponera-experiencias": {
    productId: "cuponera-experiencias",
    nombre: "Cuponera de experiencias",
    precioCentimos: 1290,
    moneda: "eur",
    pdfPathname: "products/cuponera-experiencias.pdf",
  },
  "juego-preguntas-parejas": {
    productId: "juego-preguntas-parejas",
    nombre: "Juego de preguntas para parejas",
    precioCentimos: 990,
    moneda: "eur",
    pdfPathname: "products/juego-preguntas-parejas.pdf",
  },
  "cuanto-me-conoces": {
    productId: "cuanto-me-conoces",
    nombre: "¿Cuánto me conoces?",
    precioCentimos: 990,
    moneda: "eur",
    pdfPathname: "products/cuanto-me-conoces.pdf",
  },
  "kit-noche-cita-casa": {
    productId: "kit-noche-cita-casa",
    nombre: "Kit noche de cita en casa",
    precioCentimos: 1490,
    moneda: "eur",
    pdfPathname: "products/kit-noche-cita-casa.pdf",
  },
  "bingo-pareja": {
    productId: "bingo-pareja",
    nombre: "Bingo de pareja",
    precioCentimos: 790,
    moneda: "eur",
    pdfPathname: "products/bingo-pareja.pdf",
  },
  "kit-navidad-pareja": {
    productId: "kit-navidad-pareja",
    nombre: "Kit Navidad en pareja",
    precioCentimos: 1490,
    moneda: "eur",
    pdfPathname: "products/kit-navidad-pareja.pdf",
  },
  "50-preguntas-profundas": {
    productId: "50-preguntas-profundas",
    nombre: "50 preguntas profundas",
    precioCentimos: 690,
    moneda: "eur",
    pdfPathname: "products/50-preguntas-profundas.pdf",
  },
};

/**
 * Devuelve el producto del catálogo, o null si no existe.
 * Nunca confiar en nada que no sea este objeto para precio/ruta del PDF.
 */
function getProduct(productId) {
  if (typeof productId !== "string") return null;
  return PRODUCTS[productId] || null;
}

module.exports = { PRODUCTS, getProduct };
