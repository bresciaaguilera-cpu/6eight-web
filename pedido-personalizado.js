"use strict";

const byId = id => document.getElementById(id);
const options = [...document.querySelectorAll(".producto-opcion")];
const panels = [...document.querySelectorAll("[data-form]")];
const submit = byId("pagar");
const status = byId("estado");
const params = new URLSearchParams(window.location.search);
const memories = byId("recuerdos");
let selected, ready = false;

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
  submit.textContent = "Añadir a la cesta · " + price + " €";
  submit.disabled = !ready;
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
  input.type = "text";
  input.maxLength = 180;
  input.id = "mes-" + (index + 1);
  label.htmlFor = input.id;
  label.textContent = month;
  group.append(label, input);
  byId("notasMes").append(group);
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

function readOrder(productId) {
  const value = id => byId(id).value.trim();
  const order = { productId, a: value("nombre1"), b: value("nombre2"), date: value("fecha"),
    permission: byId("permiso").checked };
  if (productId === "inspired-by-68-personalizado") order.dedication = value("dedicatoria");
  if (productId === "nuestra-historia") {
    order.events = [...memories.children].map(memory => Object.fromEntries(
      [...memory.querySelectorAll("[data-field]")].map(field => [field.dataset.field, field.value.trim()])
    ));
  }
  if (productId === "calendario-personalizado") {
    order.year = value("anio");
    order.notes = monthInputs.map(input => input.value.trim());
  }
  if (productId === "juego-personalizado") order.place = value("lugar");
  return order;
}

byId("pedido").addEventListener("submit", event => {
  event.preventDefault();
  if (!ready) return;
  try {
    window.Cart68.addPersonalized(readOrder(selected.dataset.id));
    setStatus("Añadido a la cesta. Podéis seguir añadiendo productos o ir al pago.");
  } catch {
    setStatus("No se ha podido guardar la personalización en este navegador.", true);
  }
});
