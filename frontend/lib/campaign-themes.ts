export type CampaignThemeColor =
  | 'classic'
  | 'ocean'
  | 'emerald'
  | 'crimson'
  | 'violet'
  | 'gold'
  | 'magenta';

export interface CampaignThemeConfig {
  id: CampaignThemeColor;
  label: string;
  description: string;
  countdownCard: string;
  countdownAccentText: string;
  countdownIconColor: string;
  countdownSubText: string;
  countdownBox: string;
  comboBanner: string;
  comboBannerSubtext: string;
  popularBadge: string;
  highlightedCard: string;
  selectedCard: string;
  selectedRadio: string;
  ticketIcon: string;
  ctaButton: string;
  summaryBox: string;
}

export const CAMPAIGN_THEMES: Record<CampaignThemeColor, CampaignThemeConfig> = {
  classic: {
    id: 'classic',
    label: 'Clásico Premiático',
    description: 'Azul noche + Ámbar vibrante',
    countdownCard:
      'border-amber-400/30 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900',
    countdownAccentText: 'text-amber-300',
    countdownIconColor: 'text-amber-400',
    countdownSubText: 'text-blue-100/90',
    countdownBox: 'border-white/10 bg-white/10',
    comboBanner: 'bg-gradient-to-r from-orange-500 via-amber-500 to-amber-400 text-white',
    comboBannerSubtext: 'text-amber-50',
    popularBadge: 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950',
    highlightedCard: 'border-amber-400 bg-amber-50/40 hover:border-amber-500 hover:shadow-md',
    selectedCard: 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/25 shadow-md scale-[1.01]',
    selectedRadio: 'border-blue-600 bg-blue-600 text-white',
    ticketIcon: 'text-blue-600',
    ctaButton:
      'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white',
    summaryBox: 'border-blue-200 bg-blue-50',
  },
  ocean: {
    id: 'ocean',
    label: 'Océano',
    description: 'Azul profundo + Cian brillante',
    countdownCard:
      'border-cyan-400/30 bg-gradient-to-r from-slate-950 via-sky-950 to-cyan-900',
    countdownAccentText: 'text-cyan-300',
    countdownIconColor: 'text-cyan-400',
    countdownSubText: 'text-sky-100/90',
    countdownBox: 'border-cyan-200/15 bg-white/10',
    comboBanner: 'bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-white',
    comboBannerSubtext: 'text-sky-50',
    popularBadge: 'bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950',
    highlightedCard: 'border-sky-400 bg-sky-50/40 hover:border-sky-500 hover:shadow-md',
    selectedCard: 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-600/25 shadow-md scale-[1.01]',
    selectedRadio: 'border-sky-600 bg-sky-600 text-white',
    ticketIcon: 'text-sky-600',
    ctaButton:
      'bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white',
    summaryBox: 'border-sky-200 bg-sky-50',
  },
  emerald: {
    id: 'emerald',
    label: 'Esmeralda',
    description: 'Verde bosque + Menta vivo',
    countdownCard:
      'border-emerald-400/30 bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-900',
    countdownAccentText: 'text-emerald-300',
    countdownIconColor: 'text-emerald-400',
    countdownSubText: 'text-emerald-100/90',
    countdownBox: 'border-emerald-200/15 bg-white/10',
    comboBanner: 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 text-white',
    comboBannerSubtext: 'text-emerald-50',
    popularBadge: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950',
    highlightedCard: 'border-emerald-400 bg-emerald-50/40 hover:border-emerald-500 hover:shadow-md',
    selectedCard:
      'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/25 shadow-md scale-[1.01]',
    selectedRadio: 'border-emerald-600 bg-emerald-600 text-white',
    ticketIcon: 'text-emerald-600',
    ctaButton:
      'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white',
    summaryBox: 'border-emerald-200 bg-emerald-50',
  },
  crimson: {
    id: 'crimson',
    label: 'Carmesí',
    description: 'Rojo vino + Coral intenso',
    countdownCard:
      'border-rose-400/30 bg-gradient-to-r from-slate-950 via-rose-950 to-red-900',
    countdownAccentText: 'text-rose-300',
    countdownIconColor: 'text-rose-400',
    countdownSubText: 'text-rose-100/90',
    countdownBox: 'border-rose-200/15 bg-white/10',
    comboBanner: 'bg-gradient-to-r from-red-600 via-rose-500 to-orange-400 text-white',
    comboBannerSubtext: 'text-rose-50',
    popularBadge: 'bg-gradient-to-r from-rose-500 to-orange-500 text-white',
    highlightedCard: 'border-rose-400 bg-rose-50/40 hover:border-rose-500 hover:shadow-md',
    selectedCard: 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-600/25 shadow-md scale-[1.01]',
    selectedRadio: 'border-rose-600 bg-rose-600 text-white',
    ticketIcon: 'text-rose-600',
    ctaButton:
      'bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white',
    summaryBox: 'border-rose-200 bg-rose-50',
  },
  violet: {
    id: 'violet',
    label: 'Violeta',
    description: 'Índigo oscuro + Fucsia',
    countdownCard:
      'border-violet-400/30 bg-gradient-to-r from-slate-950 via-purple-950 to-violet-900',
    countdownAccentText: 'text-violet-300',
    countdownIconColor: 'text-violet-400',
    countdownSubText: 'text-violet-100/90',
    countdownBox: 'border-violet-200/15 bg-white/10',
    comboBanner: 'bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-400 text-white',
    comboBannerSubtext: 'text-violet-50',
    popularBadge: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white',
    highlightedCard: 'border-violet-400 bg-violet-50/40 hover:border-violet-500 hover:shadow-md',
    selectedCard:
      'border-violet-600 bg-violet-50/70 ring-2 ring-violet-600/25 shadow-md scale-[1.01]',
    selectedRadio: 'border-violet-600 bg-violet-600 text-white',
    ticketIcon: 'text-violet-600',
    ctaButton:
      'bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 text-white',
    summaryBox: 'border-violet-200 bg-violet-50',
  },
  gold: {
    id: 'gold',
    label: 'Dorado VIP',
    description: 'Negro carbón + Oro brillante',
    countdownCard:
      'border-amber-400/40 bg-gradient-to-r from-neutral-950 via-stone-900 to-amber-950',
    countdownAccentText: 'text-amber-300',
    countdownIconColor: 'text-amber-400',
    countdownSubText: 'text-amber-100/90',
    countdownBox: 'border-amber-200/15 bg-white/10',
    comboBanner: 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-400 text-slate-950',
    comboBannerSubtext: 'text-amber-950/80',
    popularBadge: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950',
    highlightedCard: 'border-amber-400 bg-amber-50/50 hover:border-amber-500 hover:shadow-md',
    selectedCard:
      'border-amber-600 bg-amber-50/80 ring-2 ring-amber-600/25 shadow-md scale-[1.01]',
    selectedRadio: 'border-amber-600 bg-amber-600 text-white',
    ticketIcon: 'text-amber-600',
    ctaButton:
      'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-slate-950',
    summaryBox: 'border-amber-200 bg-amber-50',
  },
  magenta: {
    id: 'magenta',
    label: 'Magenta',
    description: 'Ciruela oscuro + Rosa vivo',
    countdownCard:
      'border-pink-400/30 bg-gradient-to-r from-slate-950 via-pink-950 to-rose-900',
    countdownAccentText: 'text-pink-300',
    countdownIconColor: 'text-pink-400',
    countdownSubText: 'text-pink-100/90',
    countdownBox: 'border-pink-200/15 bg-white/10',
    comboBanner: 'bg-gradient-to-r from-pink-600 via-rose-500 to-pink-400 text-white',
    comboBannerSubtext: 'text-pink-50',
    popularBadge: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
    highlightedCard: 'border-pink-400 bg-pink-50/40 hover:border-pink-500 hover:shadow-md',
    selectedCard: 'border-pink-600 bg-pink-50/70 ring-2 ring-pink-600/25 shadow-md scale-[1.01]',
    selectedRadio: 'border-pink-600 bg-pink-600 text-white',
    ticketIcon: 'text-pink-600',
    ctaButton:
      'bg-gradient-to-r from-pink-600 via-rose-500 to-pink-500 hover:from-pink-700 hover:to-rose-600 text-white',
    summaryBox: 'border-pink-200 bg-pink-50',
  },
};

export const CAMPAIGN_THEME_LIST: CampaignThemeConfig[] = Object.values(CAMPAIGN_THEMES);

export function getCampaignTheme(themeColor?: string | null): CampaignThemeConfig {
  if (themeColor && themeColor in CAMPAIGN_THEMES) {
    return CAMPAIGN_THEMES[themeColor as CampaignThemeColor];
  }
  return CAMPAIGN_THEMES.classic;
}
