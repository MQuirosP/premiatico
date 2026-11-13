# Premiático

**¡Más chances, más emoción!**

Plataforma digital para gestionar campañas promocionales con premios en Costa Rica (CRC), combos de pases digitales, motor de chances con dígitos dinámicos según el tamaño de la campaña (2 a 5 dígitos, desde `00`–`99` hasta `00000`–`99999`), reservas concurrentes, checkout SINPE Móvil y dashboard administrativo.

## Arquitectura

- `frontend/`: Next.js (App Router, exportación estática desplegada en Cloudflare Workers Assets con Wrangler), React, TypeScript strict, Tailwind CSS, React Hook Form, Zod y TanStack Query.
- `backend/`: Node.js LTS, Express, TypeScript strict, Prisma ORM (Neon PostgreSQL), Redis (aislado con prefijos `premiatico:*`), Cloudflare R2, Resend y Pino (desplegado en Render).
- `docs/`: Documentación técnica, checklist de fases, estrategia de concurrencia y respaldo manual.

## Funcionalidades principales

- **Portal público**:
  - Catálogo de campañas activas con imagen de portada, barra de progreso (sin exponer disponibilidad interna) y cuenta regresiva en vivo hacia la fecha de sorteo (`drawAt`) o cierre.
  - Selección de combos de pases digitales, reserva temporal con regeneración de números, checkout SINPE Móvil con carga de comprobante y consulta agrupada de pedidos/chances por correo o teléfono (`/pedido`).
- **Panel administrativo (`/admin`)**:
  - Campañas: creación con portada y fecha/referencia de sorteo, autorización legal, combos con pases digitales vinculados, gestión de múltiples premios/sorteos individuales (`CampaignPrize`) con evaluación por número, sorteo aleatorio, bloqueo previo a `drawAt`, reversión y notificación a ganadores (correo, WhatsApp y Web Share).
  - Pases digitales: carga directa de archivos (JPG, PNG, WEBP, PDF), vista previa firmada, prueba de estampado vectorial y eliminación/desactivación segura.
  - Pedidos y pagos SINPE: filtros por estado, visor modal de comprobante, aprobación/rechazo con confirmación o liberación atómica de chances y envío automático de correos **Compra recibida** / **Pago confirmado** con pases y chances estampados vía `sharp` + SVG vectorial.
  - Auditoría: historial de acciones con paginación por cursor.

## Reglas de desarrollo

1. TypeScript `strict: true` obligatorio en frontend y backend.
2. Toda la lógica de negocio reside en `backend/` (el frontend es 100% estático).
3. Moneda en CRC representada en enteros (`Int`) o `Decimal`, nunca `Float`.
4. Números de participación almacenados como `String` (2 a 5 dígitos según `totalChances`).
5. Terminología comercial obligatoria: **Pase**, **Chance**, **Chances de regalo**, **Combo**.

## Documentación

- [Historial de cambios (CHANGELOG)](./CHANGELOG.md)
- [Checklist de implementación por fases](./docs/CHECKLIST.md)
