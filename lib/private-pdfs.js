const { getDownloadUrl, issueSignedToken, presignUrl } = require("@vercel/blob");

const DOWNLOAD_TTL_MS = 10 * 60 * 1000;

async function findPdf(product, includeDownload = false) {
  const pathname = product.pdfPathname;
  const validUntil = Date.now() + DOWNLOAD_TTL_MS;
  const token = await issueSignedToken({
    pathname,
    validUntil,
    operations: includeDownload ? ["head", "get"] : ["head"],
  });
  const { presignedUrl } = await presignUrl(token, { pathname, operation: "head", access: "private" });
  const response = await fetch(presignedUrl, { method: "HEAD", signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Blob HEAD returned ${response.status}`);
  const type = response.headers.get("content-type")?.split(";")[0];
  if (type !== "application/pdf" || response.headers.get("content-length") === "0") return null;
  if (!includeDownload) return true;

  const { presignedUrl: download } = await presignUrl(token, {
    pathname,
    operation: "get",
    access: "private",
    validUntil,
    useCache: false,
  });
  return {
    productId: product.productId,
    nombre: product.nombre,
    archivo: pathname.split("/").at(-1),
    url: getDownloadUrl(download),
  };
}

module.exports = { findPdf, DOWNLOAD_TTL_MS };
