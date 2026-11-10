// Keeps previously issued links working through the private PDF flow.
const download = require("./get-download");

module.exports = function handler(req, res) {
  const calendar = {
    setHeader: (name, value) => res.setHeader(name, value),
    status(code) {
      return {
        json(data) {
          if (code !== 200) return res.status(code).json(data);
          const file = data.descargas.find(item => item.productId === "calendario-adviento-parejas");
          if (file) return res.redirect(303, file.url);
          return res.status(404).json({ error: "El calendario de Adviento no está disponible para este pedido." });
        },
      };
    },
  };
  return download(req, calendar);
};
