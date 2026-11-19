import sharp from 'sharp';
import { z } from 'zod';
import { env } from '../../core/env.js';
import { logger } from '../../core/logger.js';
import { generateStampedPassImage } from '../notifications/ficha-card.service.js';

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Debe ser un color hexadecimal #RRGGBB');

export const themeSpecSchema = z.object({
  nameSuggested: z.string().trim().min(2).max(80),
  descriptionSuggested: z.string().trim().min(5).max(240),
  bgGradientStart: hexColorSchema,
  bgGradientEnd: hexColorSchema,
  ringColor: hexColorSchema,
  accentColor: hexColorSchema,
  capsuleBg: hexColorSchema,
  capsuleTextColor: hexColorSchema,
  fieldBg: hexColorSchema,
  fieldBorder: hexColorSchema,
  brandColor: hexColorSchema,
  sloganColor: hexColorSchema,
  pattern: z.enum(['hexagons', 'stars', 'waves', 'confetti', 'stripes', 'sparkles']),
  patternColor: hexColorSchema,
});

export type StickerThemeSpec = z.infer<typeof themeSpecSchema>;

export interface GenerateStickerInput {
  tipo: 'PASS' | 'FICHA' | 'BOTH';
  tematica: string;
  colores?: string;
  estilo?: string;
  eslogan?: string;
}

export interface GeneratedStickerVariant {
  kind: 'PASS' | 'FICHA';
  label: string;
  base64: string;
  stampedPreviewBase64: string;
  mimeType: 'image/png';
  fileSize: number;
}

export interface GenerateStickerPreviewResult {
  nameSuggested: string;
  descriptionSuggested: string;
  usedAi: boolean;
  themeSpec: StickerThemeSpec;
  variants: GeneratedStickerVariant[];
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getRelativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function sanitizeThemeSpec(spec: StickerThemeSpec): StickerThemeSpec {
  // El campo numérico grande debe tener siempre fondo claro para alto contraste con el estampado oscuro.
  const fieldLum = getRelativeLuminance(spec.fieldBg);
  const safeFieldBg = fieldLum < 0.72 ? '#FFFFFF' : spec.fieldBg;

  // Asegurar contraste entre cápsula y su texto
  const capLum = getRelativeLuminance(spec.capsuleBg);
  const textLum = getRelativeLuminance(spec.capsuleTextColor);
  const safeCapsuleText =
    Math.abs(capLum - textLum) < 0.35 ? (capLum > 0.5 ? '#0F172A' : '#FFFFFF') : spec.capsuleTextColor;

  return {
    ...spec,
    fieldBg: safeFieldBg,
    capsuleTextColor: safeCapsuleText,
  };
}

function buildFallbackThemeSpec(tematica: string, colores?: string): StickerThemeSpec {
  const text = `${tematica} ${colores ?? ''}`.toLowerCase();

  if (text.includes('fútbol') || text.includes('futbol') || text.includes('selección') || text.includes('seleccion') || text.includes('mundial')) {
    return {
      nameSuggested: 'Selección Tricolor',
      descriptionSuggested: `Diseño temático de ${tematica} en tonos rojo, azul marino y acentos dorados.`,
      bgGradientStart: '#B91C1C',
      bgGradientEnd: '#1E3A8A',
      ringColor: '#FACC15',
      accentColor: '#FDE047',
      capsuleBg: '#1E3A8A',
      capsuleTextColor: '#FFFFFF',
      fieldBg: '#FFFFFF',
      fieldBorder: '#1E3A8A',
      brandColor: '#FFFFFF',
      sloganColor: '#FEF08A',
      pattern: 'hexagons',
      patternColor: '#FFFFFF',
    };
  }

  if (text.includes('navidad') || text.includes('fin de año') || text.includes('diciembre')) {
    return {
      nameSuggested: 'Navidad Dorada',
      descriptionSuggested: `Diseño festivo de ${tematica} en rojo navideño, verde pino y dorado.`,
      bgGradientStart: '#991B1B',
      bgGradientEnd: '#14532D',
      ringColor: '#FBBF24',
      accentColor: '#FDE68A',
      capsuleBg: '#7F1D1D',
      capsuleTextColor: '#FEF3C7',
      fieldBg: '#FFFBEB',
      fieldBorder: '#B45309',
      brandColor: '#FFFFFF',
      sloganColor: '#FDE68A',
      pattern: 'stars',
      patternColor: '#FDE68A',
    };
  }

  if (text.includes('verano') || text.includes('playa') || text.includes('tropical')) {
    return {
      nameSuggested: 'Verano Tropical',
      descriptionSuggested: `Diseño fresco de ${tematica} en azul turquesa, sol y arena.`,
      bgGradientStart: '#0284C7',
      bgGradientEnd: '#0F766E',
      ringColor: '#FDE047',
      accentColor: '#FEF08A',
      capsuleBg: '#0369A1',
      capsuleTextColor: '#FFFFFF',
      fieldBg: '#FFFFFF',
      fieldBorder: '#0284C7',
      brandColor: '#FFFFFF',
      sloganColor: '#FEF08A',
      pattern: 'waves',
      patternColor: '#BAE6FD',
    };
  }

  if (text.includes('neón') || text.includes('neon') || text.includes('noche') || text.includes('fiesta')) {
    return {
      nameSuggested: 'Fiesta Neón',
      descriptionSuggested: `Diseño nocturno vibrante de ${tematica} en morado, cian y fucsia.`,
      bgGradientStart: '#3B0764',
      bgGradientEnd: '#0F172A',
      ringColor: '#22D3EE',
      accentColor: '#E879F9',
      capsuleBg: '#6B21A8',
      capsuleTextColor: '#F0ABFC',
      fieldBg: '#F8FAFC',
      fieldBorder: '#06B6D4',
      brandColor: '#FFFFFF',
      sloganColor: '#67E8F9',
      pattern: 'sparkles',
      patternColor: '#22D3EE',
    };
  }

  return {
    nameSuggested: `Edición ${tematica.slice(0, 32)}`,
    descriptionSuggested: `Diseño promocional Premiático inspirado en ${tematica}.`,
    bgGradientStart: '#1D4ED8',
    bgGradientEnd: '#1E1B4B',
    ringColor: '#FACC15',
    accentColor: '#FDE047',
    capsuleBg: '#1E40AF',
    capsuleTextColor: '#FFFFFF',
    fieldBg: '#FFFFFF',
    fieldBorder: '#1D4ED8',
    brandColor: '#FFFFFF',
    sloganColor: '#FEF08A',
    pattern: 'confetti',
    patternColor: '#93C5FD',
  };
}

async function generateThemeSpecWithGemini(input: GenerateStickerInput): Promise<{
  themeSpec: StickerThemeSpec;
  usedAi: boolean;
}> {
  if (!env.GEMINI_API_KEY) {
    return { themeSpec: buildFallbackThemeSpec(input.tematica, input.colores), usedAi: false };
  }

  const prompt = `Sos director de arte para Premiático (plataforma de promociones en Costa Rica).
Generá un JSON estricto con la paleta de colores y patrón decorativo para un sticker circular de 1024x1024.

Parámetros del administrador:
- Temática: ${input.tematica}
- Colores solicitados: ${input.colores?.trim() || 'Automática según temática'}
- Estilo visual: ${input.estilo?.trim() || 'Moderno, vibrante, limpio y promocional'}

Reglas obligatorias:
1. Todos los colores deben estar en formato hexadecimal exacto #RRGGBB.
2. bgGradientStart y bgGradientEnd deben formar un fondo atractivo y con buen contraste respecto a brandColor y sloganColor.
3. fieldBg DEBE ser muy claro (#FFFFFF o un pastel muy claro con luminancia > 0.80) porque encima el backend estampará números oscuros.
4. capsuleTextColor debe tener alto contraste contra capsuleBg.
5. pattern debe ser exactamente uno de: hexagons, stars, waves, confetti, stripes, sparkles.
6. nameSuggested en español (máximo 45 caracteres), sin incluir la palabra "Pase" ni "Ficha".

Devolvé únicamente un objeto JSON válido con estas claves exactas:
{
  "nameSuggested": string,
  "descriptionSuggested": string,
  "bgGradientStart": "#RRGGBB",
  "bgGradientEnd": "#RRGGBB",
  "ringColor": "#RRGGBB",
  "accentColor": "#RRGGBB",
  "capsuleBg": "#RRGGBB",
  "capsuleTextColor": "#RRGGBB",
  "fieldBg": "#RRGGBB",
  "fieldBorder": "#RRGGBB",
  "brandColor": "#RRGGBB",
  "sloganColor": "#RRGGBB",
  "pattern": "hexagons" | "stars" | "waves" | "confetti" | "stripes" | "sparkles",
  "patternColor": "#RRGGBB"
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn({ status: response.status, errText }, 'Gemini theme spec request failed, using fallback');
      return { themeSpec: buildFallbackThemeSpec(input.tematica, input.colores), usedAi: false };
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return { themeSpec: buildFallbackThemeSpec(input.tematica, input.colores), usedAi: false };
    }

    const parsedJson = JSON.parse(rawText);
    const validated = themeSpecSchema.safeParse(parsedJson);
    if (!validated.success) {
      logger.warn({ issues: validated.error.issues }, 'Gemini JSON failed schema validation, using fallback');
      return { themeSpec: buildFallbackThemeSpec(input.tematica, input.colores), usedAi: false };
    }

    return { themeSpec: sanitizeThemeSpec(validated.data), usedAi: true };
  } catch (err) {
    logger.warn({ err }, 'Gemini theme spec error, using fallback');
    return { themeSpec: buildFallbackThemeSpec(input.tematica, input.colores), usedAi: false };
  }
}

function buildPatternDef(pattern: StickerThemeSpec['pattern'], color: string): string {
  switch (pattern) {
    case 'hexagons':
      return `<pattern id="bg-pattern" width="84" height="72" patternUnits="userSpaceOnUse">
        <polygon points="42,4 78,22 78,50 42,68 6,50 6,22" fill="none" stroke="${color}" stroke-width="2.5" stroke-opacity="0.14"/>
      </pattern>`;
    case 'stars':
      return `<pattern id="bg-pattern" width="90" height="90" patternUnits="userSpaceOnUse">
        <path d="M45 14 L51 32 L70 32 L55 43 L60 61 L45 50 L30 61 L35 43 L20 32 L39 32 Z" fill="${color}" fill-opacity="0.13"/>
        <circle cx="12" cy="14" r="3" fill="${color}" fill-opacity="0.16"/>
      </pattern>`;
    case 'waves':
      return `<pattern id="bg-pattern" width="120" height="48" patternUnits="userSpaceOnUse">
        <path d="M0 24 Q 30 4, 60 24 T 120 24" fill="none" stroke="${color}" stroke-width="3.5" stroke-opacity="0.15"/>
      </pattern>`;
    case 'stripes':
      return `<pattern id="bg-pattern" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="16" height="44" fill="${color}" fill-opacity="0.10"/>
      </pattern>`;
    case 'sparkles':
      return `<pattern id="bg-pattern" width="88" height="88" patternUnits="userSpaceOnUse">
        <path d="M44 14 Q44 44 74 44 Q44 44 44 74 Q44 44 14 44 Q44 44 44 14 Z" fill="${color}" fill-opacity="0.14"/>
        <circle cx="18" cy="18" r="2.5" fill="${color}" fill-opacity="0.18"/>
      </pattern>`;
    case 'confetti':
    default:
      return `<pattern id="bg-pattern" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect x="14" y="18" width="12" height="6" rx="3" transform="rotate(25 20 21)" fill="${color}" fill-opacity="0.16"/>
        <circle cx="72" cy="28" r="5" fill="${color}" fill-opacity="0.14"/>
        <rect x="60" y="70" width="14" height="6" rx="3" transform="rotate(-30 67 73)" fill="${color}" fill-opacity="0.16"/>
        <circle cx="26" cy="76" r="3.5" fill="${color}" fill-opacity="0.14"/>
      </pattern>`;
  }
}

function wrapSloganLines(slogan: string): string[] {
  const clean = slogan.trim() || '¡Participá por grandes premios!';
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= 18) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

/**
 * Plantilla SVG maestra 1024x1024 basada en la geometría de template.png
 * y alineada al píxel con ficha-card.service.ts (campo numérico centrado en y = 568 / 55.5%).
 */
function buildMasterStickerSvg(params: {
  spec: StickerThemeSpec;
  capsuleText: 'Tu Pase' | 'Tu Ficha';
  slogan: string;
}): string {
  const { spec, capsuleText, slogan } = params;
  const sloganLines = wrapSloganLines(slogan);
  const lineHeight = sloganLines.length >= 3 ? 33 : 38;
  const startY = sloganLines.length >= 3 ? 802 : sloganLines.length === 2 ? 820 : 842;
  const sloganFontSize = sloganLines.length >= 3 ? 30 : 34;

  const sloganSvg = sloganLines
    .map(
      (line, idx) =>
        `<text x="498" y="${startY + idx * lineHeight}" font-family="'DejaVu Sans', 'Liberation Sans', 'Segoe UI', Arial, sans-serif" font-size="${sloganFontSize}" font-weight="800" font-style="italic" fill="${spec.sloganColor}" text-anchor="start">${escapeXml(line)}</text>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <clipPath id="circle-clip">
      <circle cx="512" cy="512" r="494" />
    </clipPath>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${spec.bgGradientStart}" />
      <stop offset="100%" stop-color="${spec.bgGradientEnd}" />
    </linearGradient>
    ${buildPatternDef(spec.pattern, spec.patternColor)}
  </defs>

  <!-- Fondo circular + patrón temático -->
  <g clip-path="url(#circle-clip)">
    <rect width="1024" height="1024" fill="url(#bg-grad)" />
    <rect width="1024" height="1024" fill="url(#bg-pattern)" />
    <!-- Brillo superior suave -->
    <ellipse cx="512" cy="180" rx="440" ry="200" fill="#FFFFFF" fill-opacity="0.07" />
  </g>

  <!-- Doble aro circular exterior -->
  <circle cx="512" cy="512" r="492" fill="none" stroke="${spec.ringColor}" stroke-width="18" />
  <circle cx="512" cy="512" r="466" fill="none" stroke="${spec.accentColor}" stroke-width="6" stroke-opacity="0.85" />

  <!-- Icono superior de ticket con estrella y destellos -->
  <g transform="translate(512, 126) rotate(-14)">
    <rect x="-52" y="-28" width="104" height="56" rx="10" fill="none" stroke="${spec.accentColor}" stroke-width="7" />
    <circle cx="-52" cy="0" r="9" fill="${spec.bgGradientStart}" stroke="${spec.accentColor}" stroke-width="5" />
    <circle cx="52" cy="0" r="9" fill="${spec.bgGradientStart}" stroke="${spec.accentColor}" stroke-width="5" />
    <path d="M0,-15 L4,-4 L16,-4 L6,3 L10,14 L0,7 L-10,14 L-6,3 L-16,-4 L-4,-4 Z" fill="${spec.accentColor}" />
  </g>
  <g stroke="${spec.accentColor}" stroke-width="7" stroke-linecap="round">
    <line x1="398" y1="106" x2="424" y2="138" />
    <line x1="378" y1="142" x2="412" y2="156" />
    <line x1="626" y1="106" x2="600" y2="138" />
    <line x1="646" y1="142" x2="612" y2="156" />
  </g>

  <!-- Marca Premiático en posición superior -->
  <text x="512" y="266" font-family="'DejaVu Sans', 'Liberation Sans', 'Segoe UI', Arial, sans-serif" font-size="96" font-weight="900" font-style="italic" fill="${spec.brandColor}" text-anchor="middle" letter-spacing="-1.5">Premiático</text>
  <path d="M352 292 Q512 272 672 292" fill="none" stroke="${spec.accentColor}" stroke-width="8" stroke-linecap="round" />

  <!-- Destellos laterales de la cápsula -->
  <g stroke="${spec.accentColor}" stroke-width="7" stroke-linecap="round">
    <line x1="186" y1="336" x2="220" y2="352" />
    <line x1="168" y1="370" x2="206" y2="372" />
    <line x1="838" y1="336" x2="804" y2="352" />
    <line x1="856" y1="370" x2="818" y2="372" />
  </g>

  <!-- Rectángulo grande reservado para numeración (centerY = 568 = 55.5%) -->
  <rect x="64" y="418" width="896" height="300" rx="68" fill="${spec.fieldBg}" stroke="${spec.fieldBorder}" stroke-width="10" />
  <rect x="78" y="432" width="868" height="272" rx="56" fill="none" stroke="${spec.ringColor}" stroke-width="5" stroke-opacity="0.7" />

  <!-- Cápsula central pequeña (Tu Pase / Tu Ficha) -->
  <rect x="262" y="314" width="500" height="106" rx="53" fill="${spec.capsuleBg}" stroke="${spec.accentColor}" stroke-width="7" />
  <text x="512" y="383" font-family="'DejaVu Sans', 'Liberation Sans', 'Segoe UI', Arial, sans-serif" font-size="48" font-weight="900" fill="${spec.capsuleTextColor}" text-anchor="middle">${escapeXml(capsuleText)}</text>

  <!-- Arco inferior divisor -->
  <path d="M138 776 Q512 692 886 776" fill="none" stroke="${spec.accentColor}" stroke-width="7" stroke-linecap="round" />

  <!-- Icono de regalo inferior izquierdo -->
  <g transform="translate(332, 836) rotate(-14)" stroke="${spec.accentColor}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <rect x="-42" y="-12" width="84" height="58" rx="8" />
    <rect x="-48" y="-28" width="96" height="18" rx="6" />
    <line x1="0" y1="-28" x2="0" y2="46" />
    <path d="M0,-28 C-26,-52 -42,-28 -10,-28" />
    <path d="M0,-28 C26,-52 42,-28 10,-28" />
  </g>

  <!-- Separador vertical -->
  <line x1="466" y1="774" x2="454" y2="896" stroke="${spec.accentColor}" stroke-width="6" stroke-linecap="round" />

  <!-- Eslogan inferior -->
  ${sloganSvg}
  <path d="M482 894 Q588 880 694 892" fill="none" stroke="${spec.accentColor}" stroke-width="7" stroke-linecap="round" />
</svg>`;
}

export async function generateStickerPreview(
  input: GenerateStickerInput,
): Promise<GenerateStickerPreviewResult> {
  const { themeSpec, usedAi } = await generateThemeSpecWithGemini(input);
  const slogan = input.eslogan?.trim() || '¡Participá por grandes premios!';

  const kindsToBuild: Array<'PASS' | 'FICHA'> =
    input.tipo === 'BOTH' ? ['PASS', 'FICHA'] : [input.tipo];

  const variants: GeneratedStickerVariant[] = await Promise.all(
    kindsToBuild.map(async (kind) => {
      const capsuleText = kind === 'PASS' ? 'Tu Pase' : 'Tu Ficha';
      const svg = buildMasterStickerSvg({ spec: themeSpec, capsuleText, slogan });
      const pngBuffer = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

      const stampedPreviewBuffer = await generateStampedPassImage({
        templateBuffer: pngBuffer,
        text: kind === 'FICHA' ? '12345' : 'PRM-A1B2',
        resizeTo: 420,
      });

      return {
        kind,
        label: capsuleText,
        base64: pngBuffer.toString('base64'),
        stampedPreviewBase64: stampedPreviewBuffer.toString('base64'),
        mimeType: 'image/png',
        fileSize: pngBuffer.length,
      };
    }),
  );

  return {
    nameSuggested: themeSpec.nameSuggested,
    descriptionSuggested: themeSpec.descriptionSuggested,
    usedAi,
    themeSpec,
    variants,
  };
}
