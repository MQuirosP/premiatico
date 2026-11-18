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
  name: string;
  description: string;
  estimatedValue: number | null;
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
  kind?: 'PASS' | 'FICHA';
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

export type CampaignStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type LegalApprovalStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  status: CampaignStatus;
  startAt: string;
  endAt: string;
  drawAt: string | null;
  drawReference: string | null;
  totalFichas: number;
  maxNumberChanges: number;
  enableInverseNumbers: boolean;
  themeColor?: string;
  reservationMinutes: number;
  terms: string;
  coverImageKey: string | null;
  coverImageUrl?: string | null;
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
