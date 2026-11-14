const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Readable } = require("node:stream");
const Stripe = require("stripe");
const { PDFDocument } = require("pdf-lib");
const Module = require("node:module");
const stripe = new Stripe("sk_test_fixture");
const settings = {
  PERSONALIZED_ORDERS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_PERSONALIZED_WEBHOOK_SECRET: "whsec_fixture", RESEND_API_KEY: "fixture",
  PERSONALIZED_EMAIL_FROM: "68 Inspired <pedidos@68inspired.com>", CRON_SECRET: "fixture",
  SITE_URL: "https://68inspired.com",
};

const blobs = new Map();
const sessions = new Map();
const emails = [];
let base;
const mockBlob = {
  async get(path) {
    const bytes = path === "products/inspired-by-68.pdf" ? base : blobs.get(path);
    if (!bytes) return null;
    return { stream: new Response(bytes).body };
  },
  async put(path, bytes, options) {
    assert.equal(options.access, "private");
    blobs.set(path, bytes);
    return {};
  },
  async del(path) {
    for (const item of [path].flat()) blobs.delete(item);
  },
};
class MockStripe {
  webhooks = stripe.webhooks;
  checkout = { sessions: {
    async create(payload) {
      const id = "cs_test_order" + (sessions.size + 1);
      assert.equal(payload.line_items[0].price_data.currency, "eur");
      const s = { ...payload, id, payment_status: "unpaid", url: "https://checkout.stripe.com/" + id,
        created: Math.round(Date.now() / 1000), customer_details: { email: "demo@example.com" } };
      sessions.set(id, s);
      return s;
    },
    async *list() { yield* sessions.values(); },
    async retrieve(id) { return sessions.get(id); },
  } };
}

const originalLoad = Module._load;
Module._load = function (name, parent, ...args) {
  if (name === "@vercel/blob") return mockBlob;
  if (name === "stripe") return MockStripe;
  if (name === "../lib/private-pdfs") return {
    DOWNLOAD_TTL_MS: 600,
    findPdf: async (p, include) => (!p.pdfPathname.startsWith("personalized-orders/") || (include && blobs.has(p.pdfPathname))) ? { nombre: p.nombre, url: "https://private.invalid/signed" } : null,
  };
  return originalLoad.call(this, name, parent, ...args);
};
const availability = require("../api/personalized-checkout");
const checkout = require("../api/create-checkout-session");
const webhook = require("../api/personalized-webhook");
const download = require("../api/get-download");
Module._load = originalLoad;

const request = async (fn, req) => {
  const response = {};
  await fn(req, { setHeader() {}, status(code) {
    response.code = code;
    return { json(data) { response.data = data; } };
  } });
  return response;
};

const notify = (session, type, valid = true) => {
  const payload = JSON.stringify({ livemode: false, type, data: { object: session } });
  const req = Readable.from([Buffer.from(payload)]);
  req.method = "POST";
  req.headers = { "stripe-signature": valid
    ? stripe.webhooks.generateTestHeaderString({ payload, secret: settings.STRIPE_PERSONALIZED_WEBHOOK_SECRET })
    : "invalid" };
  return request(webhook, req);
};

test("prepares all four PDFs, keeps downloads private until payment and sends a single email", async t => {
  const saved = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  const savedMode = process.env.VERCEL_ENV;
  delete process.env.VERCEL_ENV;
  Object.assign(process.env, settings);
  const originalFetch = global.fetch;
  t.after(() => {
    for (const [key, value] of Object.entries({ ...saved, VERCEL_ENV: savedMode })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = originalFetch;
  });
  global.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    emails.push({ key: init.headers["Idempotency-Key"], data: JSON.parse(init.body) });
    return { ok: true };
  };
  const book = await PDFDocument.create();
  for (let i = 0; i < 87; i++) book.addPage();
  base = await book.save();
  const input = { a: "Lucía", b: "Mateo", date: "2020-02-29", permission: true };
  const make = body => request(checkout, { method: "POST", body: { productIds: [], personalizations: [{ ...input, ...body }] } });
  process.env.PERSONALIZED_ORDERS_ENABLED = "false";
  assert.equal((await request(availability, { method: "GET" })).data.ready, false);
  assert.equal((await make({ productId: "juego-personalizado" })).code, 503);
  process.env.PERSONALIZED_ORDERS_ENABLED = "true";
  assert.equal((await make({ productId: "juego-personalizado", permission: false })).code, 400);

  const cases = [
    ["inspired-by-68-personalizado", 1990, 88, { dedication: "Para los dos" }],
    ["nuestra-historia", 1990, 3, { events: [{ title: "El viaje", date: "2020-05-05", note: "El recuerdo", place: "Málaga" }] }],
    ["calendario-personalizado", 1790, 13, { year: 2028, notes: Array(12).fill("Un paseo juntos") }],
    ["juego-personalizado", 100, 8, { place: "Málaga" }],
  ];
  for (const [productId, price, pages, fields] of cases) {
    const result = await make({ productId, price: 1, ...fields });
    assert.equal(result.code, 200, JSON.stringify(result.data));
    const session = sessions.get(result.data.url.split("/").at(-1));
    assert.equal(session.line_items[0].price_data.unit_amount, price);
    assert.deepEqual(Object.keys(session.metadata).sort(), ["deliverIds", "personalizedAccess", "personalizedOrder", "personalizedProducts", "welcomeEligible"]);
    const pdf = "personalized-orders/" + session.metadata.personalizedOrder + "/" + productId + ".pdf";
    assert.equal((await PDFDocument.load(blobs.get(pdf))).getPageCount(), pages);
    const access = session.metadata.personalizedAccess;
    const open = (token) => request(download, { method: "GET", query: { session_id: session.id, access: token } });
    assert.equal((await open(access)).code, 402);
    assert.equal((await notify(session, "checkout.session.completed", false)).code, 400);
    assert.equal((await notify(session, "checkout.session.completed")).code, 200);
    assert.equal(emails.some(e => e.key.endsWith(session.id)), false);
    session.payment_status = "paid";
    assert.equal((await open()).code, 404);
    assert.equal((await open(access)).data.personalizado, true);
    assert.equal((await notify(session, "checkout.session.completed")).code, 200);
    assert.equal((await notify(session, "checkout.session.completed")).code, 200);
    assert.equal(emails.filter(e => e.key.endsWith(session.id)).length, 1);
    assert.match(emails.at(-1).data.text, new RegExp(access));
    session.created -= 31 * 86400;
    assert.equal((await open(access)).code, 410);
  }
  const mixed = await request(checkout, { method: "POST", body: {
    productIds: ["calendario-12-citas"], personalizations: [
      { ...input, productId: "juego-personalizado", place: "Málaga" },
      { ...input, productId: "calendario-personalizado", year: 2028, notes: Array(12).fill("") },
    ],
  } });
  assert.equal(mixed.code, 200, JSON.stringify(mixed.data));
  const combined = sessions.get(mixed.data.url.split("/").at(-1));
  assert.equal(combined.line_items.length, 3);
  combined.payment_status = "paid";
  combined.customer_details.email = "first@example.com";
  const downloads = await request(download, { method: "GET", query: {
    session_id: combined.id, access: combined.metadata.personalizedAccess,
  } });
  assert.equal(downloads.data.descargas.length, 4);
  assert.equal(downloads.data.descargas.at(-1).nombre, "12 mini citas");
  const unpaid = await make({ productId: "juego-personalizado", place: "Málaga" });
  const session = sessions.get(unpaid.data.url.split("/").at(-1));
  const key = "personalized-orders/" + session.metadata.personalizedOrder + "/juego-personalizado.pdf";
  assert.equal((await notify(session, "checkout.session.expired")).code, 200);
  assert.equal(blobs.has(key), false);
  assert.equal(emails.length, 4);
});
