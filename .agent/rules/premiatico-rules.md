---
description: Reglas obligatorias de arquitectura, terminología, concurrencia y seguridad para Premiático MVP 1.0
---

# Reglas del Proyecto Premiático

1. **Stack y Arquitectura**
   - Monolito modular: `frontend/` (Next.js App Router con `output: 'export'` estático) y `backend/` (Express + TypeScript strict).
   - **Prohibido** usar SSR, Server Actions o API Routes en Next.js. Toda lógica de negocio reside en Express.
   - **Prohibido** introducir microservicios, workers separados o funcionalidades fuera del MVP (sin multi-tenancy, sin pasarela de tarjetas, sin conciliación CSV).

2. **TypeScript y Validación**
   - `strict: true` obligatorio en `frontend/tsconfig.json` y `backend/tsconfig.json`.
   - Toda entrada HTTP en backend y formularios en frontend debe validarse con **Zod**.
   - Manejo centralizado de errores y respuestas estructuradas.

3. **Integridad de Datos y Dominio**
   - **Moneda CRC:** Usar enteros (`Int`) o `Decimal`. **Nunca `Float`**.
   - **Números de 5 dígitos:** Representar como `String` (`VARCHAR(5)`) para conservar ceros iniciales (`00000`–`99999`).
   - **Elegibilidad < 100,000:** Todo el universo `00000`–`99999` es elegible hasta agotar `totalChances` (`RESERVED + CONFIRMED`).
   - **Política de expiración:** Sesión de reserva `15 min`, pedido `PENDING_PAYMENT` `60 min`; pedidos `UNDER_REVIEW` (con comprobante) **nunca expiran automáticamente** (SLA de revisión admin `24 h`). Rechazo de pago (`REJECTED`) es terminal y libera los chances.
   - **Bloqueo legal:** No permitir publicar/activar campañas que requieran autorización sin `legalApprovalStatus === 'APPROVED'`.

4. **Terminología Comercial Obligatoria (Costa Rica)**
   - Producto digital → **Pase** (interno: `DigitalPass`).
   - Participación numerada → **Chance** (interno: `Participation`).
   - Participaciones incluidas → **Chances de regalo**.
   - Paquete promocional → **Combo** (interno: `CampaignCombo`).
   - **Prohibido** usar "wallpaper", "sticker" o "boleto" como terminología principal.

5. **Redis y Seguridad**
   - Todas las claves en Redis deben usar exclusivamente los prefijos `premiatico:cache:`, `premiatico:rate:` o `premiatico:jobs:`. Nunca borrar o modificar claves ajenas.
   - Nunca almacenar secretos en Git ni registrar contraseñas, tokens o datos bancarios en logs.
   - Registrar `AuditLog` en todas las acciones administrativas críticas.
   - Usar transacciones PostgreSQL, restricciones únicas parciales e idempotencia para operaciones concurrentes.
