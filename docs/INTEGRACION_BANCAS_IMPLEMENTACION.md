# Anexo Técnico: Plan Concreto de Implementación y Diffs (`Premiático × Bancas`)

> **Documento base:** [INTEGRACION_BANCAS.md](./INTEGRACION_BANCAS.md)  
> **Estrategia:** Modelar Premiático en `Bancas` como una **`Loteria` exclusiva** (`rulesJson.isExternalCampaign = true`) con un `Sorteo` asociado por campaña/día y una tabla puente mínima `PremiaticoTicketLink`.

---

## 1. Análisis Profundo de Flujos (Contabilidad, Crédito, Anulaciones y Fallos)

### 1.1 Flujo de Venta y Contabilidad (`POST /api/v1/premiatico/sales`)

1. **Validación previa en `Bancas/backend`:**
   - Verifica JWT (`protect`), rol permitido (`VENDEDOR` o superior) y `premiaticoEnabled = true` en Banca/Usuario.
   - Verifica idempotencia por `idempotencyKey`: si ya existe un `Ticket` con ese `idempotencyKey`, devuelve la respuesta guardada inmediatamente (`200`).
   - Resuelve la `Loteria` exclusiva `"Premiático"` (`rulesJson.isExternalCampaign = true`) y obtiene/crea el `Sorteo` abierto correspondiente a la campaña (`campaignId` o fecha del día).
   - Calcula la comisión esperada usando `CommissionService` + `TicketCommissionCalculator` (`loteriaId = premiaticoLoteria.id`, `finalMultiplierX = 0`) con la política configurada por el admin (`User -> Ventana -> Banca`).
   - Reserva el crédito neto (`totalAmount - vendorCommission`) en `VendorCreditService.validateAndReserve`. Si excede `creditLimit` con `creditBlockMode = true`, rechaza con `409 CREDIT_LIMIT_EXCEEDED` **antes** de tocar Premiático.
2. **Confirmación remota en `premiatico/backend` (`POST /api/v1/partner/orders`):**
   - `Bancas/backend` envía `idempotencyKey`, `campaignId`, `comboId`, `quantity`, `includeInverse`, `customer` y `externalContext`.
   - `premiatico/backend` bloquea `Campaign` (`FOR UPDATE`), asigna los números con `Participation_active_number_unique`, crea `Order (CONFIRMED)` + `Payment (APPROVED, PARTNER_POS)` y devuelve `orderId`, `publicReference`, `trackingUrl` y `numbers[]`.
   - **Si Premiático falla (`4xx`/`5xx`/timeout previo a confirmar):** `Bancas/backend` ejecuta `VendorCreditService.compensateReservation` y devuelve error limpio al POS.
   - **Si hay timeout después de que Premiático confirmó:** cuando el vendedor reintente con el mismo `clientRequestId` (`idempotencyKey`), `premiatico/backend` detecta el `idempotencyKey` repetido y retorna **exactamente la misma orden ya confirmada** sin duplicar números ni cobro; `Bancas/backend` completa entonces la creación del `Ticket`.
3. **Persistencia local nativa en `Bancas/backend`:**
   - En una transacción Prisma crea:
     - `Ticket` (con `loteriaId` de Premiático, `sorteoId`, `totalAmount`, `totalCommission = vendorCommission`, `totalListeroCommission = listeroCommission`, `idempotencyKey`, `clienteNombre = customer.fullName`, `businessDate`).
     - `Jugada[]` (una fila por cada número asignado de 2–5 dígitos; la primera lleva `amount = totalAmount`, `commissionAmount = vendorCommission`, `listeroCommissionAmount = listeroCommission`, y las demás `amount = 0` para que `SUM(jugada.amount) === ticket.totalAmount`, todas con `finalMultiplierX = 0` y `multiplierId = null`).
     - `PremiaticoTicketLink` (`ticketId`, `premiaticoOrderId`, `publicReference`, `trackingUrl`, `campaignId`, `comboId`).
   - Ejecuta `AccountStatementSyncService.syncDayStatement` (o queda inmediatamente disponible para el sync incremental).

### 1.2 Cómo se refleja en `AccountStatement`, `bySorteo`, `evaluated-summary` y `ResumenCierreDiario`

Al ser un `Ticket` + `Jugada` real de `Bancas`:

- **`AccountStatement` y `fn_sync_sorteo_statements`:** suman `Ticket.totalAmount`, `Jugada.commissionAmount` y `Jugada.listeroCommissionAmount` automáticamente. Al evaluar o revertir otros sorteos de Tiempos, `fn_sync_sorteo_statements` **no borra ni pisa** las ventas de Premiático.
- **`bySorteo` (`AccountsService.getBySorteo`):** `getSorteoBreakdownBatch` incluye el `Sorteo` de Premiático (`"Premiático · <Campaña>"`) automáticamente y `intercalateSorteosAndMovements` lo intercala en orden cronológico con cobros/pagos.
- **`evaluated-summary` (`summaryOnly=true` y `summaryOnly=false`):** tanto `evaluatedSummaryFastPath` (`AccountStatement`) como `fn_get_evaluated_summaries_batch` + `ResumenCierreDiario` (`CierreRollupService`) leen `Ticket`/`Sorteo` nativamente.
- **Cuidado crítico — Topes y Exposición de Tiempos (`RestrictionRule` y `DailyNumberSales`):**
  - La creación de ventas Premiático **omite** `TicketRiskValidator` (los números los asigna Premiático, no el tope de tiempos).
  - En `DailyNumberSalesService`, excluir `loteria.rulesJson->>'isExternalCampaign' = 'true'` si no se desea mezclar números de rifa de 5 dígitos en la matriz de exposición de tiempos de 2 dígitos.
- **Cuidado crítico — Premios (`totalPayout = 0`):**
  - El `Sorteo` de Premiático **nunca** se evalúa con número ganador que pague premios en efectivo en `Bancas` (si se cierra, pasa a `CLOSED` o se cierra con `totalPayout = 0`), porque los premios los entrega Premiático directamente.

### 1.3 Flujo de Comisiones Administrables

- El administrador entra en `bancas-admin-app` -> `CommissionTab` (por Vendedor) o `VentanaCommissionTab` (por Ventana) o política de `Banca`.
- Selecciona la lotería `"Premiático"` y define el porcentaje (ej. `10%` vendedor, `5%` listero) sin rango de multiplicador (`multiplierRange: null`, `betType: null`).
- `TicketCommissionCalculator.calculate` (`TicketCommissionCalculator.ts:23–80`) resuelve automáticamente la cascada `User -> Ventana -> Banca` pasando `finalMultiplierX: 0`.

### 1.4 Flujo de Anulación (`ADMIN` / `BANCA` / `VENTANA` únicamente)

1. En `native-vendedores`: el rol `VENDEDOR` **no ve** botón de anulación en tickets cuyo `loteria.isExternalCampaign == true`.
2. En `bancas-admin-app`: `ADMIN`, `BANCA` o `VENTANA` pulsan **Anular** en el listado de tickets (o vista Premiático), lo que llama a `PATCH /api/v1/tickets/:id/cancel`.
3. En `TicketOperationsService.cancel` (`ticket-operations.service.ts:126–170`):
   - Detecta si existe `PremiaticoTicketLink` para `ticketId`.
   - Si existe:
     1. Verifica rol del solicitante: si es `VENDEDOR`, lanza `403 FORBIDDEN`.
     2. Llama primero a `POST premiatico/api/v1/partner/orders/:publicReference/cancel` en `premiatico/backend`.
     3. Si Premiático responde error (ej. `409` porque la campaña ya cerró/evaluó), aborta y no anula en `Bancas`.
     4. Si Premiático responde `200`, continúa con `TicketRepository.cancel(id, userId, bancaId)`, liberando crédito en `VendorCreditService` y actualizando `AccountStatement`.

---

## 2. Repo 1: `premiatico/backend`

### 2.1 `backend/prisma/schema.prisma`

- **L46–48 (`PaymentMethod`)**: agregar `PARTNER_POS` y enum `OrderChannel`.

```diff
 enum PaymentMethod {
   SINPE_MOVIL
+  PARTNER_POS
 }
+
+enum OrderChannel {
+  WEB
+  PARTNER
+}
```

- **L188–200 (`Customer`)**: hacer `email` opcional.

```diff
 model Customer {
   id        String   @id @default(cuid())
   fullName  String
-  email     String
+  email     String?
   phone     String
```

- **L223–250 (`Order`)** *(nota: `reservationSessionId` ya es `String? @unique` en L229)*:

```diff
 model Order {
   id                        String       @id @default(cuid())
   publicReference           String       @unique
   accessTokenHash           String
   customerId                String
   campaignId                String
   reservationSessionId      String?      @unique
+  channel                   OrderChannel @default(WEB)
+  partnerCode               String?
+  idempotencyKey            String?      @unique
+  externalBancaId           String?
+  externalVentanaId         String?
+  externalSellerId          String?
+  externalSellerName        String?
   status                    OrderStatus  @default(PENDING_PAYMENT)
```

### 2.2 `backend/src/core/env.ts` (L4–29)

```diff
   RESEND_API_KEY: z.string().optional(),
+  PARTNER_API_KEYS: z.string().optional(), // JSON: {"BANCAS":"<secret>"}
+  PUBLIC_WEB_URL: z.string().url().optional(),
```

### 2.3 `backend/src/middlewares/authPartner.ts` *(archivo nuevo)*

- Middleware `requirePartnerAuth`: lee `X-Partner-Id` y `X-Partner-Key`, valida contra `env.PARTNER_API_KEYS` con `crypto.timingSafeEqual` e inyecta `req.partnerCode`.

### 2.4 `backend/src/modules/chances/chances.service.ts` (L98–106)

Permitir asignación directa a una `Order` (`CONFIRMED`) sin `reservationSessionId`:

```diff
 export async function allocateRandomNumbers(params: {
   tx: Prisma.TransactionClient;
   campaignId: string;
   totalChances: number;
   quantity: number;
-  reservationSessionId: string;
-  reservedUntil: Date;
+  reservationSessionId?: string;
+  orderId?: string;
+  status?: 'RESERVED' | 'CONFIRMED';
+  reservedUntil?: Date | null;
+  confirmedAt?: Date | null;
   excludeNumbers?: Set<string>;
 }): Promise<string[]>
```

### 2.5 `backend/src/modules/notifications/chance-card.service.ts` (L444, L558–570)

```diff
-  customer: { fullName: string; email: string };
+  customer: { fullName: string; email: string | null };
```

En `sendRichOrderEmail` (antes de L558):

```diff
+  if (!order.customer.email) return;
   await sendOrderNotification({
```

### 2.6 `backend/src/modules/partner/partner.module.ts` *(archivo nuevo)* y `backend/src/api/index.ts` (L50–52)

- `GET /api/v1/partner/campaigns`: campañas `ACTIVE` con combos activos, `totalChances`, `digits` (`getCampaignNumberDigits(totalChances)`, de 2 a 5 dígitos), `enableInverseNumbers`, `remainingChances`.
- `POST /api/v1/partner/orders`: idempotente por `idempotencyKey`; bloquea `Campaign` (`FOR UPDATE`), asigna números (y el inverso si `includeInverse`), crea/asocia `Customer` por `phone`, crea `Order(CONFIRMED)`, `OrderItem`, `Payment(APPROVED, PARTNER_POS)` y retorna `orderId`, `publicReference`, `accessToken`, `trackingUrl`, `numbers`.
- `POST /api/v1/partner/orders/:publicReference/cancel`: valida `channel === 'PARTNER'`, `partnerCode` y `Campaign.status === 'ACTIVE'`; pasa `Order.status = 'CANCELLED'`, libera `Participation.status = 'RELEASED'` y registra `AuditLog`.
- Montaje en `backend/src/api/index.ts` (después de L50):

```diff
+apiRouter.use(
+  '/partner',
+  rateLimit({ keyPrefix: 'partner', windowSeconds: 60, maxRequests: 120 }),
+  requirePartnerAuth,
+  partnerRouter,
+);
```

---

## 3. Repo 2: `Bancas/backend` (**Cero Migraciones Prisma**)

### 3.1 Reutilización del esquema actual (`prisma/schema.prisma`, **sin cambios ni migraciones**)

Todo se almacena en columnas que **ya existen** en `Bancas/backend/prisma/schema.prisma`:

- **Habilitación por Banca:** existencia de una `Loteria` activa para esa `bancaId` con `rulesJson.isExternalCampaign === true`.
- **Habilitación por Vendedor:** `User.settings` (`Json?`, L111) -> `settings.premiaticoEnabled` (`boolean`).
- **Enlace Ticket <-> Orden de Premiático:** en `model Ticket` (L207–260):
  - `idempotencyKey` (`String? @unique`, L237): mismo `idempotencyKey` enviado a Premiático.
  - `paymentMethod` (`String?`, L228): `"PREMIATICO_POS"`.
  - `paymentNotes` (`String?`, L229): `publicReference` (`"PRM-XXXXXXXX"`).
  - `paymentHistory` (`Json?`, L230):

    ```json
    {
      "premiatico": {
        "orderId": "cm...",
        "publicReference": "PRM-AB12CD34",
        "trackingUrl": "https://premiatico.../pedido?ref=...",
        "campaignId": "cm...",
        "campaignTitle": "...",
        "comboId": "cm...",
        "comboName": "2 Pases",
        "digits": 5,
        "numbers": ["04215", "19384"]
      }
    }
    ```

    *(Al ser `totalPayout = 0`, los tickets de Premiático nunca usan `TicketPayment`, por lo que `paymentMethod`, `paymentNotes` y `paymentHistory` quedan libres).*

### 3.2 `src/config/env.schema.ts` (L81–84)

```diff
   OPS_ALLOWED_IPS: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
+  PREMIATICO_API_URL: z.string().url().optional(),
+  PREMIATICO_PARTNER_ID: z.string().default('BANCAS'),
+  PREMIATICO_PARTNER_KEY: z.string().optional(),
 })
```

### 3.3 `src/domain/user/auth.service.ts` (L496–514) y `src/api/v1/controllers/auth.controller.ts` (L86–113, L215–247)

Exponer `premiaticoEnabled` en `login` y `GET /api/v1/auth/me`, resuelto verificando si la `bancaId` tiene una `Loteria` activa con `rulesJson.isExternalCampaign === true` y `user.settings?.premiaticoEnabled !== false`.

### 3.4 Blindaje del flujo normal de `POST /tickets` y `PATCH /tickets/:id/cancel`

- En `TicketCreationService.create`: validar que si la lotería tiene `rulesJson.isExternalCampaign === true`, se rechace creación directa por `/tickets` (`400 USE_PREMIATICO_ENDPOINT`) para impedir tickets sin respaldo en Premiático.
- En `TicketOperationsService.cancel` (`src/domain/ticket/ops/ticket-operations.service.ts` L126–170):
  - Recibir `userRole` en el método y verificar si `existing.paymentMethod === 'PREMIATICO_POS'` (leyendo `publicReference` desde `existing.paymentNotes` o `existing.paymentHistory?.premiatico?.publicReference`):
    1. Si `userRole === Role.VENDEDOR` -> `403 FORBIDDEN`.
    2. Llamar `PremiaticoPartnerClient.cancelOrder(publicReference)` antes de `TicketRepository.cancel` (L170).
    3. Omitir el check de `cutoff` por minutos de tiempos (Premiático valida si la campaña sigue `ACTIVE`).

### 3.5 `src/api/v1/routes/index.ts` (L66–69) + módulo `/api/v1/premiatico`

```diff
 router.use("/credit", creditRoutes);
+router.use("/premiatico", premiaticoRoutes);
 router.use("/", commissionRoutes);
```

Endpoints de `premiaticoRoutes` (protegidos con `protect`):

1. `GET /api/v1/premiatico/campaigns`: proxy con caché 30–60s (`CacheService`) hacia Premiático.
2. `POST /api/v1/premiatico/sales`: ejecuta el flujo transaccional de la sección 1.1 (crédito -> Premiático -> `Ticket` + `Jugada`s con `paymentMethod = 'PREMIATICO_POS'`, `paymentNotes` y `paymentHistory`).
3. `GET /api/v1/premiatico/tickets` (o incluir `premiaticoLink` en `GET /api/v1/tickets`): para listar/reimprimir/ver `publicReference` y `trackingUrl`.
4. `PUT /api/v1/premiatico/config/banca/:bancaId` (`ADMIN` / `BANCA`) y `PUT /api/v1/premiatico/config/user/:userId` (`ADMIN` / `BANCA` / `VENTANA`): guardan `premiaticoEnabled`.

---

## 4. Repo 3: `Bancas/bancas-admin-app`

### 4.1 Lotería exclusiva y Comisiones (cero UI nueva de porcentajes)

- Crear la `Loteria` **"Premiático"** desde `/admin/loterias/nueva` (marcada con `isExternalCampaign: true` en `rulesJson`, dígitos `5`).
- Para configurar `%` de comisión por Banca, Ventana o Vendedor, el administrador usa **exactamente las pantallas existentes**:
  - `app/admin/usuarios/[id].tsx` -> `CommissionTab` (L180–192)
  - `app/admin/ventanas/VentanaCommissionTab.tsx`

### 4.2 Switches de habilitación Premiático

- `app/admin/bancas/[id].tsx` (L99–121): envolver `<BancaForm />` en `<Tabs />` con pestaña `Premiático` (`premiaticoEnabled`).
- `app/admin/usuarios/[id].tsx` (L180–209): agregar pestaña `Premiático` para `VENDEDOR` (`premiaticoEnabled` del vendedor).

### 4.3 Tickets, Anulaciones y Reportes

- En `app/admin/tickets`, `app/ventana/tickets` y `app/admin/reportes/cuentas/index.tsx` (`AccountStatementList` L781): todas las ventas y comisiones ya aparecen automáticamente bajo la lotería `"Premiático"`. Solo mostrar badge `PRM-XXXXXXXX` cuando el ticket tenga `paymentMethod === 'PREMIATICO_POS'` (leyendo `paymentNotes` / `paymentHistory.premiatico`).
- El botón existente **Anular** en `admin` y `ventana` dispara `PATCH /api/v1/tickets/:id/cancel`, que propaga la anulación a Premiático.

---

## 5. Repo 4: `Bancas/native-vendedores` (rama `main`)

### 5.1 `app/src/main/java/com/bancas/admin/network/IdempotencyInterceptor.kt` (L14)

```diff
-    val isTicketCreation = request.method == "POST" && request.url.encodedPath.endsWith("/tickets")
+    val isTicketCreation = request.method == "POST" && (
+        request.url.encodedPath.endsWith("/tickets") ||
+        request.url.encodedPath.endsWith("/premiatico/sales")
+    )
```

### 5.2 `app/src/main/java/com/bancas/admin/network/ApiClient.kt` (L26–175)

Agregar en `AuthService`:

- `@GET("premiatico/campaigns") suspend fun getPremiaticoCampaigns(): ApiResponse<List<PremiaticoCampaign>>`
- `@POST("premiatico/sales") suspend fun createPremiaticoSale(@Body request: CreatePremiaticoSaleRequest): ApiResponse<Ticket>` *(con `@SerialName("idempotencyKey") val clientRequestId: String`)*

### 5.3 `app/src/main/java/com/bancas/admin/MainActivity.kt` (rama `main`)

- **L70 (`enum class Screen`)**: agregar `PREMIATICO_SALE`.
- **L678–683 (`drawerItems` / `DrawerItem`) y L719–732 (`NavigationDrawerItem`)**: agregar `DrawerItem(Screen.PREMIATICO_SALE, "Campañas / Premiático", ...)` visible cuando `premiaticoEnabled == true`.
- **L405–600 (`when (currentScreen)`)**: agregar rama `Screen.PREMIATICO_SALE` -> `PremiaticoScreen`.

### 5.4 Ocultar lotería externa en Tiempos y bloquear anulación POS

- En `CreateTicketViewModel` / `CreateTicketScreen`: filtrar loterías donde `isExternalCampaign == true`.
- En `TicketsScreen` / `TicketDetailScreen`: ocultar el botón **Anular** si `ticket.paymentMethod == "PREMIATICO_POS"`.
- En `features/premiatico/` + `TicketFormatter.kt` + `TicketReceiptImageSharer.kt`: flujo rápido de 3 pasos (campaña/combo mostrando `"Chances de X dígitos"` según `digits` -> nombre + WhatsApp + inverso opcional -> **VENDER**), impresión térmica conservando los ceros a la izquierda de cada número (`2` a `5` dígitos) + `publicReference` + `trackingUrl`, y compartir imagen PNG + link por WhatsApp.

---

## 6. Checklist de Implementación y Verificación

### Fase 1: `premiatico/backend`

- [x] Actualizar `prisma/schema.prisma` (`Customer.email` nullable, `OrderChannel`, `PaymentMethod.PARTNER_POS`, campos partner + `idempotencyKey` en `Order`) y aplicar migración.
- [x] Agregar `PARTNER_API_KEYS` (reutilizando `FRONTEND_URL`) en `src/core/env.ts`.
- [x] Crear middleware `requirePartnerAuth` (`X-Partner-Id` / `X-Partner-Key` con `timingSafeEqual`).
- [x] Adaptar `allocateRandomNumbers` en `src/modules/chances/chances.service.ts` para asignación directa a `Order` (`CONFIRMED`).
- [x] Proteger `sendRichOrderEmail` en `src/modules/notifications/chance-card.service.ts` cuando `customer.email` sea `null`.
- [x] Implementar `GET /api/v1/partner/campaigns`, `POST /api/v1/partner/orders` y `POST /api/v1/partner/orders/:publicReference/cancel` y montarlos en `src/api/index.ts`.
- [ ] Probar idempotencia (doble `POST` con mismo `idempotencyKey`), concurrencia y cancelación.

### Fase 2: `Bancas/backend` (**sin migración Prisma**)

- [x] Agregar `PREMIATICO_API_URL`, `PREMIATICO_PARTNER_ID`, `PREMIATICO_PARTNER_KEY` en `src/config/env.schema.ts`.
- [x] Exponer `premiaticoEnabled` en `AuthService.login` y `AuthController.me` (lotería activa con `rulesJson.isExternalCampaign === true` + `user.settings.premiaticoEnabled`).
- [x] Crear helper de resolución de la `Loteria` `"Premiático"` (`rulesJson.isExternalCampaign = true`) y obtención/creación del `Sorteo` asociado a la campaña.
- [x] Implementar `/api/v1/premiatico` (`campaigns`, `sales`, `config/banca/:bancaId`, `config/user/:userId`) integrando `VendorCreditService` y `TicketCommissionCalculator`, guardando `Jugada.number` con sus ceros a la izquierda (`2`–`5` dígitos) y la metadata en `Ticket.paymentMethod = 'PREMIATICO_POS'`, `Ticket.paymentNotes` y `Ticket.paymentHistory`.
- [x] Excluir la lotería `isExternalCampaign = true` en `DailyNumberSalesService` para no mezclar números de 4–5 dígitos en la exposición de tiempos.
- [x] Actualizar `TicketCreationService.create` (bloquear venta directa en `/tickets` para lotería externa) y `TicketOperationsService.cancel` (rechazar `VENDEDOR` con `403`, cancelar en Premiático antes de cancelar localmente).
- [ ] Verificar que `AccountStatement`, `bySorteo`, `evaluated-summary` y `ResumenCierreDiario` reflejan el ticket y su comisión automáticamente sin tocar PL/pgSQL.

### Fase 3: `Bancas/bancas-admin-app`

- [ ] Crear la lotería `"Premiático"` y configurar reglas de comisión en `CommissionTab` / `VentanaCommissionTab`.
- [ ] Agregar switches `premiaticoEnabled` en `app/admin/bancas/[id].tsx` y `app/admin/usuarios/[id].tsx`.
- [ ] Mostrar referencia `PRM-XXXXXXXX` en detalle/listado de tickets cuando `paymentMethod === 'PREMIATICO_POS'` y verificar anulación desde roles `ADMIN` / `BANCA` / `VENTANA`.

### Fase 4: `Bancas/native-vendedores` (rama `main`)

- [ ] Ampliar `IdempotencyInterceptor.kt` (L14) para cubrir `POST .../premiatico/sales`.
- [ ] Agregar DTOs y endpoints Premiático en `ApiClient.kt` (`AuthService`).
- [ ] Filtrar loterías con `isExternalCampaign == true` en `CreateTicketScreen` y ocultar anulación en tickets con `paymentMethod == "PREMIATICO_POS"`.
- [ ] Implementar `Screen.PREMIATICO_SALE` en `MainActivity.kt` (L70, L405–600, L678–683), impresión ESC/POS (`TicketFormatter.kt`) y compartir por WhatsApp (`TicketReceiptImageSharer.kt`).
- [ ] Probar flujo E2E en terminal física: venta -> impresión -> WhatsApp -> verificación en `AccountStatement` / `bySorteo` / `evaluated-summary` -> anulación por `VENTANA`/`ADMIN` -> liberación de números en Premiático.
