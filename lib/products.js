// The checkout and download routes share this server-side catalogue.
const listings = [
  ["inspired-by-68", "Inspired by 68", 1790],
  ["calendario-12-citas", "Calendario de 12 citas", 890, "edicion-adviento-v2/calendario-12-citas.pdf"],
  ["calendario-52-citas", "Calendario de 52 citas", 990],
  ["calendario-adviento-parejas", "Calendario de Adviento para parejas", 990],
  ["cuponera-experiencias", "Cuponera de experiencias", 790],
  ["juego-preguntas-parejas", "Juego de 100 preguntas", 890],
  ["cuanto-me-conoces", "¿Cuánto me conoces?", 790],
  ["kit-noche-cita-casa", "Kit noche de cita en casa", 990],
  ["bingo-pareja", "Bingo de pareja", 790],
  ["kit-san-valentin", "Kit San Valentín", 990],
  ["kit-navidad-pareja", "Kit Navidad en pareja", 990],
  ["50-preguntas-profundas", "50 preguntas profundas", 790],
  ["12-mini-citas", "12 mini citas", 0, undefined, "gift"],
  ["50-preguntas-picantes", "50 preguntas picantes", 390, undefined, "bump"],
];

const PRODUCTS = Object.fromEntries(listings.map(
  ([productId, nombre, precioCentimos, pdfPathname = `edicion-adviento-v2/${productId}.pdf`, kind = "core"]) =>
    [productId, { productId, nombre, precioCentimos, pdfPathname, kind }]
));

function getProduct(id) {
  return typeof id === "string" && Object.hasOwn(PRODUCTS, id) ? PRODUCTS[id] : null;
}

module.exports = { PRODUCTS, getProduct };
