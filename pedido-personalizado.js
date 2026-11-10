"use strict";

const byId = id => document.getElementById(id);
const options = [...document.querySelectorAll(".producto-opcion")];
const panels = [...document.querySelectorAll("[data-form]")];
const submit = byId("pagar");
const status = byId("estado");
const params = new URLSearchParams(window.location.search);
const memories = byId("recuerdos");
let selected, ready = false, busy = false;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function select(option) {
  selected = option;
  for (const button of options) {
    button.classList.toggle("selected", button === selected);
    button.setAttribute("aria-pressed", String(button === selected));
  }
  for (const panel of panels) {
    panel.hidden = panel.dataset.form !== selected.dataset.id;
    panel.disabled = panel.hidden;
  }
  byId("fecha").required = selected.dataset.id === "juego-personalizado";
  const price = (Number(selected.dataset.precio)).toFixed(2).replace(".", ",");
  byId("seleccion").textContent = selected.dataset.nombre + " · " + price + " €";
  submit.textContent = "Continuar al pago · " + price + " €";
  submit.disabled = !ready || busy;
}

function renumber() {
  [...memories.children].forEach((memory, index) => {
    memory.querySelector("h3").textContent = "Recuerdo " + (index + 1);
    memory.querySelector(".quitar").disabled = memories.children.length === 1;
  });
  byId("anadir").disabled = memories.children.length >= 12;
}

function addMemory() {
  const memory = byId("recuerdo").content.firstElementChild.cloneNode(true);
  memory.querySelector(".quitar").addEventListener("click", () => {
    memory.remove();
    renumber();
  });
  memories.append(memory);
  renumber();
}
byId("anadir").addEventListener("click", addMemory);
addMemory();

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthInputs = months.map((month, index) => {
  const group = document.createElement("div");
  group.className = "form-field";
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.required = true;
  input.id = "mes-" + (index + 1);
  label.htmlFor = input.id;
  label.textContent = month;
  group.append(label, input);
  byId("fotosMes").append(group);
  return input;
});
byId("anio").value = new Date().getFullYear() + 1;

options.forEach(option => option.addEventListener("click", () => select(option)));
select(options.find(option => option.dataset.id === params.get("producto")) || options[0]);
fetch("/api/personalized-checkout", { cache: "no-store" })
  .then(response => response.ok ? response.json() : { ready: false })
  .then(config => {
    ready = config.ready === true;
    submit.disabled = !ready;
    setStatus(ready
      ? params.has("cancelado") ? "El pago se canceló. Podéis preparar un pedido nuevo." : "La descarga estará lista al finalizar el pago."
      : "Los pedidos personalizados aún no están abiertos.");
  })
  .catch(() => setStatus("No se pudo comprobar la disponibilidad. Recargad la página.", true));

async function compressPhoto(input) {
  const file = input.files[0];
  if (!file) return null;
  if (file.size > 16 * 1024 * 1024) throw new Error("Usad fotos de hasta 16 MB cada una.");
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("No podemos abrir una foto. Usad JPG, PNG o WebP.");
  }
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    for (const max of [1500, 1200, 950, 720, 560, 400]) {
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/jpeg", 0.78).split(",")[1];
      if (encoded && encoded.length <= 190 * 1024 * 4 / 3) return encoded;
    }
    throw new Error("Una foto es demasiado grande. Elegid una versión más pequeña.");
  } finally {
    image.close();
  }
}

async function readOrder(productId) {
  const value = id => byId(id).value.trim();
  const order = {
    productId, a: value("nombre1"), b: value("nombre2"), date: value("fecha"),
    photosPermission: byId("permiso").checked, cover: await compressPhoto(byId("portada")),
  };
  if (productId === "inspired-by-68-personalizado") order.dedication = value("dedicatoria");
  if (productId === "nuestra-historia") {
    order.events = [];
    for (const memory of memories.children) {
      const field = name => memory.querySelector('[data-field="' + name + '"]');
      order.events.push({ title: field("title").value, date: field("date").value,
        note: field("note").value, image: await compressPhoto(field("image")) });
    }
  }
  if (productId === "calendario-personalizado") {
    order.year = value("anio");
    order.images = [];
    for (const input of monthInputs) order.images.push(await compressPhoto(input));
  }
  if (productId === "juego-personalizado") order.place = value("lugar");
  return order;
}

byId("pedido").addEventListener("submit", async event => {
  event.preventDefault();
  if (!ready || busy) return;
  busy = true;
  submit.disabled = true;
  options.forEach(option => { option.disabled = true; });
  setStatus("Preparando vuestro PDF y el pago. Puede tardar unos segundos…");
  try {
    const order = await readOrder(selected.dataset.id);
    const response = await fetch("/api/personalized-checkout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.url) throw new Error(result.error || "No se pudo iniciar el pago.");
    window.location.assign(result.url);
  } catch (error) {
    setStatus(error.message || "No se pudo iniciar el pago.", true);
    busy = false;
    submit.disabled = !ready;
    options.forEach(option => { option.disabled = false; });
  }
});
