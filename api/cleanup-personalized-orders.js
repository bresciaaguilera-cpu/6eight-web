const { timingSafeEqual } = require("node:crypto");
const { del, list } = require("@vercel/blob");
const { retentionDays } = require("../lib/personalized-orders");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ""}`);
  const supplied = Buffer.from(String(req.headers.authorization || ""));
  if (req.method !== "GET" || !process.env.CRON_SECRET || supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)) return res.status(404).end();
  const cutoff = Date.now() - retentionDays * 86400 * 1000;
  let cursor;
  let removed = 0;
  do {
    const batch = await list({ prefix: "personalized-orders/", limit: 250, cursor });
    const expired = batch.blobs.filter(blob => +new Date(blob.uploadedAt) < cutoff);
    if (expired.length) {
      await del(expired.map(blob => blob.url));
      removed += expired.length;
    }
    cursor = batch.hasMore ? batch.cursor : undefined;
  } while (cursor);
  return res.status(200).json({ removed });
};
