import { env } from '../../core/env.js';
import { logger } from '../../core/logger.js';
import { prisma } from '../../core/prisma.js';

export type NotificationType =
  | 'ORDER_CREATED'
  | 'PROOF_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_REJECTED';

interface SendEmailParams {
  orderId: string;
  type: NotificationType;
  recipientEmail: string;
  subject: string;
  html: string;
}

export async function sendOrderNotification(params: SendEmailParams): Promise<void> {
  const idempotencyKey = `${params.type}:${params.orderId}`;

  const existing = await prisma.notificationLog.findUnique({
    where: { idempotencyKey },
  });
  if (existing && existing.status === 'SENT') {
    return;
  }

  if (!env.RESEND_API_KEY) {
    logger.info(
      { orderId: params.orderId, type: params.type },
      'RESEND_API_KEY not configured; skipping external email send',
    );
    return;
  }

  let lastError: string | null = null;
  let providerId: string | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [params.recipientEmail],
          subject: params.subject,
          html: params.html,
        }),
      });

      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { id?: string } | null;
        providerId = body?.id ?? null;
        lastError = null;
        break;
      }

      lastError = `HTTP ${response.status}`;
      if (response.status < 500) {
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Network error';
    }
  }

  await prisma.notificationLog
    .upsert({
      where: { idempotencyKey },
      update: {
        status: lastError ? 'FAILED' : 'SENT',
        providerId,
        errorMessage: lastError,
      },
      create: {
        orderId: params.orderId,
        type: params.type,
        idempotencyKey,
        recipientEmail: params.recipientEmail,
        providerId,
        status: lastError ? 'FAILED' : 'SENT',
        errorMessage: lastError,
      },
    })
    .catch((err) => {
      logger.error({ err, idempotencyKey }, 'Failed to persist NotificationLog');
    });
}
