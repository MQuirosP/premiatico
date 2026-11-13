---
name: module-verification
description: Checklist obligatorio al finalizar cada módulo de Premiático antes de declararlo completado.
---

# Verificación de Módulo — Premiático

Antes de marcar cualquier módulo o fase como completada:

1. **Backend e Integridad:**
   - Módulos estructurados en `*.schema.ts`, `*.service.ts` y `*.routes.ts` (SOLID / KISS) y uso de helpers compartidos (`createMemoryUpload`, `deleteObject` en rollback de R2).
   - Endpoints REST con validación Zod en body, params y query, sin doble ejecución de `requireAdminAuth`.
   - Errores centralizados (incluyendo `MulterError`) y logs estructurados (sin datos sensibles).
   - Auditoría (`AuditLog`) en mutaciones administrativas.
   - Transacciones e idempotencia en operaciones de reserva, pedido, pago y notificación.
2. **Frontend y Responsive:**
   - Compatible con `output: 'export'` (sin `cookies()`, `headers()`, Server Actions ni API Routes).
   - Páginas desacopladas en subcomponentes reutilizables; tablas admin con vista *cards* en móvil (`sm:hidden`) y tabla en desktop (`hidden sm:block`).
   - Terminología oficial (`Pase`, `Chance`, `Chances de regalo`, `Combo`) y formato de moneda en CRC (`₡`).
3. **Pruebas y Compilación:**
   - Ejecutar `npx tsc --noEmit` en `backend/` y `frontend/`.
   - Ejecutar pruebas automatizadas del módulo (priorizando integración real con PostgreSQL para transacciones y concurrencia).
   - Ejecutar build (`npm run build`) en `backend/` y `frontend/`.
4. **Control de Cambios y Checklist:**
   - Actualizar `docs/CHECKLIST.md` marcando las tareas completadas.
   - Proponer mensaje de commit en inglés siguiendo Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
