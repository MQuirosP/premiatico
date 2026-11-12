# Checklist de Desarrollo — Premiático MVP 1.0

> Actualizar este archivo al finalizar cada sesión o módulo.

## Decisiones Aprobadas

- **Expiración:** Sesión de reserva `15 min`, pedido `PENDING_PAYMENT` `60 min`, `UNDER_REVIEW` **no expira automáticamente** (SLA admin `24 h`).
- **Conjunto elegible (`totalChances < 100,000`):** Universo `00000`–`99999` elegible hasta cerrar cupo (`RESERVED + CONFIRMED == totalChances`).
- **Rechazo de comprobante:** Estado `REJECTED` terminal (libera chances, sin re-subida sobre el mismo pedido).
- **Entorno Node.js:** `v22.23.4` (vía `nvm`).

---

## Fase 0 — Preparación del Entorno y Gobernanza

- [x] Inspeccionar repositorio y entorno.
- [x] Inicializar Git (`main`) y vincular remoto `https://github.com/MQuirosP/premiatico.git`.
- [x] Crear `.gitignore`, `.env.example` y `README.md`.
- [x] Configurar `.agent/rules/premiatico-rules.md` y `.agent/skills/module-verification/SKILL.md`.

## Fase 1 — Arquitectura Base, Base de Datos y Autenticación

- [x] Inicializar `backend/` (Express, TypeScript strict, Pino, Zod, manejo centralizado de errores).
- [x] Configurar Prisma ORM y esquema completo en `backend/prisma/schema.prisma` (incluyendo índice único parcial en `Participation`).
- [x] Configurar cliente Redis con prefijos `premiatico:cache:`, `premiatico:rate:`, `premiatico:jobs:`.
- [x] Implementar módulo `auth` (hash Argon2/bcrypt, sesiones admin con cookies `HttpOnly`/`Secure`, middleware RBAC y `AuditLog`).
- [x] Inicializar `frontend/` (Next.js App Router `output: 'export'`, TypeScript strict, Tailwind CSS, shadcn/ui, TanStack Query).
- [x] Implementar login administrativo y layout base del Dashboard (`/admin`).
- [x] Ejecutar `tsc --noEmit`, build y pruebas de autenticación.

## Fase 2 — Administración de Campañas y Portal Público

- [x] Módulo `storage` (Cloudflare R2: upload, delete, signed upload/download URLs, metadata).
- [x] Módulo `campaigns` (CRUD, bloqueo legal antes de activar, cierre lógico).
- [x] Módulos `prizes`, `passes` (contenido privado en R2) y `combos` (`ComboPassItem`).
- [x] Portal público responsive: catálogo de campañas activas, detalle de premios, condiciones, barra de progreso real (`(confirmados / totales) * 100`) y selector de combos.
- [x] Vistas administrativas de Campañas y Pases digitales.
- [x] Pruebas de bloqueo legal y cálculo de progreso (`tests/campaigns.test.ts`).

## Fase 3 — Motor de Chances, Reservas y Checkout SINPE

- [x] Módulos `chances` y `reservations`: asignación aleatoria atómica, regeneración persistida hasta `maxNumberChanges`, liberación de vencidos.
- [x] Pruebas de concurrencia con 25 solicitudes simultáneas sin duplicados (`tests/reservations-concurrency.test.ts`, con simulador transaccional; pendiente ejecutar contra Neon PostgreSQL real al configurar `DATABASE_URL`).
- [x] Módulos `customers` y `orders`: creación idempotente con snapshot de precios/pases y token anti-enumeración.
- [x] Módulo `payments`: instrucciones SINPE, subida de comprobantes a R2 (JPG/PNG/WEBP/PDF, máx 5 MB, magic bytes), transición a `UNDER_REVIEW`.
- [x] Flujo público completo: selección de combo, regeneración de chances, checkout SINPE, carga de comprobante y consulta de pedido (`/pedido`).

## Fase 4 — Revisión de Pagos, Notificaciones, Seguridad y Despliegue

- [x] Revisión manual en Dashboard: listado de pagos pendientes, visor seguro de comprobantes, aprobación atómica (confirma chances) y rechazo terminal (`/admin/pedidos`).
- [x] Módulo `notifications` con Resend (`notificaciones@premiatico.com`) e idempotencia (`NotificationLog`).
- [x] Descarga segura de `DigitalPass` tras confirmación de pago (`/pedido`).
- [x] Dashboard resumen (indicadores reales), listado de clientes (`/admin/clientes`) y visor de `AuditLog` (`/admin/auditoria`).
- [x] Endurecimiento de seguridad: Cloudflare Turnstile, rate limiting Redis (`premiatico:rate:`), CORS restringido.
- [x] Pruebas automatizadas de auth, campañas, concurrencia y pagos (`13/13` pasando en `vitest`).
- [x] Documentación de concurrencia (`docs/CONCURRENCY.md`) y respaldo manual R2 / despliegue (`docs/DEPLOYMENT_AND_BACKUPS.md`).
- [ ] Configurar `.env` con credenciales reales (Neon, Redis, R2, Resend, Turnstile), ejecutar `prisma migrate deploy` + índice único parcial y desplegar en Render + Cloudflare Pages.
