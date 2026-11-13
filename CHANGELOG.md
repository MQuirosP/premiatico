# Changelog

Todos los cambios notables de **Premiático** se documentan en este archivo.

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
