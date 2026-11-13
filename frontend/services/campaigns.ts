import { apiRequest } from '@/lib/api';
import type {
  AdminCampaign,
  CampaignPrize,
  DigitalPass,
  PublicCampaign,
} from '@/types/campaign';

export async function listPublicCampaigns(): Promise<PublicCampaign[]> {
  const res = await apiRequest<{ campaigns: PublicCampaign[] }>('/campaigns');
  return res.campaigns;
}

export async function getPublicCampaignBySlug(slug: string): Promise<PublicCampaign> {
  const res = await apiRequest<{ campaign: PublicCampaign }>(`/campaigns/${encodeURIComponent(slug)}`);
  return res.campaign;
}

export async function listAdminCampaigns(): Promise<AdminCampaign[]> {
  const res = await apiRequest<{ campaigns: AdminCampaign[] }>('/admin/campaigns');
  return res.campaigns;
}

export interface CampaignWinnerResult {
  winningNumber: string;
  digits: number;
  evaluatedAt: string;
  notes: string | null;
  winner: {
    orderId: string;
    publicReference: string;
    totalAmount: number;
    confirmedAt: string | null;
    comboNames: string[];
    customer: {
      fullName: string;
      email: string;
      phone: string;
    };
  } | null;
}

export interface AdminCampaignPrize extends CampaignPrize {
  winningOrderId?: string | null;
  winningOrder?: {
    id: string;
    publicReference: string;
    totalAmount: number;
    confirmedAt: string | null;
    customer: {
      fullName: string;
      email: string;
      phone: string;
    };
    items: Array<{ comboNameSnapshot: string }>;
  } | null;
}

export interface PrizeWinnerEvaluationResult {
  prizeId: string;
  prizeName: string;
  drawReference: string | null;
  winningNumber: string;
  digits: number;
  evaluatedAt: string;
  notes: string | null;
  winner: CampaignWinnerResult['winner'];
}

export interface AdminCampaignDetail extends AdminCampaign {
  numberDigits?: number;
  winnerResult?: CampaignWinnerResult | null;
  prizes: AdminCampaignPrize[];
  combos: Array<
    AdminCampaign['combos'][number] & {
      passItems?: Array<{
        id: string;
        quantity: number;
        digitalPass: DigitalPass;
      }>;
    }
  >;
  orders: Array<{
    id: string;
    publicReference: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    customer: { id: string; fullName: string; email: string; phone: string };
    items: Array<{
      comboNameSnapshot: string;
      passQuantitySnapshot: number;
      chanceQuantitySnapshot: number;
    }>;
    participations: Array<{ number: string; status: string }>;
  }>;
}

export async function getAdminCampaignDetail(id: string): Promise<AdminCampaignDetail> {
  const res = await apiRequest<{ campaign: AdminCampaignDetail }>(
    `/admin/campaigns/${encodeURIComponent(id)}`,
  );
  return res.campaign;
}

export async function createAdminCampaign(payload: {
  slug: string;
  title: string;
  description: string;
  category: string;
  startAt: string;
  endAt: string;
  drawAt?: string | null;
  drawReference?: string | null;
  totalChances: number;
  maxNumberChanges: number;
  requiresLegalApproval: boolean;
  legalApprovalStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  legalApprovalReference?: string;
  terms: string;
  coverImageKey?: string | null;
}): Promise<AdminCampaign> {
  const res = await apiRequest<{ campaign: AdminCampaign }>('/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.campaign;
}

export async function updateAdminCampaign(
  id: string,
  payload: {
    legalApprovalStatus?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
    legalApprovalReference?: string | null;
    requiresLegalApproval?: boolean;
    drawAt?: string | null;
    drawReference?: string | null;
    coverImageKey?: string | null;
  },
): Promise<AdminCampaign> {
  const res = await apiRequest<{ campaign: AdminCampaign }>(`/admin/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.campaign;
}

export async function publishAdminCampaign(id: string): Promise<AdminCampaign> {
  const res = await apiRequest<{ campaign: AdminCampaign }>(`/admin/campaigns/${id}/publish`, {
    method: 'POST',
  });
  return res.campaign;
}

export async function pauseAdminCampaign(id: string): Promise<AdminCampaign> {
  const res = await apiRequest<{ campaign: AdminCampaign }>(`/admin/campaigns/${id}/pause`, {
    method: 'POST',
  });
  return res.campaign;
}

export async function closeAdminCampaign(id: string): Promise<AdminCampaign> {
  const res = await apiRequest<{ campaign: AdminCampaign }>(`/admin/campaigns/${id}/close`, {
    method: 'POST',
  });
  return res.campaign;
}

export async function listAdminPasses(): Promise<DigitalPass[]> {
  const res = await apiRequest<{ passes: DigitalPass[] }>('/admin/passes');
  return res.passes;
}

export async function createAdminPass(payload: {
  name: string;
  description: string;
  fileKey: string;
  mimeType: string;
  fileSize: number;
}): Promise<DigitalPass> {
  const res = await apiRequest<{ pass: DigitalPass }>('/admin/passes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.pass;
}

export async function uploadAdminCampaignCover(
  file: File,
): Promise<{ key: string; url: string | null }> {
  const formData = new FormData();
  formData.append('image', file);
  return apiRequest('/admin/campaigns/cover-upload', {
    method: 'POST',
    body: formData,
  });
}

export async function uploadAdminPass(payload: {
  name: string;
  description: string;
  file: File;
}): Promise<DigitalPass> {
  const formData = new FormData();
  formData.append('name', payload.name);
  formData.append('description', payload.description);
  formData.append('file', payload.file);
  const res = await apiRequest<{ pass: DigitalPass }>('/admin/passes/upload', {
    method: 'POST',
    body: formData,
  });
  return res.pass;
}

export async function createAdminCombo(payload: {
  campaignId: string;
  name: string;
  price: number;
  passQuantity: number;
  chanceQuantity: number;
  badgeLabel?: string;
  passItems?: Array<{ digitalPassId: string; quantity: number }>;
}): Promise<unknown> {
  return apiRequest('/admin/combos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminCampaign(id: string): Promise<{ deleted: boolean }> {
  return apiRequest(`/admin/campaigns/${id}`, { method: 'DELETE' });
}

export async function deleteAdminCombo(
  id: string,
): Promise<{ deleted: boolean; deactivated: boolean }> {
  return apiRequest(`/admin/combos/${id}`, { method: 'DELETE' });
}

export async function deleteAdminPass(
  id: string,
): Promise<{ deleted: boolean; deactivated: boolean }> {
  return apiRequest(`/admin/passes/${id}`, { method: 'DELETE' });
}

export async function evaluateAdminCampaignWinner(
  id: string,
  payload: { winningNumber: string; notes?: string },
): Promise<CampaignWinnerResult> {
  const res = await apiRequest<{ winnerResult: CampaignWinnerResult }>(
    `/admin/campaigns/${encodeURIComponent(id)}/evaluate-winner`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.winnerResult;
}

export async function createAdminPrizes(payload: {
  campaignId: string;
  name: string;
  description: string;
  estimatedValue?: number | null;
  drawAt?: string | null;
  drawReference?: string | null;
  quantity?: number;
}): Promise<AdminCampaignPrize[]> {
  const res = await apiRequest<{ prizes: AdminCampaignPrize[] }>('/admin/prizes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.prizes;
}

export async function deleteAdminPrize(id: string): Promise<{ deleted: boolean }> {
  return apiRequest(`/admin/prizes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function evaluateAdminPrizeWinner(
  prizeId: string,
  payload: { winningNumber: string; notes?: string; allowDuplicateOrder?: boolean },
): Promise<PrizeWinnerEvaluationResult> {
  const res = await apiRequest<{ result: PrizeWinnerEvaluationResult }>(
    `/admin/prizes/${encodeURIComponent(prizeId)}/evaluate-winner`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.result;
}
