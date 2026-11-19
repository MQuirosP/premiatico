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
  PrizeAmountScope,
  PrizeCategory,
  PrizeDrawWeightMode,
  ReservationStatus,
  WinnerDeliveryStatus,
  WinnerSourceType,
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
  PrizeAmountScope,
  PrizeCategory,
  PrizeDrawWeightMode,
  ReservationStatus,
  WinnerDeliveryStatus,
  WinnerSourceType,
};

export const campaignStatusSchema = z.nativeEnum(CampaignStatus);
export const campaignDrawModeSchema = z.nativeEnum(CampaignDrawMode);
export const legalApprovalStatusSchema = z.nativeEnum(LegalApprovalStatus);
export const digitalPassKindSchema = z.nativeEnum(DigitalPassKind);
export const prizeCategorySchema = z.nativeEnum(PrizeCategory);
export const prizeAmountScopeSchema = z.nativeEnum(PrizeAmountScope);
export const prizeDrawWeightModeSchema = z.nativeEnum(PrizeDrawWeightMode);
export const orderChannelSchema = z.nativeEnum(OrderChannel);
export const winnerDeliveryStatusSchema = z.nativeEnum(WinnerDeliveryStatus);

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
