# Changelog

Todos los cambios notables de **Premiático** se documentan en este archivo.

## [1.2.0] - 2026-11-19

### Agregado

- **Guarda de fecha y reversión en `SINGLE_WINNER`**:
  - Bloqueo de evaluación de campañas `SINGLE_WINNER` antes de `drawAt ?? endAt` (`assertCampaignDrawTimeReached`).
  - Endpoint `POST /api/v1/admin/campaigns/:id/reset-evaluation` y botón **Revertir evaluación** con registro en `AuditLog`.
- **Series diarias y Sorteos Flash con motor de elegibilidad (`prize-eligibility.ts`)**:
  - Creación de series diarias por rango de fechas (`POST /api/v1/admin/prizes/batch-daily`).
  - Soporte de dinámicas `FLASH` también dentro de campañas `SINGLE_WINNER` sin cerrar la campaña principal.
  - Criterios configurables por premio/flash: monto mínimo (`PER_ORDER` o acumulado `CUSTOMER_TOTAL`), mínimo de fichas, ventana de compra (`purchaseFrom` / `purchaseUntil`), combo requerido, canal (`WEB` / `PARTNER`) y peso en tómbola (`PER_TICKET` / `PER_CUSTOMER`).
  - Previsualización en vivo de elegibles (`GET /api/v1/admin/prizes/:id/eligible-summary`).
- **Tabla exclusiva de ganadores y seguimiento (`DrawWinner`)**:
  - Nueva tabla `DrawWinner` con historial de evaluaciones y estado de entrega (`PENDING_CONTACT`, `CONTACTED`, `SCHEDULED`, `DELIVERED`, `UNCLAIMED`, `REVERTED`) administrable desde `GET /api/v1/admin/winners` y `PATCH /api/v1/admin/winners/:id/delivery`.
  - Migración `20261119143000_add_categories_and_draw_winners` con backfill de ganadores existentes.
- **Catálogo estandarizado de categorías (`CampaignCategory`)**:
  - Endpoints `GET/POST/PATCH /api/v1/admin/categories` con normalización de `slug` anti-duplicados y gestión en `/admin/configuracion`.
- **Experiencia Admin y Portal Público**:
  - Nuevo **Centro de Sorteos** (`/admin/sorteos`) separado de la construcción de campañas, con desbloqueo automático por reloj en vivo, evaluación en 1 paso y pestaña **Seguimiento de entregas**.
  - Asistente unificado de 5 pasos (`CampaignWizard`) para crear y editar campañas (`General y Fechas`, `Fichas y Modalidad`, `Apariencia y Galería`, `Combos y Pases`, `Diseño de Sorteos`).
  - Nueva página pública `/ganadores` (y enlace en `SiteHeader`) con los últimos 5 ganadores verificados (`GET /api/v1/campaigns/winners`), sin exponer datos personales de clientes.
  - Bloque **Premios y Sorteos Flash** activos y anuncio de subcampaña en vivo en `CampaignCountdown` dentro de `/campana`.

### Corregido

- Mapeo dark mode en `globals.css` para pills `bg-indigo-50`, `bg-sky-50` y `bg-teal-50`.
- Acceso rápido **Nueva campaña** en `/admin` enlazado directo al asistente (`/admin/campanas?new=1`).
- Conservación de la fecha oficial de la campaña en `CampaignCountdown` cuando existe una subcampaña flash en juego.

## [1.1.0] - 2026-11-13

### Agregado

- **Múltiples premios y sorteos por campaña (`CampaignPrize`)**:
  - Creación por lotes (`quantity`), edición y eliminación segura desde `/admin/campanas/detalle`.
  - Evaluación manual por número (`POST /api/v1/admin/prizes/:id/evaluate-winner`) y sorteo aleatorio criptográfico entre chances confirmados (`POST /api/v1/admin/prizes/:id/draw-random`, con opción de permitir o evitar ganadores repetidos).
  - Bloqueo de evaluación antes de la fecha/hora programada (`drawAt`) tanto en backend como en UI admin.
  - Reversión de evaluación (`POST /api/v1/admin/prizes/:id/reset`) con registro en `AuditLog`.
  - Notificación al ganador por correo (`POST /api/v1/admin/prizes/:id/notify-email`), enlace directo a WhatsApp (`wa.me`), Web Share nativo del navegador y `mailto:`.
- **Correos enriquecidos y estampado dinámico de pases/chances (`sharp` + SVG vectorial)**:
  - Correo **COMPRA RECIBIDA** (`PROOF_RECEIVED`) al subir comprobante SINPE y **PAGO CONFIRMADO** (`PAYMENT_CONFIRMED`) al aprobar el pago, con plantilla HTML y adjuntos PNG inline (`cid:`).
  - Estampado vectorial independiente de fuentes del sistema sobre la imagen del pase ligado a la campaña, más descarga directa del pase estampado con el código de pedido (`GET /api/v1/orders/:publicReference/stamped-pass`).
- **Herramientas admin y pruebas**:
  - Vista previa (`GET /api/v1/admin/passes/:id/preview`) y prueba de estampado (`GET /api/v1/admin/passes/:id/preview-stamped`) en `/admin/pases`.
  - Prueba unitaria de estampado (`backend/tests/chance-card.test.ts`, llevando la suite a `6` archivos y `15/15` pruebas).

### Cambiado

- **Privacidad pública**: Se ocultó la cantidad disponible en barras de progreso públicas y el desglose interno de premios en `/campana`.
- **Portal `/pedido`**: Vista agrupada por campaña con resumen superior del cliente, contadores (`Activas`, `Finalizadas`, `Pendientes`) y estado en español.
- **Descarga de pases**: Se preservó la extensión original del archivo en R2 (`Content-Disposition`) y se restringió la descarga únicamente a pagos `APPROVED`.

### Corregido

- Normalización de dimensiones base y overlay SVG en `sharp` para evitar errores de composición (`Image to composite must have same dimensions or smaller`).
- Resolución automática de URL pública de frontend (`FRONTEND_URL` / `*.workers.dev`) y backend (`BACKEND_URL`) en enlaces de correos.
- Eliminación de emoji en mensajes externos de ganador para evitar caracteres rotos en handoffs de SO/navegador.

## [1.0.0] - 2026-11-12

### Agregado

- **MVP 1.0 completo**: API REST en Express + TypeScript + Prisma + Neon PostgreSQL + Redis + Cloudflare R2 y frontend estático en Next.js + Tailwind CSS.
- **Gestión de campañas**:
  - Creación y edición de campañas con imagen de portada (`POST /api/v1/admin/campaigns/cover-upload`), fecha de cierre (`endAt`), fecha y referencia de sorteo (`drawAt`, `drawReference`).
  - Gate de autorización legal y publicación/pausa/cierre/eliminación de borradores.
  - Vista de detalle administrativo (`/admin/campanas/detalle?id=...`) con combos, pases vinculados y órdenes participantes.
  - Evaluación automática de sorteo y ganador (`POST /api/v1/admin/campaigns/:id/evaluate-winner`) respetando la cantidad de dígitos asignada a la campaña (2 a 5 dígitos) y mostrando el detalle completo del ganador.
- **Pases digitales y combos**:
  - Carga directa de pases digitales (`POST /api/v1/admin/passes/upload`), vinculación a combos y borrado/desactivación segura.
- **Portal público y checkout SINPE Móvil**:
  - Header persistente, footer con acceso discreto al panel administrativo y tarjetas de combos destacadas.
  - Banner con cuenta regresiva en vivo hacia el sorteo (`drawAt`).
  - Reserva concurrente de números con regeneración controlada, carga de comprobante SINPE Móvil y consulta de pedidos activos por correo electrónico o teléfono (`POST /api/v1/orders/lookup`).
- **Revisión SINPE y auditoría**:
  - Tabla de pedidos en `/admin/pedidos` con filtros por estado, badges de campaña/chances y visor modal de comprobante.
  - Historial de auditoría en `/admin/auditoria` con paginación por cursor (`cursor`, `nextCursor`, `hasMore`) y barra lateral fija.
- **Pruebas automatizadas**:
  - Suites Vitest para autenticación, campañas, concurrencia de reservas, aprobación/rechazo de pagos y carga de pases digitales.
