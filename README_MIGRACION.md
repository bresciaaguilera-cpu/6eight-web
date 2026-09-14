# 6EIGHT — base lista para Antigravity + GitHub + Vercel

Esta carpeta conserva la web original de 6EIGHT y la deja preparada para trabajar como proyecto independiente.

## Qué contiene
- 20 páginas HTML completas.
- Diseño, CSS y JavaScript originales conservados.
- URLs internas convertidas a rutas limpias (`/tienda`, `/inspired-by-68`, etc.).
- `vercel.json` para desplegar la web como sitio estático en Vercel.
- `.gitignore` preparado para Git/Vercel.

## Abrir en local
Como es una web HTML estática, puedes abrir `index.html` directamente. Para probar rutas limpias, lo ideal es usar un servidor local.

Ejemplo desde Linux:

```bash
cd ~/6eight-web
python3 -m http.server 3000
```

Luego abre `http://localhost:3000`.

> Nota: el servidor simple de Python no interpreta las rutas limpias exactamente igual que Vercel. En Vercel sí funcionarán gracias a `cleanUrls`.

## Flujo recomendado
1. Guardar esta carpeta como `~/6eight-web`.
2. Abrir ESA carpeta en Antigravity.
3. Crear un repositorio GitHub separado, por ejemplo `6eight-web`.
4. Subir el proyecto a GitHub.
5. Importar ese repositorio en Vercel como un nuevo proyecto.
6. Conectar el dominio de 6EIGHT cuando quieras.

## Importante para Claude / Antigravity
La versión actual es HTML/CSS/JS estático. Es totalmente editable con Antigravity.

No hace falta convertirla a Next.js antes de publicarla. La estrategia recomendada es:
- Fase 1: desplegar exactamente esta web y seguir editándola sin romper el diseño.
- Fase 2: cuando vayamos a integrar pagos reales, cuentas, productos dinámicos o administración, migrar progresivamente a Next.js/React reutilizando la identidad visual y contenidos actuales.

## Identidad visual actual
- Fondo: `#F7EFE2`
- Verde: `#22362B`
- Terracota: `#B87460`
- Kraft: `#C9A57A`
- Tinta: `#2E302D`
- Beige: `#EFE5D6`
- Tipografías: Oswald + Inter + Caveat

## Regla para futuras ediciones
Antes de cambios grandes, hacer commit en Git para poder volver atrás si algo no gusta.

## Checkout / pagos
El botón de compra en `inspired-by-68.html` y `crea-el-vuestro.html` llama a
`/api/create-checkout-session`. Ese endpoint **está pendiente de implementar**
(backend de Stripe) antes del lanzamiento comercial. Mientras no exista, el
propio código muestra un aviso controlado al usuario en vez de fingir que el
pago ha funcionado — no hay que borrar ni sustituir ese código.

## ESTADO DEL PROYECTO
- Web estática lista para desplegar en Vercel.
- Diseño, identidad visual y contenidos actuales conservados sin cambios.
- Clean URLs activas (`vercel.json`, `cleanUrls: true`) y redirecciones permanentes
  desde `/6eight-home`, `/6eight-home.html` e `/index.html` hacia `/`.
- Checkout real (Stripe / `/api/create-checkout-session`) pendiente de implementar.
- Productos marcados como "Próximamente" en `tienda.html` pendientes de tener ficha propia.
- Dominio definitivo pendiente de decidir (ver `robots.txt` y `sitemap.xml`, que usan
  `DOMINIO-PENDIENTE.com` como marcador a sustituir).
- Integración con Stripe pendiente.
