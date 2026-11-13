import sharp from 'sharp';
import { env } from '../../core/env.js';
import { logger } from '../../core/logger.js';
import { prisma } from '../../core/prisma.js';
import { getObjectBuffer } from '../storage/storage.service.js';
import { sendOrderNotification } from './notifications.service.js';

export interface StampedChanceCard {
  number: string;
  filename: string;
  contentId: string;
  base64: string;
}

export interface OrderEmailCommonInput {
  customerName: string;
  campaignTitle: string;
  publicReference: string;
  eventDate: Date;
  totalAmount?: number;
  passLabel: string;
  totalPasses: number;
  totalChances: number;
  orderLookupUrl: string;
  cards: StampedChanceCard[];
  allNumbers: string[];
}

export type PaymentConfirmedEmailInput = OrderEmailCommonInput;
export type ProofReceivedEmailInput = OrderEmailCommonInput;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Pure SVG vector glyph paths on a 60x100 cell (no OS/fontconfig dependency).
 */
const VECTOR_GLYPHS: Record<string, string> = {
  '0': 'M15,10 H45 A10,10 0 0 1 55,20 V80 A10,10 0 0 1 45,90 H15 A10,10 0 0 1 5,80 V20 A10,10 0 0 1 15,10 Z M12,82 L48,18',
  '1': 'M16,24 L34,10 V90 M14,90 H50',
  '2': 'M8,24 A18,16 0 0 1 52,24 C52,44 8,62 8,90 H52',
  '3': 'M10,20 A18,15 0 0 1 50,24 C50,40 34,48 24,48 C38,48 52,58 52,74 A18,16 0 0 1 10,80',
  '4': 'M42,90 V10 L8,62 H54',
  '5': 'M50,10 H12 L10,46 C18,40 48,40 52,66 A18,18 0 0 1 10,82',
  '6': 'M48,16 A18,14 0 0 0 10,28 V72 A18,18 0 0 0 50,72 A18,16 0 0 0 10,64',
  '7': 'M8,10 H52 L22,90',
  '8': 'M30,48 A17,18 0 1 1 30.1,48 Z M30,48 A19,20 0 1 0 30.1,48 Z',
  '9': 'M50,36 A18,16 0 1 1 10,36 A18,16 0 0 1 50,36 V74 A18,16 0 0 1 12,84',
  A: 'M8,90 L30,10 L52,90 M16,64 H44',
  B: 'M10,10 H36 A14,18 0 0 1 36,48 H10 Z M10,48 H38 A15,20 0 0 1 38,90 H10 Z',
  C: 'M50,22 A20,18 0 0 0 10,30 V70 A20,18 0 0 0 50,78',
  D: 'M10,10 H32 A20,24 0 0 1 52,34 V66 A20,24 0 0 1 32,90 H10 Z',
  E: 'M50,10 H10 V90 H50 M10,50 H42',
  F: 'M50,10 H10 V90 M10,50 H42',
  G: 'M50,22 A20,18 0 0 0 10,30 V70 A20,18 0 0 0 50,78 V52 H32',
  H: 'M10,10 V90 M50,10 V90 M10,50 H50',
  I: 'M16,10 H44 M30,10 V90 M16,90 H44',
  J: 'M46,10 V70 A18,18 0 0 1 10,72',
  K: 'M10,10 V90 M50,10 L14,50 L50,90',
  L: 'M10,10 V90 H50',
  M: 'M8,90 V10 L30,54 L52,10 V90',
  N: 'M10,90 V10 L50,90 V10',
  O: 'M15,10 H45 A10,10 0 0 1 55,20 V80 A10,10 0 0 1 45,90 H15 A10,10 0 0 1 5,80 V20 A10,10 0 0 1 15,10 Z',
  P: 'M10,90 V10 H38 A14,18 0 0 1 38,50 H10',
  Q: 'M15,10 H45 A10,10 0 0 1 55,20 V74 A10,10 0 0 1 45,84 H15 A10,10 0 0 1 5,74 V20 A10,10 0 0 1 15,10 Z M36,68 L54,92',
  R: 'M10,90 V10 H38 A14,18 0 0 1 38,50 H10 M34,50 L52,90',
  S: 'M48,22 A18,14 0 0 0 12,24 C12,44 50,48 50,70 A18,16 0 0 1 10,78',
  T: 'M6,10 H54 M30,10 V90',
  U: 'M10,10 V70 A20,20 0 0 0 50,70 V10',
  V: 'M8,10 L30,90 L52,10',
  W: 'M6,10 L18,90 L30,44 L42,90 L54,10',
  X: 'M10,10 L50,90 M50,10 L10,90',
  Y: 'M10,10 L30,50 L50,10 M30,50 V90',
  Z: 'M10,10 H50 L10,90 H50',
  '-': 'M14,50 H46',
  ' ': '',
};

function buildVectorTextSvg(params: {
  width: number;
  height: number;
  text: string;
  centerX: number;
  centerY: number;
  maxWidth: number;
  targetCharHeight: number;
  color?: string;
}): Buffer {
  const chars = params.text.toUpperCase().split('');
  const cellW = 60;
  const cellH = 100;
  const gap = 18;
  const totalUnitsW = chars.length * cellW + Math.max(0, chars.length - 1) * gap;

  const scaleByHeight = params.targetCharHeight / cellH;
  const scaleByWidth = totalUnitsW > 0 ? params.maxWidth / totalUnitsW : scaleByHeight;
  const scale = Math.min(scaleByHeight, scaleByWidth);

  const renderedW = totalUnitsW * scale;
  const renderedH = cellH * scale;
  const startX = params.centerX - renderedW / 2;
  const startY = params.centerY - renderedH / 2;
  const color = params.color ?? '#1e1b4b';

  const paths = chars
    .map((ch, idx) => {
      const d = VECTOR_GLYPHS[ch];
      if (!d) return '';
      const xOffset = idx * (cellW + gap);
      return `<path d="${d}" transform="translate(${xOffset}, 0)" />`;
    })
    .filter(Boolean)
    .join('');

  return Buffer.from(
    `<svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${startX.toFixed(2)}, ${startY.toFixed(2)}) scale(${scale.toFixed(4)})" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
        ${paths}
      </g>
    </svg>`,
  );
}

/**
 * Stamps arbitrary alphanumeric text (e.g. a 5-digit number or order reference)
 * centered inside the white pill box of the pass/chance PNG without relying on system fonts.
 */
export async function generateStampedPassImage(params: {
  templateBuffer: Buffer;
  text: string;
  resizeTo?: number;
}): Promise<Buffer> {
  let basePipeline = sharp(params.templateBuffer).rotate();
  if (params.resizeTo) {
    basePipeline = basePipeline.resize(params.resizeTo, params.resizeTo, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const normalized = await basePipeline.png().toBuffer({ resolveWithObject: true });
  const width = normalized.info.width;
  const height = normalized.info.height;

  const svgOverlay = buildVectorTextSvg({
    width,
    height,
    text: params.text,
    centerX: Math.round(width * 0.5),
    centerY: Math.round(height * 0.555),
    maxWidth: Math.round(width * 0.72),
    targetCharHeight: Math.round(height * 0.145),
    color: '#1e1b4b',
  });

  const overlayPng = await sharp(svgOverlay)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  return sharp(normalized.data)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Stamps each lottery number centered inside the white pill box of the pass/chance PNG.
 */
export async function generateStampedChanceCards(params: {
  templateBuffer: Buffer;
  numbers: string[];
  maxCards?: number;
}): Promise<StampedChanceCard[]> {
  const maxCards = params.maxCards ?? 25;
  const targetNumbers = params.numbers.slice(0, maxCards);
  if (targetNumbers.length === 0) return [];

  return Promise.all(
    targetNumbers.map(async (number) => {
      const outputBuffer = await generateStampedPassImage({
        templateBuffer: params.templateBuffer,
        text: number,
        resizeTo: 360,
      });

      return {
        number,
        filename: `chance-${number}.png`,
        contentId: `chance-${number}`,
        base64: outputBuffer.toString('base64'),
      };
    }),
  );
}

function renderOrderCardsGrid(input: OrderEmailCommonInput): string {
  const renderRows = <T,>(items: T[], perRow: number, renderCell: (item: T) => string): string => {
    const rows: string[] = [];
    for (let i = 0; i < items.length; i += perRow) {
      const slice = items.slice(i, i + perRow);
      rows.push(`<tr>${slice.map(renderCell).join('')}</tr>`);
    }
    return rows.join('');
  };

  if (input.cards.length > 0) {
    return renderRows(
      input.cards,
      4,
      (card) => `
        <td align="center" style="padding: 6px;">
          <img
            src="cid:${escapeHtml(card.contentId)}"
            alt="Chance ${escapeHtml(card.number)}"
            width="110"
            height="110"
            style="display: block; width: 110px; height: 110px; border-radius: 9999px; border: 0;"
          />
        </td>`,
    );
  }

  return renderRows(
    input.allNumbers,
    4,
    (num) => `
      <td align="center" style="padding: 4px;">
        <span style="display: inline-block; background-color: #1e1b4b; color: #ffffff; font-family: monospace; font-size: 15px; font-weight: 700; padding: 8px 14px; border-radius: 9999px;">
          ${escapeHtml(num)}
        </span>
      </td>`,
  );
}

function renderOrderEmailShell(params: {
  input: OrderEmailCommonInput;
  bannerBg: string;
  bannerLabelColor: string;
  bannerBadge: string;
  bannerTitle: string;
  introParagraph: string;
  purchaseCardBody: string;
  extraNoticesHtml?: string;
  summaryTotalRow?: string;
  chancesIntro: string;
  footerNote: string;
}): string {
  const { input } = params;
  const formattedDate = input.eventDate.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const safeName = escapeHtml(input.customerName);
  const safeCampaign = escapeHtml(input.campaignTitle);
  const safeRef = escapeHtml(input.publicReference);
  const cardsHtml = renderOrderCardsGrid(input);

  const remainingCount = input.allNumbers.length - input.cards.length;
  const attachmentNote =
    input.cards.length > 0
      ? remainingCount > 0
        ? `Adjuntamos ${input.cards.length} imágenes de tus chances de regalo. Podés ver los ${input.allNumbers.length} números completos en tu pedido.`
        : `Adjuntamos ${input.cards.length} ${input.cards.length === 1 ? 'imagen' : 'imágenes'} de tus chances de regalo.`
      : '';

  return `
    <div style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: Arial, Helvetica, sans-serif; color: #0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tr>
          <td align="center" style="background-color: #090d16; padding: 18px 24px;">
            <span style="color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: 1px;">PREMIÁTICO</span>
          </td>
        </tr>
        <tr>
          <td align="center" style="background: ${params.bannerBg}; padding: 26px 24px;">
            <p style="margin: 0 0 6px 0; color: ${params.bannerLabelColor}; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
              ${escapeHtml(params.bannerBadge)}
            </p>
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; line-height: 1.25;">
              ${escapeHtml(params.bannerTitle)}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; line-height: 1.5;">
              Hola <strong>${safeName}</strong>,
            </p>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155; line-height: 1.5;">
              ${params.introParagraph}
            </p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1120; border-radius: 14px; margin-bottom: 18px;">
              <tr>
                <td style="padding: 20px;">
                  <p style="margin: 0 0 6px 0; color: #fb923c; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">
                    TU COMPRA
                  </p>
                  ${params.purchaseCardBody}
                </td>
              </tr>
            </table>

            ${params.extraNoticesHtml ?? ''}

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 22px;">
              <tr>
                <td style="padding: 14px 16px; font-size: 13px; color: #334155; line-height: 1.7;">
                  <div><strong>Pedido:</strong> ${safeRef}</div>
                  <div><strong>Fecha:</strong> ${formattedDate}</div>
                  ${params.summaryTotalRow ?? ''}
                  <div><strong>Pases digitales:</strong> ${input.totalPasses}</div>
                  <div><strong>Chances de regalo:</strong> ${input.totalChances}</div>
                </td>
              </tr>
            </table>

            <p style="margin: 0 0 4px 0; color: #4f46e5; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">
              BONIFICACIÓN DEL EVENTO
            </p>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #475569;">
              ${escapeHtml(params.chancesIntro)}
            </p>
            <p style="margin: 0 0 12px 0; color: #4f46e5; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
              ${safeCampaign}
            </p>

            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px auto;">
              ${cardsHtml}
            </table>

            ${
              attachmentNote
                ? `<p style="margin: 0; font-size: 12px; color: #64748b;">${escapeHtml(attachmentNote)}</p>`
                : ''
            }
          </td>
        </tr>
        <tr>
          <td align="center" style="border-top: 1px solid #e2e8f0; padding: 16px 24px; background-color: #f8fafc;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #475569;">Premiático Costa Rica</p>
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">${escapeHtml(params.footerNote)}</p>
          </td>
        </tr>
      </table>
    </div>
  `.trim();
}

export function buildPaymentConfirmedEmailHtml(input: PaymentConfirmedEmailInput): string {
  const safePassLabel = escapeHtml(input.passLabel);
  const safeUrl = escapeHtml(input.orderLookupUrl);

  return renderOrderEmailShell({
    input,
    bannerBg: '#6366f1',
    bannerLabelColor: '#e0e7ff',
    bannerBadge: 'PAGO CONFIRMADO',
    bannerTitle: 'Tus pases están listos',
    introParagraph:
      'Confirmamos tu pago. Ya podés descargar los pases digitales de tu compra. Como bonificación, tus chances para la campaña quedaron confirmados.',
    purchaseCardBody: `
      <p style="margin: 0 0 4px 0; color: #ffffff; font-size: 18px; font-weight: 800;">
        Tu compra incluye ${input.totalPasses === 1 ? 'tu pase digital' : `${input.totalPasses} pases digitales`}
      </p>
      <p style="margin: 0 0 16px 0; color: #cbd5e1; font-size: 13px;">
        ${safePassLabel}
      </p>
      <a
        href="${safeUrl}"
        target="_blank"
        rel="noopener noreferrer"
        style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 11px 18px; border-radius: 8px;"
      >
        ${input.totalPasses === 1 ? 'Descargar pase' : 'Descargar pases'}
      </a>
    `,
    chancesIntro: 'Además de tus pases, estos son tus chances confirmados para el sorteo:',
    footerNote: 'Conservá este correo y tus pases digitales.',
  });
}

export function buildProofReceivedEmailHtml(input: ProofReceivedEmailInput): string {
  const safePassLabel = escapeHtml(input.passLabel);
  const formattedTotal =
    typeof input.totalAmount === 'number'
      ? `<div><strong>Total:</strong> ₡${input.totalAmount.toLocaleString('es-CR')}</div>`
      : '';

  return renderOrderEmailShell({
    input,
    bannerBg: '#f59e0b',
    bannerLabelColor: '#fef3c7',
    bannerBadge: 'COMPRA RECIBIDA',
    bannerTitle: 'Recibimos tu compra',
    introParagraph:
      'Recibimos tu compra de pases digitales y el comprobante de pago. Lo estamos validando. Como bonificación, tus chances para el sorteo quedaron reservados.',
    purchaseCardBody: `
      <p style="margin: 0 0 4px 0; color: #ffffff; font-size: 18px; font-weight: 800;">
        Tu compra incluye ${input.totalPasses === 1 ? 'tu pase digital' : `${input.totalPasses} pases digitales`}
      </p>
      <p style="margin: 0 0 10px 0; color: #cbd5e1; font-size: 13px;">
        ${safePassLabel}
      </p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
        El enlace para descargar tu pase estará disponible en el correo que te llega cuando se confirme el pago.
      </p>
    `,
    extraNoticesHtml: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; margin-bottom: 12px;">
        <tr>
          <td style="padding: 12px 14px; font-size: 12px; color: #92400e; line-height: 1.55;">
            <strong>Importante:</strong> Cuando confirmemos el pago te enviaremos otro correo. Ahí estará el enlace para descargar tu pase, junto con tus chances de regalo confirmados.
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; margin-bottom: 16px;">
        <tr>
          <td style="padding: 12px 14px; font-size: 12px; color: #075985; line-height: 1.55;">
            <strong>Tiempo de validación:</strong> La comprobación de tu pago puede tardar entre 24 y 48 horas. Revisamos todos los comprobantes uno a uno — gracias por tu paciencia.
          </td>
        </tr>
      </table>
    `,
    summaryTotalRow: formattedTotal,
    chancesIntro: 'Además de tus pases, reservamos estos chances para el sorteo:',
    footerNote: 'Gracias por tu compra. Conservá este correo mientras validamos tu pago.',
  });
}

export interface RichOrderEmailOrder {
  id: string;
  publicReference: string;
  totalAmount?: number;
  customer: { fullName: string; email: string };
  campaign: { title: string };
  items?: Array<{
    passQuantitySnapshot: number;
    quantity: number;
    passesSnapshotJson: unknown;
  }>;
  participations?: Array<{ number: string }>;
}

export async function sendRichOrderEmail(params: {
  order: RichOrderEmailOrder;
  type: 'PROOF_RECEIVED' | 'PAYMENT_CONFIRMED';
  eventDate: Date;
}): Promise<void> {
  const { order, type, eventDate } = params;
  const allNumbers = (order.participations ?? []).map((p) => p.number);
  const orderItems = order.items ?? [];

  const passSnapshots = orderItems.flatMap((item) =>
    Array.isArray(item.passesSnapshotJson)
      ? (item.passesSnapshotJson as Array<{
          digitalPassId?: string;
          name?: string;
          fileKey?: string;
          mimeType?: string;
        }>)
      : [],
  );

  const digitalPassIds = [
    ...new Set(
      passSnapshots.map((p) => p.digitalPassId).filter((id): id is string => Boolean(id)),
    ),
  ];

  const dbPasses =
    digitalPassIds.length > 0 && typeof prisma.digitalPass?.findMany === 'function'
      ? await prisma.digitalPass.findMany({
          where: { id: { in: digitalPassIds } },
          select: { id: true, name: true, fileKey: true, mimeType: true },
        })
      : [];

  const passLabel =
    dbPasses.map((p) => p.name).join(', ') ||
    passSnapshots
      .map((p) => p.name)
      .filter((name): name is string => Boolean(name))
      .join(', ') ||
    'tu pase digital';
  const totalPasses = orderItems.reduce(
    (sum, item) => sum + item.passQuantitySnapshot * item.quantity,
    0,
  );

  const imagePass =
    dbPasses.find((p) => p.mimeType.startsWith('image/')) ??
    passSnapshots.find(
      (p) =>
        p.fileKey &&
        (p.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(p.fileKey)),
    );

  let cards: StampedChanceCard[] = [];
  if (env.RESEND_API_KEY && imagePass?.fileKey && allNumbers.length > 0) {
    try {
      const templateBuffer = await getObjectBuffer(imagePass.fileKey);
      cards = await generateStampedChanceCards({
        templateBuffer,
        numbers: allNumbers,
        maxCards: 25,
      });
    } catch (error) {
      logger.warn(
        { err: error, orderId: order.id, fileKey: imagePass.fileKey },
        'Could not generate stamped chance images from R2 template; using text badges fallback',
      );
    }
  }

  const backendBaseUrl =
    env.BACKEND_URL?.replace(/\/+$/, '') ||
    (env.NODE_ENV === 'production'
      ? 'https://premiatico-a6bg.onrender.com'
      : `http://localhost:${env.PORT}`);
  const passDownloadUrl = `${backendBaseUrl}/api/v1/orders/${encodeURIComponent(
    order.publicReference,
  )}/stamped-pass`;

  const emailInput: OrderEmailCommonInput = {
    customerName: order.customer.fullName,
    campaignTitle: order.campaign.title,
    publicReference: order.publicReference,
    eventDate,
    totalAmount: order.totalAmount,
    passLabel,
    totalPasses,
    totalChances: allNumbers.length,
    orderLookupUrl: passDownloadUrl,
    cards,
    allNumbers,
  };

  const subject =
    type === 'PAYMENT_CONFIRMED'
      ? `Tus pases están listos — Pedido ${order.publicReference}`
      : `Recibimos tu compra — Pedido ${order.publicReference}`;

  const html =
    type === 'PAYMENT_CONFIRMED'
      ? buildPaymentConfirmedEmailHtml(emailInput)
      : buildProofReceivedEmailHtml(emailInput);

  await sendOrderNotification({
    orderId: order.id,
    type,
    recipientEmail: order.customer.email,
    subject,
    html,
    attachments: cards.map((card) => ({
      filename: card.filename,
      content: card.base64,
      content_id: card.contentId,
    })),
  });
}
