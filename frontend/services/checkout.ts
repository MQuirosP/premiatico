import { apiRequest } from '@/lib/api';

export interface InverseOffer {
  sourceNumber: string;
  inverseNumber: string;
}

export interface ReservationSessionData {
  sessionId: string;
  sessionToken: string;
  campaignId: string;
  campaignTitle?: string;
  comboId: string;
  comboName: string;
  unitPrice: number;
  unitPassQuantity: number;
  unitFichaQuantity: number;
  packageCount: number;
  price: number;
  passQuantity: number;
  fichaQuantity: number;
  numbers: string[];
  enableInverseNumbers: boolean;
  availableInverses: InverseOffer[];
  inverseAdditions: InverseOffer[];
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
    receiverPhone: string;
    receiverHolder: string;
    receiverBank: string | null;
    detailNotice: string | null;
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
  createdAt?: string;
  customerName?: string | null;
  campaign: {
    id: string;
    title: string;
    slug: string;
    status?: string;
  };
  items: Array<{
    comboName: string;
    passQuantity: number;
    fichaQuantity: number;
    totalPrice: number;
  }>;
  fichas: Array<{ number: string; status: string }>;
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

export interface ReservationMutationResult {
  sessionId: string;
  packageCount: number;
  price: number;
  passQuantity: number;
  fichaQuantity: number;
  numbers: string[];
  enableInverseNumbers: boolean;
  availableInverses: InverseOffer[];
  inverseAdditions: InverseOffer[];
  regenerationCount: number;
  maxNumberChanges: number;
  remainingChanges: number;
  expiresAt: string;
}

export async function regenerateNumbersRequest(payload: {
  sessionId: string;
  sessionToken: string;
}): Promise<ReservationMutationResult> {
  return apiRequest<ReservationMutationResult>(
    `/reservations/${encodeURIComponent(payload.sessionId)}/regenerate`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionToken: payload.sessionToken }),
    },
  );
}

export async function addInversePackageRequest(payload: {
  sessionId: string;
  sessionToken: string;
  sourceNumber: string;
}): Promise<ReservationMutationResult> {
  return apiRequest<ReservationMutationResult>(
    `/reservations/${encodeURIComponent(payload.sessionId)}/add-inverse`,
    {
      method: 'POST',
      body: JSON.stringify({
        sessionToken: payload.sessionToken,
        sourceNumber: payload.sourceNumber,
      }),
    },
  );
}

export async function cancelReservationRequest(payload: {
  sessionId: string;
  sessionToken: string;
}): Promise<{ cancelled: boolean }> {
  return apiRequest<{ cancelled: boolean }>(
    `/reservations/${encodeURIComponent(payload.sessionId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionToken: payload.sessionToken }),
    },
  );
}

export async function createOrderRequest(payload: {
  sessionId: string;
  sessionToken: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}): Promise<CreatedOrderData> {
  return apiRequest<CreatedOrderData>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cancelOrderRequest(payload: {
  publicReference: string;
  accessToken: string;
}): Promise<{ cancelled: boolean; publicReference: string }> {
  return apiRequest<{ cancelled: boolean; publicReference: string }>(
    `/orders/${encodeURIComponent(payload.publicReference)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ accessToken: payload.accessToken }),
    },
  );
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

export async function lookupPublicOrdersByCustomerRequest(
  identifier: string,
): Promise<PublicOrderDetail[]> {
  const res = await apiRequest<{ orders: PublicOrderDetail[] }>('/orders/lookup', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
  return res.orders;
}
