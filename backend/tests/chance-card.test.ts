import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generateStampedChanceCards } from '../src/modules/notifications/chance-card.service.js';

describe('Chance card stamping', () => {
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

    const cards = await generateStampedChanceCards({
      templateBuffer,
      numbers: ['01216', '58186'],
    });

    expect(cards).toHaveLength(2);
    expect(cards[0]?.filename).toBe('chance-01216.png');
    expect(cards[0]?.contentId).toBe('chance-01216');
    expect(cards[0]?.base64.length).toBeGreaterThan(100);
  });
});
