# Puesta en marcha de los PDF personalizados

El cliente elige un producto, sube sus fotos y revisa el precio. El servidor valida la solicitud, genera el PDF y lo guarda en el Blob privado antes de crear la sesión de Stripe. Después del pago se puede descargar desde la confirmación y llega un enlace por email. La sesión de Stripe por sí sola no da acceso al PDF. También se requiere el código que figura en el enlace.

## Configuración por entorno

1. Conectad el Blob privado de la tienda. El libro original debe seguir disponible en `products/inspired-by-68.pdf`.
2. En Stripe, configurad `STRIPE_SECRET_KEY` para el entorno. Usad una clave de prueba en Preview o desarrollo y una clave activa en Production.
3. Cread un destino de eventos para `https://68inspired.com/api/personalized-webhook` en el modo activo. Seleccionad `checkout.session.completed` y `checkout.session.expired`. En pruebas usad un destino o reenvío independiente. Guardad el secreto de firma en `STRIPE_PERSONALIZED_WEBHOOK_SECRET`.
4. Verificad el dominio remitente en Resend. Guardad la clave en `RESEND_API_KEY` y el remitente verificado en `PERSONALIZED_EMAIL_FROM`.
5. Configurad un valor aleatorio para `CRON_SECRET`. Vercel lo usa para autorizar la limpieza diaria de los archivos personalizados con más de 30 días. El webhook elimina también el PDF de una sesión expirada sin pago.
6. Revisad los datos pendientes en las páginas legales antes de abrir la venta. Tras verificar el flujo, configurad `PERSONALIZED_ORDERS_ENABLED=true` y cread un nuevo despliegue para aplicar las variables.

## Verificación antes de abrir pedidos

- Usad datos ficticios y Stripe en modo de prueba. Completad un pedido de cada producto, incluido un calendario con fotos y un álbum con recuerdos introducidos fuera de orden.
- Verificad la descarga desde la página de confirmación y desde el correo, también desde otro navegador. Comprobad que un enlace sin su código y un pedido sin pagar no devuelvan el PDF.
- Reenviad el mismo evento completado desde Stripe y confirmad que el cliente solo recibe un email. Comprobad que la descarga de los productos estándar sigue funcionando.
