import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  generateStampedFichaCards,
  generateStampedPaseCard,
} from '../src/modules/notifications/ficha-card.service.js';

describe('Ficha and Pase card stamping', () => {
  it('stamps 5-digit numbers onto a PNG buffer using vector SVG paths', async () => {
    const templateBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const cards = await generateStampedFichaCards({
      templateBuffer,
      numbers: ['01216', '58186'],
    });

    expect(cards).toHaveLength(2);
    expect(cards[0]?.filename).toBe('Ficha-01216.png');
    expect(cards[0]?.contentId).toBe('ficha-01216');
    expect(cards[0]?.base64.length).toBeGreaterThan(100);

    const paseCard = await generateStampedPaseCard({
      templateBuffer,
      publicReference: 'PRM-AB12CD34',
    });
    expect(paseCard.filename).toBe('Pase-PRM-AB12CD34.png');
    expect(paseCard.contentId).toBe('pase-PRM-AB12CD34');
    expect(paseCard.base64.length).toBeGreaterThan(100);
  });
});
