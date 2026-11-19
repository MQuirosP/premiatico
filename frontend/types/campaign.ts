import type {
  CampaignDrawMode,
  CampaignStatus,
  DigitalPassKind,
  LegalApprovalStatus,
  OrderChannel,
  PrizeAmountScope,
  PrizeCategory,
  PrizeDrawWeightMode,
} from '@/lib/domain-constants';

export type {
  CampaignDrawMode,
  CampaignStatus,
  DigitalPassKind,
  LegalApprovalStatus,
  OrderChannel,
  PrizeAmountScope,
  PrizeCategory,
  PrizeDrawWeightMode,
};

export interface CampaignProgress {
  totalFichas: number;
  confirmedFichas: number;
  reservedFichas: number;
  availableFichas: number;
  soldPercentage: number;
}

export interface CampaignPrize {
  id: string;
  campaignId: string;
  prizeType?: PrizeCategory;
  name: string;
  description: string;
  estimatedValue: number | null;
  minOrderAmount?: number | null;
  amountScope?: PrizeAmountScope;
  minTickets?: number | null;
  purchaseFrom?: string | null;
  purchaseUntil?: string | null;
  requiredComboId?: string | null;
  orderChannel?: OrderChannel | null;
  drawWeightMode?: PrizeDrawWeightMode;
  imageKey: string | null;
  position: number;
  drawAt?: string | null;
  drawReference?: string | null;
  winningNumber?: string | null;
  winnerEvaluatedAt?: string | null;
  winnerNotes?: string | null;
}

export interface DigitalPass {
  id: string;
  name: string;
  description: string;
  kind?: DigitalPassKind;
  fileKey: string;
  mimeType: string;
  fileSize: number;
  isActive: boolean;
}

export interface CampaignCombo {
  id: string;
  campaignId: string;
  name: string;
  description: string | null;
  price: number;
  passQuantity: number;
  fichaQuantity: number;
  badgeLabel: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CampaignGalleryImage {
  id?: string;
  key: string;
  url: string | null;
  isCover: boolean;
  sortOrder?: number;
}

export interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryId?: string | null;
  status: CampaignStatus;
  startAt: string;
  endAt: string;
  drawAt: string | null;
  drawReference: string | null;
  totalFichas: number;
  maxNumberChanges: number;
  enableInverseNumbers: boolean;
  themeColor?: string;
  countdownTitle?: string | null;
  drawMode?: CampaignDrawMode;
  reservationMinutes: number;
  terms: string;
  coverImageKey: string | null;
  coverImageUrl?: string | null;
  galleryImages?: CampaignGalleryImage[];
  prizes: CampaignPrize[];
  combos: CampaignCombo[];
  progress: CampaignProgress;
}

export interface AdminCampaign extends PublicCampaign {
  numberDigits?: number;
  requiresLegalApproval: boolean;
  legalApprovalStatus: LegalApprovalStatus;
  legalApprovalReference: string | null;
  _count?: {
    prizes: number;
    combos: number;
    orders: number;
  };
}
