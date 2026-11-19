const { del, get, list } = require("@vercel/blob");

const prefix = "visit-activity/";
const madridDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", dateStyle: "short" });

function duration(seconds) {
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function visitDetails(visit) {
  return [
    `Visita anónima ${visit.id.slice(0, 8)}`,
    `Página de entrada ${visit.page}`,
    `Abrió la tienda: ${visit.shop ? "sí" : "no"}`,
    `Añadió a la cesta: ${visit.cart.length ? visit.cart.join(", ") : "nada"}`,
    `Tiempo con la página visible: ${duration(visit.seconds)}`,
  ];
}

function reportText(day, visits) {
  const average = Math.round(visits.reduce((total, visit) => total + visit.seconds, 0) / visits.length);
  const lines = visits.map(visit => visitDetails(visit).join(" · "));
  return [
    `Actividad del ${day}`,
    `Visitas registradas ${visits.length}`,
    `Abrieron la tienda ${visits.filter(visit => visit.shop).length}`,
    `Añadieron a la cesta ${visits.filter(visit => visit.cart.length).length}`,
    `Tiempo medio con la página visible ${duration(average)}`,
    "", ...lines,
  ].join("\n");
}

async function sendVisitReport(send) {
  const today = madridDate.format(new Date());
  const groups = new Map();
  let cursor;
  do {
    const batch = await list({ prefix, cursor, limit: 250 });
    for (const blob of batch.blobs) {
      const day = blob.pathname.split("/")[1];
      if (day >= today) continue;
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(blob.pathname);
    }
    cursor = batch.hasMore ? batch.cursor : undefined;
  } while (cursor);

  for (const [day, paths] of groups) {
    const visits = [];
    for (let offset = 0; offset < paths.length; offset += 20) {
      const batch = await Promise.all(paths.slice(offset, offset + 20).map(async pathname => {
        const result = await get(pathname, { access: "private", useCache: false });
        return result?.stream ? new Response(result.stream).json() : null;
      }));
      visits.push(...batch.filter(Boolean));
    }
    if (!visits.length) continue;
    visits.sort((a, b) => a.id.localeCompare(b.id));
    await send(`68-visit-report-${day}`, `Actividad de 68INSPIRED · ${day}`, reportText(day, visits));
    await del(paths);
  }
}

module.exports = { prefix, madridDate, sendVisitReport, visitDetails };
