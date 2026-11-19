import {
  CampaignDrawMode,
  CampaignStatus,
  DigitalPassKind,
  LegalApprovalStatus,
  OrderChannel,
  OrderStatus,
  ParticipationStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '@prisma/client';
import { z } from 'zod';

export {
  CampaignDrawMode,
  CampaignStatus,
  DigitalPassKind,
  LegalApprovalStatus,
  OrderChannel,
  OrderStatus,
  ParticipationStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
};

export const campaignStatusSchema = z.nativeEnum(CampaignStatus);
export const campaignDrawModeSchema = z.nativeEnum(CampaignDrawMode);
export const legalApprovalStatusSchema = z.nativeEnum(LegalApprovalStatus);
export const digitalPassKindSchema = z.nativeEnum(DigitalPassKind);

export const ACTIVE_PARTICIPATION_STATUSES: ParticipationStatus[] = [
  ParticipationStatus.RESERVED,
  ParticipationStatus.CONFIRMED,
];

export const EXCLUDED_DASHBOARD_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
];

export function isCampaignEditLocked(status: CampaignStatus): boolean {
  return status === CampaignStatus.CLOSED || status === CampaignStatus.COMPLETED;
}

export function isCampaignEvaluationClosed(status: CampaignStatus): boolean {
  return status === CampaignStatus.COMPLETED || status === CampaignStatus.CANCELLED;
}
