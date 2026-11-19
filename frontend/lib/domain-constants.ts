export const CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export const CAMPAIGN_DRAW_MODE = {
  SINGLE_WINNER: 'SINGLE_WINNER',
  MULTI_PRIZE: 'MULTI_PRIZE',
} as const;
export type CampaignDrawMode = (typeof CAMPAIGN_DRAW_MODE)[keyof typeof CAMPAIGN_DRAW_MODE];

export const LEGAL_APPROVAL_STATUS = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type LegalApprovalStatus =
  (typeof LEGAL_APPROVAL_STATUS)[keyof typeof LEGAL_APPROVAL_STATUS];

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  UNDER_REVIEW: 'UNDER_REVIEW',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PARTICIPATION_STATUS = {
  RESERVED: 'RESERVED',
  CONFIRMED: 'CONFIRMED',
  RELEASED: 'RELEASED',
} as const;
export type ParticipationStatus =
  (typeof PARTICIPATION_STATUS)[keyof typeof PARTICIPATION_STATUS];

export const DIGITAL_PASS_KIND = {
  PASS: 'PASS',
  FICHA: 'FICHA',
} as const;
export type DigitalPassKind = (typeof DIGITAL_PASS_KIND)[keyof typeof DIGITAL_PASS_KIND];

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Borrador', className: 'bg-slate-100 text-slate-700' },
  ACTIVE: { label: 'Activa', className: 'bg-emerald-100 text-emerald-800' },
  PAUSED: { label: 'Pausada', className: 'bg-amber-100 text-amber-800' },
  CLOSED: { label: 'Cerrada', className: 'bg-slate-200 text-slate-800' },
  COMPLETED: { label: 'Completada', className: 'bg-blue-100 text-blue-800' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
};

export const LEGAL_STATUS_META: Record<
  LegalApprovalStatus,
  { label: string; className: string }
> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Aprobada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rechazada', className: 'bg-red-50 text-red-700 border-red-200' },
  NOT_REQUIRED: {
    label: 'No requerida',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  },
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  UNDER_REVIEW: 'En revisión',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
};

export const PAYMENT_STATUS_BADGES: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente de comprobante', className: 'bg-slate-100 text-slate-700' },
  UNDER_REVIEW: { label: 'En revisión', className: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Aprobado', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Rechazado', className: 'bg-red-100 text-red-700' },
};

export const DRAW_MODE_OPTIONS: Array<{
  value: CampaignDrawMode;
  title: string;
  createDescription: string;
  detailDescription: string;
}> = [
  {
    value: CAMPAIGN_DRAW_MODE.SINGLE_WINNER,
    title: 'Sorteo único (1 ganador)',
    createDescription:
      'Un único número ganador para toda la campaña. Al evaluarlo se completa automáticamente.',
    detailDescription:
      'Un único número ganador. Al evaluarlo la campaña se completa automáticamente.',
  },
  {
    value: CAMPAIGN_DRAW_MODE.MULTI_PRIZE,
    title: 'Múltiples premios / sorteos',
    createDescription:
      'Varios premios o sorteos en un mismo día; se completa cuando todos estén evaluados.',
    detailDescription:
      'Varios premios o sorteos en el mismo día; se completa al evaluar todos.',
  },
];

export function getCampaignStatusBadge(status: string) {
  return (
    CAMPAIGN_STATUS_META[status as CampaignStatus] ?? {
      label: status,
      className: 'bg-slate-100 text-slate-700',
    }
  );
}

export function getLegalStatusBadge(status: string) {
  return (
    LEGAL_STATUS_META[status as LegalApprovalStatus] ?? {
      label: status,
      className: 'bg-slate-50 text-slate-600 border-slate-200',
    }
  );
}

export function isCampaignReadOnly(status: string): boolean {
  return (
    status === CAMPAIGN_STATUS.CLOSED ||
    status === CAMPAIGN_STATUS.COMPLETED ||
    status === CAMPAIGN_STATUS.CANCELLED
  );
}
