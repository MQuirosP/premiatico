# Estrategia de Concurrencia y Motor de Chances — Premiático

## 1. Principios de Integridad

- **Fuente única de verdad:** PostgreSQL (Neon). Redis nunca se utiliza como fuente definitiva de disponibilidad o asignación de chances.
- **Formato de números:** Cadenas de 5 caracteres (`"00000"` a `"99999"`).
- **Conjunto elegible (`totalChances < 100,000`):** Todo el universo `00000`–`99999` es elegible hasta que la suma de participaciones activas (`RESERVED + CONFIRMED`) alcance `campaign.totalChances`.

## 2. Garantía Definitiva en Base de Datos

En la migración SQL de PostgreSQL se define un **índice único parcial** sobre `Participation`:

```sql
CREATE UNIQUE INDEX "Participation_active_number_unique"
ON "Participation" ("campaignId", "number")
WHERE "status" IN ('RESERVED', 'CONFIRMED');
```

Esto garantiza físicamente que dos compradores concurrentes jamás puedan reservar ni confirmar el mismo número en la misma campaña, mientras permite conservar el historial de participaciones `RELEASED`.

## 3. Política de Expiración y Protección de Revisión

1. **Sesión inicial (`ReservationSession`):** `15 minutos` (`campaign.reservationMinutes`). Si vence sin convertirse en pedido, sus participaciones pasan a `RELEASED`.
2. **Pedido pendiente de pago (`Order.status = PENDING_PAYMENT`):** `60 minutos` (`campaign.paymentWindowMinutes`). Si vence sin adjuntar comprobante SINPE, pasa a `EXPIRED` y sus participaciones pasan a `RELEASED`.
3. **Pedido en revisión (`Order.status = UNDER_REVIEW`):** Al adjuntar comprobante válido, `Participation.reservedUntil` se limpia (`NULL`) y el pedido **nunca expira automáticamente**. Queda protegido hasta aprobación (`CONFIRMED`) o rechazo terminal (`REJECTED`), con un SLA de revisión administrativa de `24 horas` (`campaign.reviewSlaHours`).

## 4. Algoritmo de Asignación y Regeneración Atómica

1. Dentro de una transacción PostgreSQL (`prisma.$transaction`):
   - Liberar reservas vencidas de la campaña (`ReservationSession` expiradas y `Order` `PENDING_PAYMENT` vencidos).
   - Bloquear la fila de `Campaign` (`SELECT ... FOR UPDATE`) o validar estado `ACTIVE` y ventana de fechas.
   - Contar participaciones activas (`RESERVED` + `CONFIRMED`) y verificar `activas + solicitadas <= campaign.totalChances`.
   - Generar candidatos aleatorios de 5 dígitos que no estén en el conjunto activo y ejecutar `INSERT ... ON CONFLICT DO NOTHING RETURNING`, con reintentos acotados (hasta 5 rondas) hasta completar `chanceQuantity`.
2. En **regeneración** (`maxNumberChanges = 5` por defecto):
   - `SELECT ... FOR UPDATE` sobre `ReservationSession`.
   - Verificar `status = 'ACTIVE'`, `expiresAt > now()` y `regenerationCount < campaign.maxNumberChanges`.
   - Marcar las participaciones actuales de la sesión como `RELEASED`.
   - Asignar el nuevo lote de números y aumentar `regenerationCount` en la base de datos.
