# Despliegue y Respaldos Manuales — Premiático MVP 1.0

## 1. Despliegue de Backend (`api.premiatico.com` en Render)

- **Root Directory:** `backend`
- **Build Command:** `npm ci && npx prisma generate && npm run build`
- **Start Command:** `npx prisma migrate deploy && npm run start`
- **Health Check Path:** `/api/v1/health`
- **Variables de entorno obligatorias:** Ver `.env.example` (`DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `CORS_ORIGIN=https://premiatico.com,https://www.premiatico.com`, `R2_*`, `RESEND_API_KEY`, `EMAIL_FROM=notificaciones@premiatico.com`, `TURNSTILE_SECRET_KEY`).

### Migración inicial en Neon PostgreSQL

Tras ejecutar `npx prisma migrate dev --name init` o `prisma migrate deploy`, asegurarse de que el índice único parcial esté aplicado en PostgreSQL:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "Participation_active_number_unique"
ON "Participation" ("campaignId", "number")
WHERE "status" IN ('RESERVED', 'CONFIRMED');
```

## 2. Despliegue de Frontend (`premiatico.com` en Cloudflare Pages)

- **Root Directory:** `frontend`
- **Build Command:** `npm ci && npm run build`
- **Build Output Directory:** `out`
- **Variables de entorno:**
  - `NEXT_PUBLIC_API_URL=https://api.premiatico.com/api/v1`
  - `NEXT_PUBLIC_SITE_URL=https://premiatico.com`
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site-key>`

## 3. Aislamiento de Redis (Render)

Todas las claves generadas por Premiático utilizan estrictamente:

- `premiatico:cache:`
- `premiatico:rate:`
- `premiatico:jobs:`

Nunca ejecutar `FLUSHALL` ni `FLUSHDB` sobre la instancia compartida.

## 4. Procedimiento de Respaldo Manual a Cloudflare R2

1. Exportar respaldo lógico consistente de Neon PostgreSQL:

   ```bash
   pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl -f premiatico-backup-$(date +%Y%m%d-%H%M%S).dump
   ```

2. Generar hash SHA-256 de verificación de integridad:

   ```bash
   sha256sum premiatico-backup-*.dump > premiatico-backup.sha256
   ```

3. Subir ambos archivos al bucket privado de Cloudflare R2 bajo `backups/{campaignId}/` o `backups/full/`.
4. Verificar descarga e integridad periódicamente con `pg_restore --list` y `sha256sum -c`.
