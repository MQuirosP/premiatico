export interface CampaignProgress {
  totalChances: number;
  confirmedChances: number;
  reservedChances: number;
  availableChances: number;
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
}

export interface DigitalPass {
  id: string;
  name: string;
  description: string;
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
  chanceQuantity: number;
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
  totalChances: number;
  maxNumberChanges: number;
  reservationMinutes: number;
  terms: string;
  coverImageKey: string | null;
  prizes: CampaignPrize[];
  combos: CampaignCombo[];
  progress: CampaignProgress;
}

export interface AdminCampaign extends PublicCampaign {
  requiresLegalApproval: boolean;
  legalApprovalStatus: LegalApprovalStatus;
  legalApprovalReference: string | null;
  _count?: {
    prizes: number;
    combos: number;
    orders: number;
  };
}
