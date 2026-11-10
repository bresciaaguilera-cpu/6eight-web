// The checkout and download routes share this server-side catalogue.
const listings = [
  ["inspired-by-68", "Inspired by 68", 990],
  ["calendario-12-citas", "Calendario de 12 citas", 1490, "calendario-12-citas.pdf"],
  ["calendario-52-citas", "Calendario de 52 citas", 1990],
  ["calendario-adviento-parejas", "Calendario de Adviento para parejas", 1290],
  ["cuponera-experiencias", "Cuponera de experiencias", 1290],
  ["juego-preguntas-parejas", "Juego de 100 preguntas", 990],
  ["cuanto-me-conoces", "¿Cuánto me conoces?", 990],
  ["kit-noche-cita-casa", "Kit noche de cita en casa", 1490],
  ["bingo-pareja", "Bingo de pareja", 790],
  ["kit-san-valentin", "Kit San Valentín", 990],
  ["kit-navidad-pareja", "Kit Navidad en pareja", 1490],
  ["50-preguntas-profundas", "50 preguntas profundas", 690],
  ["12-mini-citas", "12 mini citas", 0, undefined, "gift"],
  ["50-preguntas-picantes", "50 preguntas picantes", 495, undefined, "bump"],
];

const PRODUCTS = Object.fromEntries(listings.map(
  ([productId, nombre, precioCentimos, pdfPathname = `products/${productId}.pdf`, kind = "core"]) =>
    [productId, { productId, nombre, precioCentimos, pdfPathname, kind }]
));

function getProduct(id) {
  return typeof id === "string" && Object.hasOwn(PRODUCTS, id) ? PRODUCTS[id] : null;
}

module.exports = { PRODUCTS, getProduct };
