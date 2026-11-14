const { randomBytes, timingSafeEqual } = require("node:crypto");

const products = {
  "inspired-by-68-personalizado": ["inspired", "Inspired by 68 personalizado", 2490],
  "nuestra-historia": ["historia", "Nuestra historia", 1990],
  "calendario-personalizado": ["calendario", "Calendario con fotos", 2290],
  "juego-personalizado": ["juego", "Juego personalizado", 100],
};
const retentionDays = 30;
const opaqueId = /^[a-f0-9]{48}$/;
const sessionId = /^cs_(test|live)_[a-zA-Z0-9]+$/;

function getPersonalizedProduct(id) {
  if (!Object.hasOwn(products, id)) return null;
  const [product, nombre, price] = products[id];
  return { productId: id, product, nombre, price };
}

function personalConfig() {
  const production = process.env.VERCEL_ENV === "production";
  const key = process.env.STRIPE_SECRET_KEY || "";
  const prefix = production ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/;
  return {
    production, key,
    ready: process.env.PERSONALIZED_ORDERS_ENABLED === "true" && prefix.test(key) && Boolean(process.env.STRIPE_PERSONALIZED_WEBHOOK_SECRET &&
      process.env.RESEND_API_KEY && process.env.PERSONALIZED_EMAIL_FROM && process.env.CRON_SECRET),
  };
}

function siteUrl() {
  return process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.SITE_URL || "https://68inspired.com").replace(/\/$/, "");
}

function newPersonalizedOrder(product) {
  return { ...product, orderId: randomBytes(24).toString("hex"), access: randomBytes(24).toString("hex") };
}

function fromStripe(session) {
  const metadata = session.metadata || {};
  const product = getPersonalizedProduct(metadata.personalizedProduct);
  if (!product || !opaqueId.test(metadata.personalizedOrder) || !opaqueId.test(metadata.personalizedAccess)) return null;
  return { ...product, orderId: metadata.personalizedOrder, access: metadata.personalizedAccess };
}

function hasAccess(order, token) {
  return typeof token === "string" && opaqueId.test(token) &&
    timingSafeEqual(Buffer.from(order.access, "hex"), Buffer.from(token, "hex"));
}

function pdfPath(order) {
  return `personalized-orders/${order.orderId}/${order.productId}.pdf`;
}

function emailMarkerPath(order) {
  return `personalized-orders/${order.orderId}/email-sent.txt`;
}

module.exports = {
  getPersonalizedProduct, personalConfig, siteUrl, newPersonalizedOrder,
  fromStripe, hasAccess, pdfPath, emailMarkerPath, retentionDays, sessionId,
};
