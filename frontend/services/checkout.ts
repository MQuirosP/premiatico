import { apiRequest } from '@/lib/api';

export interface ReservationSessionData {
  sessionId: string;
  sessionToken: string;
  campaignId: string;
  comboId: string;
  comboName: string;
  price: number;
  passQuantity: number;
  chanceQuantity: number;
  numbers: string[];
  regenerationCount: number;
  maxNumberChanges: number;
  remainingChanges: number;
  expiresAt: string;
}

export interface CreatedOrderData {
  orderId: string;
  publicReference: string;
  accessToken: string;
  status: string;
  totalAmount: number;
  expiresAt: string;
  campaign: {
    id: string;
    title: string;
    slug: string;
  };
  numbers: string[];
  sinpeInstructions: {
    method: string;
    amount: number;
    referenceNote: string;
    instructions: string;
  };
}

export interface PublicOrderDetail {
  publicReference: string;
  status: string;
  totalAmount: number;
  expiresAt: string;
  confirmedAt: string | null;
  campaign: {
    id: string;
    title: string;
    slug: string;
  };
  items: Array<{
    comboName: string;
    passQuantity: number;
    chanceQuantity: number;
    totalPrice: number;
  }>;
  chances: Array<{ number: string; status: string }>;
  payment: {
    id: string;
    method: string;
    amount: number;
    status: string;
    rejectionReason: string | null;
  } | null;
  passDownloads: Array<{ name: string; downloadUrl: string }>;
}

export async function createReservationRequest(payload: {
  campaignId: string;
  comboId: string;
}): Promise<ReservationSessionData> {
  return apiRequest<ReservationSessionData>('/reservations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function regenerateNumbersRequest(payload: {
  sessionId: string;
  sessionToken: string;
}): Promise<{
  sessionId: string;
  numbers: string[];
  regenerationCount: number;
  maxNumberChanges: number;
  remainingChanges: number;
  expiresAt: string;
}> {
  return apiRequest(`/reservations/${encodeURIComponent(payload.sessionId)}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({ sessionToken: payload.sessionToken }),
  });
}

export async function createOrderRequest(payload: {
  sessionId: string;
  sessionToken: string;
  fullName: string;
  email: string;
  phone: string;
}): Promise<CreatedOrderData> {
  return apiRequest<CreatedOrderData>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadProofRequest(payload: {
  publicReference: string;
  accessToken: string;
  file: File;
}): Promise<{ message: string; orderStatus: string; proofId: string }> {
  const formData = new FormData();
  formData.append('accessToken', payload.accessToken);
  formData.append('proof', payload.file);

  return apiRequest(`/payments/orders/${encodeURIComponent(payload.publicReference)}/proof`, {
    method: 'POST',
    body: formData,
  });
}

export async function getPublicOrderRequest(
  publicReference: string,
  token: string,
): Promise<PublicOrderDetail> {
  const res = await apiRequest<{ order: PublicOrderDetail }>(
    `/orders/${encodeURIComponent(publicReference)}?token=${encodeURIComponent(token)}`,
  );
  return res.order;
}
