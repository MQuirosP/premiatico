import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generateStampedFichaCards } from '../src/modules/notifications/ficha-card.service.js';

describe('Ficha card stamping', () => {
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
    expect(cards[0]?.filename).toBe('ficha-01216.png');
    expect(cards[0]?.contentId).toBe('ficha-01216');
    expect(cards[0]?.base64.length).toBeGreaterThan(100);
  });
});
