# Tienda 68 Inspired

Esta rama conserva la cesta del dominio público y prepara 12 productos de venta automática y dos PDF promocionales. Los cuatro productos personalizados continúan en el circuito a medida.

## Preparar la prueba

1. Extraer el paquete privado fuera del repositorio. El archivo del calendario de 12 citas va en la raíz de Blob como `calendario-12-citas.pdf`. Los demás usan `products/<identificador>.pdf`. No subir PDF de pago al repositorio, a la carpeta pública ni a un Blob público.
2. En un entorno con acceso al Blob privado del proyecto, ejecutar `npm ci` y `node scripts/upload-shop-pdfs.js --upload /ruta/al/paquete-extraido`. El comando verifica las huellas y evita sobrescribir archivos. Si detecta un objeto distinto, revisar la edición antes de sustituirlo. Repetir con `--verify` para confirmar todos los archivos.
3. Preparar un Preview con acceso OIDC al Blob privado y una `STRIPE_SECRET_KEY` de prueba en Preview. El checkout exige una clave de prueba fuera de Producción. Vercel construye los retornos de Preview con su propio dominio.
4. Hacer un pedido de 14,90 € del calendario, cancelar una sesión y confirmar que no genera descargas, y verificar tanto la descarga como el nombre. Al caducar el enlace, recargar la confirmación. Comprobar un pedido con regalo y otro que active las promociones de 50 € y 68 €. El regalo de bienvenida se recuerda por navegador.
5. Validar el precio de San Valentín (9,90 € en esta rama), el dominio final y la edición de cada PDF. Para activar ventas, configurar una clave live de Stripe en Producción y promover el despliegue verificado. El checkout de Producción exige una clave live y comprueba la disponibilidad de los PDF privados antes de crear la sesión.

`npm run catalog` vuelve a generar el catálogo del navegador tras un cambio de precios. No incluye rutas privadas.
