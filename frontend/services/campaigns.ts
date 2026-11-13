import { apiRequest } from '@/lib/api';
import type { AdminCampaign, DigitalPass, PublicCampaign } from '@/types/campaign';

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

export async function createAdminCombo(payload: {
  campaignId: string;
  name: string;
  price: number;
  passQuantity: number;
  chanceQuantity: number;
  badgeLabel?: string;
}): Promise<unknown> {
  return apiRequest('/admin/combos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
