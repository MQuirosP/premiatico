# Plan de Integración: Premiático × Bancas (Estrategia de Lotería Exclusiva)

> **Objetivo:** Permitir que los vendedores de tiempos (`native-vendedores`) vendan combos/chances de campañas activas de Premiático desde su terminal o teléfono, contabilizando ventas, comisiones, crédito, arqueos y liquidaciones de forma **100% nativa** dentro de `Bancas`.

---

## 1. Arquitectura General (Lotería Exclusiva "Premiático" + API Partner B2B)

En lugar de duplicar motores contables o modificar funciones PL/pgSQL (`fn_sync_sorteo_statements`, `fn_get_evaluated_summaries_batch`, `ResumenCierreDiario`), **`Bancas` modela Premiático como una `Loteria` exclusiva** (con `rulesJson.isExternalCampaign = true` y un `Sorteo` asociado por campaña o por día), **sin necesidad de migraciones Prisma en `Bancas/backend`** (reutilizando `Ticket.paymentMethod`, `Ticket.paymentNotes`, `Ticket.paymentHistory`, `Ticket.idempotencyKey`, `Loteria.rulesJson` y `User.settings` que ya existen en el esquema).

```text
[native-vendedores (Android)]
        │  JWT propio + IdempotencyInterceptor (clientRequestId)
        ▼
[Bancas/backend (Orquestador + Contabilidad Nativa)]
        │  1. Valida permiso (premiaticoEnabled) y crédito (VendorCreditService)
        │  2. Confirma orden en Premiático (X-Partner-Id + X-Partner-Key)
        │  3. Emite Ticket + Jugadas en la Lotería "Premiático" + PremiaticoTicketLink
        │     └─► AccountStatement, bySorteo, evaluated-summary, cierres y
        │         comisiones funcionan 100% nativos sin tocar PL/pgSQL
        │
        ▼
[premiatico/backend (Partner B2B API)]
        │  - Fuente única de verdad de campañas, combos, inventario de números y pases
        │  - Asigna números con bloqueo FOR UPDATE + índice único parcial
        │  - Emite Order CONFIRMED + Payment APPROVED (PARTNER_POS) en 1 paso
```

### Principios de diseño

1. **Contabilidad 100% nativa en `Bancas`:** Al registrarse como `Ticket` + `Jugada` dentro de la `Loteria` exclusiva `"Premiático"`, `AccountStatement`, `bySorteo`, `ResumenCierreDiario`, `evaluated-summary`, exports (CSV/Excel/PDF), `VendorCreditService` y `CommissionPolicyV1` funcionan sin parches ni descuadres.
2. **Una sola sesión para el vendedor:** `native-vendedores` solo se autentica y habla con `Bancas/backend` usando su JWT actual.
3. **Venta directa confirmada (sin SINPE manual):** El cliente le paga en el acto al vendedor, por lo que la orden en Premiático nace **`CONFIRMED` de inmediato** y `Customer.email` es opcional.
4. **Cero riesgo de doble cálculo de premios:** Los premios de campañas los entrega Premiático directamente, nunca el vendedor en la calle. Los sorteos de la lotería `"Premiático"` nunca se evalúan con pagos en `Bancas` (`totalPayout = 0`).
5. **Comisiones administrables:** El administrador configura el `%` de comisión (vendedor y ventana) usando la misma UI de políticas de comisión por `loteriaId` que ya existe en `bancas-admin-app`.
6. **Anulaciones restringidas:** Solo `ADMIN`, `BANCA` y `VENTANA` pueden anular un ticket de Premiático desde `bancas-admin-app`; al hacerlo, `Bancas/backend` cancela primero la orden en `premiatico/backend` (si la campaña sigue `ACTIVE`) y luego anula el `Ticket` localmente.

---

## 2. Resumen por Repositorio

### 2.1 `premiatico/backend` (API Partner B2B)

- `Customer.email` pasa a opcional (`String?`), guardando `sendRichOrderEmail` cuando sea `null`.
- Nuevos campos en `Order`: `channel` (`WEB` | `PARTNER`), `partnerCode`, `idempotencyKey` (`@unique`), `externalBancaId`, `externalVentanaId`, `externalSellerId`, `externalSellerName`.
- Nuevo `PaymentMethod.PARTNER_POS`.
- Middleware `requirePartnerAuth` (`X-Partner-Id` + `X-Partner-Key`, sin Turnstile).
- Endpoints `/api/v1/partner`:
  - `GET /campaigns`: campañas `ACTIVE` con combos, `totalChances` (dígitos), `enableInverseNumbers` y `remainingChances`.
  - `POST /orders`: venta atómica e idempotente (`Order(CONFIRMED)` + `Participation(CONFIRMED)` + `Payment(APPROVED)`).
  - `POST /orders/:publicReference/cancel`: anulación permitida solo si la campaña sigue `ACTIVE`; libera los números (`Participation.status = 'RELEASED'`).

### 2.2 `Bancas/backend` (Lotería Exclusiva + Orquestador, **sin migración Prisma**)

- **Cero cambios a `prisma/schema.prisma`**:
  - Habilitación por Banca: `Loteria` activa de esa banca con `rulesJson.isExternalCampaign = true`.
  - Habilitación por Vendedor: `User.settings.premiaticoEnabled` (columna `Json?` ya existente).
  - Enlace con Premiático: en `Ticket` se guardan `idempotencyKey` (ya `@unique`), `paymentMethod = "PREMIATICO_POS"`, `paymentNotes = publicReference` (`PRM-XXXXXXXX`) y `paymentHistory = { premiatico: { orderId, publicReference, trackingUrl, campaignId, comboId, numbers } }`.
- Endpoints `/api/v1/premiatico`:
  - `GET /campaigns`: proxy con caché corto (30–60s) hacia Premiático, validando habilitación.
  - `POST /sales`: valida crédito y permisos -> llama `POST premiatico/api/v1/partner/orders` -> si confirma, crea el `Ticket` + `Jugada`s en la Lotería `"Premiático"` (calculando comisiones con `TicketCommissionCalculator`).
- Integración en `TicketOperationsService.cancel`: si el ticket es `paymentMethod === "PREMIATICO_POS"`, bloquea a `VENDEDOR` (`403`), exige rol `ADMIN | BANCA | VENTANA`, cancela primero en Premiático y luego ejecuta `TicketRepository.cancel`.
- Protección de `CreateTicketService`: los sorteos de la lotería `rulesJson.isExternalCampaign = true` se bloquean en `POST /tickets` normal para evitar ventas sin respaldo de Premiático.

### 2.3 `Bancas/bancas-admin-app`

- **Habilitación:** switch `premiaticoEnabled` en Banca/Vendedor (`app/admin/bancas/[id].tsx`, `app/admin/usuarios/[id].tsx`).
- **Comisiones:** se configuran en la misma pestaña de comisiones (`CommissionTab` / `VentanaCommissionTab`) seleccionando la lotería `"Premiático"`.
- **Reportes y Anulación:** las ventas y anulaciones aparecen nativamente en `/admin/tickets`, `/ventana/tickets`, `/admin/reportes/cuentas` (`bySorteo`), `/admin/reportes/ventas` y `/admin/reportes/comisiones`, mostrando la referencia `PRM-XXXXXXXX` si tiene `PremiaticoTicketLink`.

### 2.4 `Bancas/native-vendedores`

- Filtrar loterías con `isExternalCampaign == true` en `CreateTicketScreen` (tiempos normales) y ocultar el botón de anular en tickets de Premiático.
- Nueva pantalla `Screen.PREMIATICO_SALE` en `MainActivity.kt` (visible si `premiaticoEnabled = true`):
  - Seleccionar campaña activa y combo -> ingresar Nombre + Teléfono WhatsApp (+ Email opcional y toggle de inverso) -> **VENDER** con `idempotencyKey`.
  - Imprimir comprobante ESC/POS (`PrinterManager`) con números asignados, referencia `PRM-XXXXXXXX` y `trackingUrl`/QR para descargar el pase digital, o compartir por WhatsApp (`TicketReceiptImageSharer`).

---

## 3. Ver Detalle Técnico

Para los flujos detallados de contabilidad, recuperación ante fallos, diffs exactos por archivo/línea y el checklist ejecutable, consultar [INTEGRACION_BANCAS_IMPLEMENTACION.md](./INTEGRACION_BANCAS_IMPLEMENTACION.md).
