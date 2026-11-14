import { apiRequest } from '@/lib/api';

export interface PaymentSettingsData {
  sinpePhone: string;
  sinpeHolderName: string;
  sinpeBankName: string | null;
  sinpeInstructions: string;
  sinpeDetailNotice: string | null;
  updatedAt: string | null;
}

export async function getAdminPaymentSettingsRequest(): Promise<PaymentSettingsData> {
  const res = await apiRequest<{ settings: PaymentSettingsData }>('/admin/settings/payment');
  return res.settings;
}

export async function updateAdminPaymentSettingsRequest(payload: {
  sinpePhone: string;
  sinpeHolderName: string;
  sinpeBankName?: string | null;
  sinpeInstructions: string;
  sinpeDetailNotice?: string | null;
}): Promise<PaymentSettingsData> {
  const res = await apiRequest<{ settings: PaymentSettingsData }>('/admin/settings/payment', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.settings;
}
