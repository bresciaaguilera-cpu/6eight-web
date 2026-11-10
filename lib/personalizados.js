(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("pdf-lib"));
  } else {
    root.Personalizados68 = factory(root.PDFLib);
  }
})(globalThis, function (pdf) {
  "use strict";
  const { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = pdf;

  const W = 595.28, H = 841.89;
  const colors = {
    forest: [0.13, 0.21, 0.17], ink: [0.17, 0.19, 0.17], ivory: [0.98, 0.96, 0.92],
    paper: [1, 0.995, 0.98], rose: [0.54, 0.29, 0.24], muted: [0.33, 0.35, 0.30],
    sand: [0.91, 0.86, 0.78], pale: [0.94, 0.92, 0.86], white: [1, 1, 1],
  };
  const titles = {
    inspired: "Inspired by 68", historia: "Nuestra historia",
    calendario: "Calendario con fotos", juego: "Juego personalizado",
  };
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const weekdays = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
  const esDate = new Intl.DateTimeFormat("es-ES", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const defaults = {
    questions: [
      "¿Qué fue lo primero que pensó {a} al conocer a {b}?",
      "¿Qué recordaríais de {lugar} si solo pudierais guardar un detalle?",
      "¿Qué pequeño gesto de {a} hace que {b} se sienta en casa?",
      "¿Qué os diríais si pudierais volver al {fecha} durante cinco minutos?",
      "¿Qué plan pequeño os gustaría repetir este mes?",
      "¿Qué historia vuestra contaría mejor {b}, y qué detalle añadiría {a}?",
      "¿Qué canción sonaría en la primera escena de una película sobre vosotros?",
      "¿Qué costumbre vuestra os hace sonreír aunque parezca una tontería?",
      "¿En qué momento sentisteis que ya hacíais equipo?",
      "¿Qué conversación os gustaría retomar con más calma?",
      "¿Qué lugar nuevo os gustaría que se volviera tan vuestro como {lugar}?",
      "¿Qué queréis que {a} y {b} recuerden de este año dentro de cinco años?",
    ],
    challenges: [
      "Elegid dos objetos de casa que cuenten cómo empezó lo vuestro. Explicadlos como si fueran piezas de museo.",
      "{a} dibuja un plano de {lugar} de memoria. {b} añade un detalle que no estaba en el dibujo.",
      "Recread una foto de vuestra primera época. Si no la tenéis, inventad la que os habría gustado hacer.",
      "Escribid cada uno una frase para abrir el próximo {fecha} que os apetezca celebrar.",
      "En tres minutos, cread una playlist de tres canciones para una escapada improvisada.",
      "Preparad un brindis de una frase. {a} empieza con «gracias» y {b} lo termina con «quiero repetir».",
      "Elegid un plan de menos de una hora y ponedle una fecha antes de terminar la partida.",
      "Uno tararea un estribillo. Si el otro lo adivina, elige la música del resto de la noche.",
      "Cada persona escribe un gesto que agradeció esta semana. Intercambiad los papeles y guardadlos.",
      "Inventad un menú de tres platos con nombres de anécdotas que solo vosotros entendáis.",
      "Haced una foto sin posar de lo que está pasando ahora. Escribid juntos una frase para guardarla.",
      "{a} propone una sorpresa pequeña para {b}. {b} propone otra. Elegid una para este fin de semana.",
    ],
  };
  const col = key => rgb(...colors[key]);
  const fill = (p, x, y, width, height, c) => p.drawRectangle({ x, y, width, height, color: col(c) });
  const line = (p, x, y, endX, endY, color = "sand") => p.drawLine({
    start: { x, y }, end: { x: endX, y: endY }, thickness: 0.65, color: col(color),
  });
  const text = (p, f, v, x, y, size, c = "ink") => {
    if (v) p.drawText(v, { x, y, size, font: f, color: col(c) });
  };
  const spaced = (p, f, v, x, y, c = "rose") => text(p, f, v, x, y, 10, c);

  function wrap(font, value, size, width) {
    const lines = [];
    for (const paragraph of value.split("\n")) {
      let current = "";
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        const candidate = current ? current + " " + word : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          current = candidate;
          continue;
        }
        if (current) lines.push(current);
        current = "";
        for (const character of word) {
          if (current && font.widthOfTextAtSize(current + character, size) > width) {
            lines.push(current);
            current = "";
          }
          current += character;
        }
      }
      lines.push(current);
    }
    return lines;
  }

  function block(p, font, value, x, y, width, idealSize, maxHeight, color = "ink") {
    for (let size = idealSize; size >= 9; size -= 1) {
      const lines = wrap(font, value, size, width);
      const leading = size * 1.27;
      if (lines.length * leading <= maxHeight) {
        lines.forEach((part, i) => text(p, font, part, x, y - i * leading, size, color));
        return;
      }
    }
    throw new Error("Hay un texto demasiado largo para su página. Acórtalo y vuelve a generar.");
  }

  function label(value, max, name, required = true) {
    const result = String(value ?? "").trim().normalize("NFC").replace(/\t/g, " ").replace(/\r\n?/g, "\n");
    if (required && !result) throw new Error("Completa " + name + ".");
    if (result.length > max) throw new Error(name + " admite hasta " + max + " caracteres.");
    return result;
  }

  function date(value, name) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) throw new Error("Indica una fecha válida para " + name + ".");
    const d = new Date(value + "T00:00:00Z");
    if (Number.isNaN(+d) || d.toISOString().slice(0, 10) !== value) throw new Error("Indica una fecha válida para " + name + ".");
    return d;
  }

  async function photo(doc, page, asset, x, y, w, h) {
    if (!asset) return;
    let image;
    try {
      image = asset.kind === "png" ? await doc.embedPng(asset.bytes) : await doc.embedJpg(asset.bytes);
    } catch {
      throw new Error("No se puede abrir una imagen. Prueba con otra foto JPG o PNG.");
    }
    const ratio = Math.max(w / image.width, h / image.height);
    const width = image.width * ratio, height = image.height * ratio;
    page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
    page.drawImage(image, { x: x + (w - width) / 2, y: y + (h - height) / 2, width, height });
    page.pushOperators(popGraphicsState());
  }

  function base(doc, fonts, footer, number) {
    const p = doc.addPage([W, H]);
    fill(p, 0, 0, W, H, "paper");
    line(p, 48, 789, W - 48, 789);
    spaced(p, fonts.bold, "68 INSPIRED", 48, 804, "forest");
    line(p, 48, 52, W - 48, 52);
    block(p, fonts.regular, footer, 48, 32, 465, 9, 23, "muted");
    text(p, fonts.bold, String(number).padStart(2, "0"), W - 65, 32, 9, "forest");
    return p;
  }

  async function cover(doc, f, data, edition, subtitle, asset, monogram) {
    const p = doc.addPage([W, H]);
    fill(p, 0, 0, W, H, "ivory");
    fill(p, 0, 406, W, H - 406, "forest");
    line(p, 52, 756, W - 52, 756, "sand");
    spaced(p, f.bold, "68 INSPIRED", 52, 774, "ivory");
    text(p, f.bold, edition, 52, 712, 10, "sand");
    block(p, f.serif, titles[data.product], 50, 657, 495, 52, 150, "white");
    block(p, f.regular, subtitle, 52, 497, 485, 16, 67, "ivory");
    fill(p, 52, 181, 491, 260, "pale");
    if (asset) {
      await photo(doc, p, asset, 52, 181, 491, 260);
    } else {
      p.drawCircle({ x: W / 2, y: 309, size: 78, borderColor: col("rose"), borderWidth: 1 });
      const width = f.serif.widthOfTextAtSize(monogram, 47);
      text(p, f.serif, monogram, (W - width) / 2, 291, 47, "forest");
    }
    block(p, f.serif, data.names, 52, 133, 490, 25, 52, "forest");
    if (data.date) text(p, f.regular, esDate.format(data.date), 53, 69, 11, "rose");
    if (data.sample) text(p, f.bold, "MUESTRA FICTICIA", 408, 69, 10, "rose");
  }

  async function inspired(doc, f, data) {
    if (!data.book) throw new Error("Selecciona el archivo Libro-base-Inspired-by-68.pdf incluido en la carpeta.");
    const original = await PDFDocument.load(data.book);
    if (original.getPageCount() !== 87) throw new Error("El libro base de la carpeta debe tener 87 páginas.");
    await cover(doc, f, data, "EDICIÓN PERSONALIZADA", "Aventuras inolvidables para dos", data.cover, "68");
    const p = base(doc, f, "Edición personalizada", 2);
    spaced(p, f.bold, "DEDICATORIA", 48, 727);
    block(p, f.serif, data.names, 48, 672, 496, 37, 110, "forest");
    line(p, 48, 556, 143, 556, "rose");
    block(p, f.serif, label(data.dedication, 650, "la dedicatoria"), 48, 515, 489, 21, 300);
    if (data.date) text(p, f.regular, esDate.format(data.date), 48, 106, 12, "muted");
    const pages = await doc.copyPages(original, original.getPageIndices().slice(1));
    pages.forEach(originalPage => doc.addPage(originalPage));
  }

  async function story(doc, f, data) {
    const events = data.events.map(event => ({
      title: label(event.title, 75, "el título del recuerdo"),
      date: date(event.date, "cada recuerdo"),
      note: label(event.note, 550, "el texto del recuerdo"),
      image: event.image,
    })).sort((a, b) => a.date - b.date);
    if (!events.length || events.length > 12) throw new Error("Añade entre uno y doce recuerdos.");
    await cover(doc, f, data, "ÁLBUM PERSONALIZADO", "Los días a los que volveríamos", data.cover || events[0].image, "01");
    const intro = base(doc, f, data.names, 2);
    spaced(intro, f.bold, "LÍNEA DEL TIEMPO", 48, 752);
    text(intro, f.serif, "Nuestros recuerdos", 48, 697, 39, "forest");
    events.forEach((event, i) => {
      const y = 649 - i * 45;
      line(intro, 48, y - 34, W - 48, y - 34);
      text(intro, f.bold, String(i + 1).padStart(2, "0"), 48, y - 7, 11, "rose");
      block(intro, f.serif, event.title, 86, y, 450, 16, 28);
      text(intro, f.regular, esDate.format(event.date), 86, y - 25, 9, "muted");
    });
    for (const [i, event] of events.entries()) {
      const p = base(doc, f, data.names, i + 3);
      spaced(p, f.bold, "RECUERDO " + String(i + 1).padStart(2, "0"), 48, 753);
      block(p, f.serif, event.title, 48, 703, 497, 34, 90, "forest");
      text(p, f.regular, esDate.format(event.date), 48, 614, 12, "rose");
      if (event.image) await photo(doc, p, event.image, 48, 292, 499, 296);
      block(p, f.regular, event.note, 48, event.image ? 253 : 559, 487, 14, 175);
    }
  }

  async function calendar(doc, f, data) {
    const year = Number(data.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error("Indica un año entre 1900 y 2100.");
    if (data.images.length !== 12 || data.images.some(image => !image)) {
      throw new Error("Selecciona una foto para cada mes.");
    }
    await cover(doc, f, data, "CALENDARIO PERSONALIZADO", "Doce meses para volver a vuestros recuerdos",
      data.cover || data.images[0], String(year));
    for (let m = 0; m < 12; m++) {
      const p = base(doc, f, data.names, m + 2);
      spaced(p, f.bold, String(m + 1).padStart(2, "0") + " / 12", 48, 759);
      text(p, f.serif, months[m], 48, 705, 47, "forest");
      text(p, f.bold, String(year), 501, 714, 16, "rose");
      await photo(doc, p, data.images[m], 48, 383, 499, 285);
      const first = (new Date(Date.UTC(year, m, 1)).getUTCDay() + 6) % 7;
      const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
      const cell = 499 / 7;
      weekdays.forEach((name, i) => text(p, f.bold, name, 59 + i * cell, 354, 9, i > 4 ? "rose" : "forest"));
      for (let i = 0; i < 42; i++) {
        const x = 48 + (i % 7) * cell, y = 302 - Math.floor(i / 7) * 37;
        const day = i - first + 1;
        const marked = data.date && data.date.getUTCMonth() === m && data.date.getUTCDate() === day;
        fill(p, x, y, cell - 2, 34, marked ? "sand" : i % 7 > 4 ? "pale" : "ivory");
        if (day > 0 && day <= days) text(p, marked ? f.bold : f.regular, String(day), x + 10, y + 17, 12, "forest");
      }
      if (data.date && data.date.getUTCMonth() === m && data.date.getUTCDate() <= days) {
        text(p, f.regular, data.date.getUTCDate() + " · Vuestra fecha especial", 48, 91, 10, "rose");
      }
    }
  }

  async function game(doc, f, data) {
    const tokens = {
      a: data.a, b: data.b, lugar: label(data.place, 75, "el lugar especial"),
      fecha: data.date ? esDate.format(data.date) : "",
    };
    if (!tokens.fecha) throw new Error("Indica la fecha que aparecerá en las tarjetas.");
    const cards = [];
    for (const [list, category] of [[data.questions, "PREGUNTA"], [data.challenges, "RETO"]]) {
      if (list.length !== 12) throw new Error("Introduce 12 preguntas y 12 retos, uno por línea.");
      list.forEach(entry => {
        const value = label(entry, 250, "cada tarjeta").replace(/\{(a|b|lugar|fecha)\}/g, (_, token) => tokens[token]);
        cards.push({ category, value });
      });
    }
    await cover(doc, f, data, "JUEGO PERSONALIZADO", "24 tarjetas para jugar con vuestra propia historia", data.cover, "24");
    const rules = base(doc, f, data.names, 2);
    spaced(rules, f.bold, "INSTRUCCIONES", 48, 738);
    text(rules, f.serif, "Una partida para dos", 48, 674, 37, "forest");
    const steps = [
      ["Preparad las tarjetas", "Imprimid las seis páginas de tarjetas a tamaño real. Recortad por el borde de cada tarjeta y separad las preguntas de los retos."],
      ["Jugad por turnos", "En cada turno, escoged una categoría y sacad una tarjeta al azar. Podéis pasar si una pregunta o un reto no os apetece."],
      ["Cerrad con un recuerdo", "Cuando queráis terminar, elegid la tarjeta que más os haya gustado y apuntad un plan para otro día."],
    ];
    steps.forEach(([heading, description], i) => {
      const y = 600 - i * 144;
      text(rules, f.bold, "0" + (i + 1), 48, y, 12, "rose");
      text(rules, f.serif, heading, 90, y, 22, "forest");
      block(rules, f.regular, description, 90, y - 33, 440, 14, 82);
      line(rules, 90, y - 98, W - 48, y - 98);
    });
    for (let page = 0; page < 6; page++) {
      const p = base(doc, f, "Recortad por el borde de cada tarjeta", page + 3);
      cards.slice(page * 4, page * 4 + 4).forEach(({ category, value }, i) => {
        const x = 48 + (i % 2) * 255, y = 452 - Math.floor(i / 2) * 336;
        const number = page * 4 + i + 1;
        p.drawRectangle({ x, y, width: 244, height: 315, color: col("ivory"),
          borderWidth: 0.65, borderColor: col("muted"), borderDashArray: [4, 3] });
        fill(p, x + 1, y + 263, 242, 51, category === "RETO" ? "rose" : "forest");
        text(p, f.bold, category + " " + String(number).padStart(2, "0"), x + 17, y + 282, 10, "white");
        block(p, f.serif, value, x + 17, y + 223, 208, 22, 176, "forest");
        line(p, x + 17, y + 56, x + 227, y + 56);
        block(p, f.bold, data.names, x + 17, y + 39, 208, 10, 32, "rose");
      });
    }
  }

  async function generate(options) {
    if (!Object.hasOwn(titles, options.product)) throw new Error("Selecciona un producto.");
    const a = label(options.a, 42, "el primer nombre");
    const b = label(options.b, 42, "el segundo nombre");
    const data = { ...options, a, b, names: a + " y " + b,
      date: options.date ? date(options.date, "vuestra fecha especial") : null };
    const doc = await PDFDocument.create();
    const f = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      serif: await doc.embedFont(StandardFonts.TimesRoman),
    };
    doc.setTitle(titles[data.product] + " | " + data.names);
    doc.setAuthor("68 Inspired");
    const render = { inspired, historia: story, calendario: calendar, juego: game };
    try {
      await render[data.product](doc, f, data);
    } catch (error) {
      if (/cannot encode/i.test(error.message)) {
        throw new Error("Hay un carácter que esta tipografía no admite. Revisa los emojis o símbolos especiales.");
      }
      throw error;
    }
    return doc.save();
  }

  return { generate, defaults, months, titles };
});
