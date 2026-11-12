# Premiático

**¡Más chances, más emoción!**

Plataforma digital para gestionar campañas promocionales con premios en Costa Rica (CRC), combos de pases digitales, motor de chances de 5 dígitos (`00000`–`99999`), reservas concurrentes, checkout SINPE Móvil y dashboard administrativo.

## Arquitectura

- `frontend/`: Next.js (App Router, exportación estática para Cloudflare Pages), React, TypeScript strict, Tailwind CSS, shadcn/ui, React Hook Form, Zod y TanStack Query.
- `backend/`: Node.js LTS, Express, TypeScript strict, Prisma ORM (Neon PostgreSQL), Redis (aislado con prefijos `premiatico:*`), Cloudflare R2, Resend y Pino.
- `docs/`: Documentación técnica, checklist de fases, estrategia de concurrencia y respaldo manual.

## Reglas de desarrollo

1. TypeScript `strict: true` obligatorio en frontend y backend.
2. Toda la lógica de negocio reside en `backend/` (el frontend es 100% estático).
3. Moneda en CRC representada en enteros (`Int`) o `Decimal`, nunca `Float`.
4. Números de 5 dígitos almacenados como `String` (`00000`–`99999`).
5. Terminología comercial obligatoria: **Pase**, **Chance**, **Chances de regalo**, **Combo**.

## Documentación

- [Checklist de implementación por fases](./docs/CHECKLIST.md)
