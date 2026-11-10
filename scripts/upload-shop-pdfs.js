const { createReadStream, readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const path = require("node:path");
const { get, put } = require("@vercel/blob");
const { PRODUCTS } = require("../lib/products");

async function hash(stream) {
  const checksum = createHash("sha256");
  for await (const chunk of stream) checksum.update(chunk);
  return checksum.digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  const write = args[0] === "--upload";
  const directory = args[1];
  if (!directory || !["--upload", "--verify"].includes(args[0])) {
    throw new Error("Usage: node scripts/upload-shop-pdfs.js --upload|--verify DIRECTORY");
  }
  const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8"));
  const inputs = Object.values(PRODUCTS).map(product => {
    const pathname = product.pdfPathname;
    const item = manifest.find(entry => entry.productId === product.productId);
    if (!item || item.pathname !== pathname) throw new Error(`Ruta incorrecta en el manifiesto: ${pathname}`);
    return { pathname, item, filename: path.join(directory, pathname) };
  });

  for (const { pathname, item, filename } of inputs) {
    if (await hash(createReadStream(filename)) !== item.sha256) throw new Error(`Archivo local alterado: ${pathname}`);
  }

  let pending = 0;
  for (const { pathname, item, filename } of inputs) {
    let blob = await get(pathname, { access: "private", useCache: false });
    if (!blob && write) {
      await put(pathname, createReadStream(filename), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/pdf",
        multipart: item.bytes >= 8 * 1024 * 1024,
      });
      blob = await get(pathname, { access: "private", useCache: false });
    }
    if (blob?.statusCode === 200 && await hash(blob.stream) === item.sha256) {
      console.log(`OK ${pathname}`);
    } else {
      pending++;
      console.error(`PENDIENTE ${pathname} (${blob ? "el archivo existente es distinto" : "falta en Blob"})`);
    }
  }
  if (pending) process.exitCode = 1;
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
