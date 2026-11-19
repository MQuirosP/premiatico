import {
  ORDER_CHANNEL,
  PRIZE_AMOUNT_SCOPE,
  PRIZE_CATEGORY,
  PRIZE_DRAW_WEIGHT_MODE,
} from '@/lib/domain-constants';
import { formatCRC } from '@/lib/utils';
import type { AdminCampaignPrize } from '@/services/campaigns';
import type { CampaignPrize } from '@/types/campaign';

export function normalizeCostaRicaPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 8) return `506${digitsOnly}`;
  return digitsOnly;
}

export function buildPrizeWinnerMessage(prize: AdminCampaignPrize): string {
  const customerName = prize.winningOrder?.customer.fullName ?? 'Ganador/a';
  const orderRef = prize.winningOrder?.publicReference ?? '';
  const prizeDetail = prize.description?.trim() || prize.name;
  const valueText =
    typeof prize.estimatedValue === 'number' && prize.estimatedValue > 0
      ? ` (${formatCRC(prize.estimatedValue)})`
      : '';
  return `¡Felicidades ${customerName}! Tu número ${prize.winningNumber} resultó ganador del premio "${prize.name}" — ${prizeDetail}${valueText} en Premiático.${orderRef ? ` Referencia: ${orderRef}.` : ''}`;
}

export interface PrizeRuleBadge {
  label: string;
  className: string;
}

export function getPrizeRuleBadges(prize: CampaignPrize): PrizeRuleBadge[] {
  const badges: PrizeRuleBadge[] = [];

  if (prize.prizeType === PRIZE_CATEGORY.FLASH) {
    badges.push({
      label: 'Flash',
      className: 'bg-purple-50 text-purple-700',
    });
  }
  if (prize.minOrderAmount && prize.minOrderAmount > 0) {
    const scopeSuffix =
      prize.amountScope === PRIZE_AMOUNT_SCOPE.CUSTOMER_TOTAL ? ' (acum.)' : '';
    badges.push({
      label: `Mín. ${formatCRC(prize.minOrderAmount)}${scopeSuffix}`,
      className: 'bg-indigo-50 text-indigo-700',
    });
  }
  if (prize.minTickets && prize.minTickets > 0) {
    badges.push({
      label: `Mín. ${prize.minTickets} fichas`,
      className: 'bg-sky-50 text-sky-700',
    });
  }
  if (prize.drawWeightMode === PRIZE_DRAW_WEIGHT_MODE.PER_CUSTOMER) {
    badges.push({
      label: '1x cliente',
      className: 'bg-teal-50 text-teal-700',
    });
  }
  if (prize.purchaseFrom || prize.purchaseUntil) {
    badges.push({
      label: 'Ventana de compra',
      className: 'bg-amber-50 text-amber-800',
    });
  }
  if (prize.orderChannel === ORDER_CHANNEL.WEB) {
    badges.push({
      label: 'Solo Web',
      className: 'bg-slate-100 text-slate-700',
    });
  } else if (prize.orderChannel === ORDER_CHANNEL.PARTNER) {
    badges.push({
      label: 'Solo Vendedores',
      className: 'bg-slate-100 text-slate-700',
    });
  }

  return badges;
}
