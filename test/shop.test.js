const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

const pdfs = require("../lib/private-pdfs");
const calls = [];
let checkoutInput;
let currentSession;
let unavailable = new Set();
const Stripe = require("stripe");
require.cache[require.resolve("stripe")].exports = class TestStripe {
  constructor() {
    this.checkout = { sessions: {
      create: async input => {
        checkoutInput = input;
        return { url: "https://checkout.stripe.com/example" };
      },
      retrieve: async () => {
        if (!currentSession) throw Object.assign(new Error(), { code: "resource_missing" });
        return currentSession;
      },
    } };
  }
};
pdfs.findPdf = async (product, download) => {
  calls.push([product.pdfPathname, download]);
  if (unavailable.has(product.productId)) return null;
  return download ? { nombre: product.nombre, archivo: product.pdfPathname.split("/").at(-1), url: "https://example.test/file" } : true;
};

const checkout = require("../api/create-checkout-session");
const download = require("../api/get-download");
const { PRODUCTS } = require("../lib/products");

async function request(handler, req) {
  const result = { headers: {} };
  await handler(req, {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  });
  return result;
}

test("catalogue has the same twelve public items and prices", () => {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync("shop-catalog.js", "utf8"), ctx);
  const { ShopCatalog } = ctx.window;
  assert.equal(Object.values(ShopCatalog).filter(p => p.core).length, 12);
  for (const [id, item] of Object.entries(ShopCatalog)) {
    assert.equal(item.p, PRODUCTS[id].precioCentimos);
    assert.equal(item.n, PRODUCTS[id].nombre);
  }
  assert.equal(PRODUCTS["calendario-12-citas"].pdfPathname, "calendario-12-citas.pdf");
  assert.equal(new Set(Object.values(PRODUCTS).map(p => p.pdfPathname)).size, 14);
});

test("checkout checks all order files, keeps the welcome gift and rejects live keys", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_fixture";
  const order = { method: "POST", body: { productIds: ["calendario-12-citas"], welcomeGift: true } };
  assert.equal((await request(checkout, order)).status, 503);
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  unavailable = new Set(["calendario-12-citas"]);
  assert.equal((await request(checkout, order)).status, 409);
  assert.equal(checkoutInput, undefined);

  unavailable.clear();
  calls.length = 0;
  const result = await request(checkout, order);
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [["calendario-12-citas.pdf", undefined], ["products/12-mini-citas.pdf", undefined]]);
  assert.equal(checkoutInput.line_items[0].price_data.unit_amount, 1490);
  assert.equal(checkoutInput.metadata.deliverIds, "calendario-12-citas,12-mini-citas");
  assert.equal((await request(checkout, { method: "POST", body: { productIds: ["12-mini-citas"] } })).status, 400);
});

test("discounts and gifts use the pre-discount core subtotal", async () => {
  const productIds = ["calendario-52-citas", "calendario-12-citas", "kit-navidad-pareja", "kit-noche-cita-casa", "50-preguntas-picantes"];
  const result = await request(checkout, { method: "POST", body: { productIds } });
  assert.equal(result.status, 200);
  assert.equal(checkoutInput.line_items.reduce((sum, line) => sum + line.price_data.unit_amount, 0), 6460);
  assert.equal(checkoutInput.metadata.deliverIds.split(",").at(-1), "50-preguntas-picantes");
});

test("download rejects unpaid orders and lists paid legacy and partial orders", async () => {
  const req = { method: "GET", query: { session_id: "cs_test_fixture" } };
  assert.equal((await request(download, { method: "GET" })).status, 400);
  assert.equal((await request(download, req)).status, 404);
  calls.length = 0;
  currentSession = { mode: "payment", payment_status: "unpaid" };
  assert.equal((await request(download, req)).status, 402);
  assert.equal(calls.length, 0);
  currentSession = { mode: "payment", payment_status: "paid", metadata: { productId: "calendario-12-citas" } };
  const result = await request(download, req);
  assert.equal(result.status, 200);
  assert.equal(result.headers["Cache-Control"], "private, no-store");
  assert.equal(result.body.descargas[0].archivo, "calendario-12-citas.pdf");
  assert.equal(result.body.expiraEn, 600);

  currentSession.metadata = { deliverIds: "calendario-12-citas,12-mini-citas" };
  unavailable = new Set(["12-mini-citas"]);
  const partial = await request(download, req);
  assert.equal(partial.body.descargas.length, 1);
  assert.deepEqual(partial.body.pendientes, ["12 mini citas"]);
});

test("production requires a live key and keeps the same order validation", async () => {
  process.env.VERCEL_ENV = "production";
  const order = { method: "POST", body: { productIds: ["calendario-12-citas"] } };
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  assert.equal((await request(checkout, order)).status, 503);
  process.env.STRIPE_SECRET_KEY = "sk_live_fixture";
  unavailable.clear();
  assert.equal((await request(checkout, order)).status, 200);
  assert.equal(checkoutInput.line_items[0].price_data.unit_amount, 1490);
  delete process.env.VERCEL_ENV;
});

require.cache[require.resolve("stripe")].exports = Stripe;
