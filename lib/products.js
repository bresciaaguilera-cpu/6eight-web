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

for (const [productId, nombre, precioCentimos, includes] of [
  ["pack-citas", "Pack Un año de citas", 2290, ["inspired-by-68", "calendario-12-citas"]],
  ["pack-navidad", "Pack Navidad en pareja", 1590, ["calendario-adviento-parejas", "kit-navidad-pareja"]],
  ["pack-preguntas", "Pack Preguntas para dos", 1290, ["juego-preguntas-parejas", "50-preguntas-profundas"]],
]) {
  PRODUCTS[productId] = { productId, nombre, precioCentimos, includes, kind: "pack" };
}

function getProduct(id) {
  return typeof id === "string" && Object.hasOwn(PRODUCTS, id) ? PRODUCTS[id] : null;
}

const christmasOffer = {
  pack: "pack-navidad",
  start: Date.parse("2026-11-15T00:00:00+01:00"),
  christmas: Date.parse("2026-12-01T00:00:00+01:00"),
  end: Date.parse("2026-12-26T00:00:00+01:00"),
  gifts: listings.filter(([, , price, , kind = "core"]) => kind === "core" && price <= 990)
    .map(([id]) => id).filter(id => !PRODUCTS["pack-navidad"].includes.includes(id)),
};

module.exports = { PRODUCTS, getProduct, christmasOffer };
