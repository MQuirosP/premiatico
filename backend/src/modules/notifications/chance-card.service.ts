import sharp from 'sharp';

export interface StampedChanceCard {
  number: string;
  filename: string;
  contentId: string;
  base64: string;
}

export interface PaymentConfirmedEmailInput {
  customerName: string;
  campaignTitle: string;
  publicReference: string;
  confirmedAt: Date;
  passLabel: string;
  totalPasses: number;
  totalChances: number;
  orderLookupUrl: string;
  cards: StampedChanceCard[];
  allNumbers: string[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

  const baseImage = sharp(params.templateBuffer);
  const metadata = await baseImage.metadata();
  const width = metadata.width && metadata.width > 0 ? metadata.width : 1000;
  const height = metadata.height && metadata.height > 0 ? metadata.height : 1000;

  const centerX = Math.round(width * 0.5);
  const centerY = Math.round(height * 0.555);
  const fontSize = Math.max(24, Math.round(width * 0.145));
  const letterSpacing = Math.max(1, Math.round(width * 0.005));

  return Promise.all(
    targetNumbers.map(async (number) => {
      const safeNumber = escapeHtml(number);
      const svgOverlay = Buffer.from(
        `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <text
            x="${centerX}"
            y="${centerY}"
            text-anchor="middle"
            dominant-baseline="central"
            fill="#1e1b4b"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize}"
            font-weight="900"
            letter-spacing="${letterSpacing}"
          >${safeNumber}</text>
        </svg>`,
      );

      const outputBuffer = await sharp(params.templateBuffer)
        .composite([{ input: svgOverlay, top: 0, left: 0 }])
        .resize(360, 360, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();

      return {
        number,
        filename: `chance-${number}.png`,
        contentId: `chance-${number}`,
        base64: outputBuffer.toString('base64'),
      };
    }),
  );
}

export function buildPaymentConfirmedEmailHtml(input: PaymentConfirmedEmailInput): string {
  const formattedDate = input.confirmedAt.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const safeName = escapeHtml(input.customerName);
  const safeCampaign = escapeHtml(input.campaignTitle);
  const safeRef = escapeHtml(input.publicReference);
  const safePassLabel = escapeHtml(input.passLabel);
  const safeUrl = escapeHtml(input.orderLookupUrl);

  const renderRows = <T,>(items: T[], perRow: number, renderCell: (item: T) => string): string => {
    const rows: string[] = [];
    for (let i = 0; i < items.length; i += perRow) {
      const slice = items.slice(i, i + perRow);
      rows.push(`<tr>${slice.map(renderCell).join('')}</tr>`);
    }
    return rows.join('');
  };

  const cardsHtml =
    input.cards.length > 0
      ? renderRows(
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
        )
      : renderRows(
          input.allNumbers,
          4,
          (num) => `
              <td align="center" style="padding: 4px;">
                <span style="display: inline-block; background-color: #1e1b4b; color: #ffffff; font-family: monospace; font-size: 15px; font-weight: 700; padding: 8px 14px; border-radius: 9999px;">
                  ${escapeHtml(num)}
                </span>
              </td>`,
        );

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
          <td align="center" style="background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%); background-color: #6366f1; padding: 26px 24px;">
            <p style="margin: 0 0 6px 0; color: #e0e7ff; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
              PAGO CONFIRMADO
            </p>
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; line-height: 1.25;">
              Tus pases están listos
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; line-height: 1.5;">
              Hola <strong>${safeName}</strong>,
            </p>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155; line-height: 1.5;">
              Confirmamos tu pago. Ya podés descargar los pases digitales de tu compra. Como bonificación, tus chances para la campaña quedaron confirmados.
            </p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1120; border-radius: 14px; margin-bottom: 18px;">
              <tr>
                <td style="padding: 20px;">
                  <p style="margin: 0 0 6px 0; color: #fb923c; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">
                    TU COMPRA
                  </p>
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
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 22px;">
              <tr>
                <td style="padding: 14px 16px; font-size: 13px; color: #334155; line-height: 1.7;">
                  <div><strong>Pedido:</strong> ${safeRef}</div>
                  <div><strong>Fecha:</strong> ${formattedDate}</div>
                  <div><strong>Pases digitales:</strong> ${input.totalPasses}</div>
                  <div><strong>Chances de regalo:</strong> ${input.totalChances}</div>
                </td>
              </tr>
            </table>

            <p style="margin: 0 0 4px 0; color: #4f46e5; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">
              BONIFICACIÓN DEL EVENTO
            </p>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #475569;">
              Además de tus pases, estos son tus chances confirmados para el sorteo:
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
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">Conservá este correo y tus pases digitales.</p>
          </td>
        </tr>
      </table>
    </div>
  `.trim();
}
