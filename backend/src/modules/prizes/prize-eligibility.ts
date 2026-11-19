import crypto from 'node:crypto';
import {
  OrderChannel,
  ParticipationStatus,
  PrizeAmountScope,
  PrizeDrawWeightMode,
} from '../../core/domain-constants.js';
import { prisma } from '../../core/prisma.js';

export interface PrizeEligibilityRules {
  campaignId: string;
  minOrderAmount: number | null;
  amountScope: PrizeAmountScope;
  minTickets: number | null;
  purchaseFrom: Date | null;
  purchaseUntil: Date | null;
  requiredComboId: string | null;
  orderChannel: OrderChannel | null;
  drawWeightMode: PrizeDrawWeightMode;
}

export interface OrderForEligibility {
  id: string;
  publicReference: string;
  customerId: string;
  totalAmount: number;
  confirmedAt: Date | null;
  createdAt: Date;
  channel: OrderChannel;
  customer: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
  };
  items: Array<{
    comboId: string;
    comboNameSnapshot: string;
    fichaQuantitySnapshot: number;
  }>;
}

export interface EligibleParticipationRow {
  id: string;
  number: string;
  orderId: string | null;
  order: OrderForEligibility | null;
}

interface CustomerAggregates {
  totalAmount: number;
  totalTickets: number;
}

function getOrderEffectiveDate(order: Pick<OrderForEligibility, 'confirmedAt' | 'createdAt'>): Date {
  return order.confirmedAt ?? order.createdAt;
}

function getOrderTicketCount(order: Pick<OrderForEligibility, 'items'>): number {
  return order.items.reduce((sum, item) => sum + item.fichaQuantitySnapshot, 0);
}

function passesBaseOrderFilters(
  order: OrderForEligibility,
  rules: PrizeEligibilityRules,
): string | null {
  const effectiveDate = getOrderEffectiveDate(order);

  if (rules.purchaseFrom && effectiveDate < rules.purchaseFrom) {
    return `Compra confirmada antes del inicio de la ventana elegible (${rules.purchaseFrom.toLocaleString('es-CR')})`;
  }
  if (rules.purchaseUntil && effectiveDate > rules.purchaseUntil) {
    return `Compra confirmada después del cierre de la ventana elegible (${rules.purchaseUntil.toLocaleString('es-CR')})`;
  }
  if (rules.orderChannel && order.channel !== rules.orderChannel) {
    return `Canal de compra (${order.channel}) no elegible para este sorteo (requiere ${rules.orderChannel})`;
  }
  if (
    rules.requiredComboId &&
    !order.items.some((item) => item.comboId === rules.requiredComboId)
  ) {
    return 'El pedido no incluye el combo requerido para este premio';
  }
  return null;
}

export function buildCustomerAggregates(
  orders: OrderForEligibility[],
  rules: PrizeEligibilityRules,
): Map<string, CustomerAggregates> {
  const seenOrders = new Set<string>();
  const map = new Map<string, CustomerAggregates>();

  for (const order of orders) {
    if (seenOrders.has(order.id)) continue;
    seenOrders.add(order.id);

    // Si hay ventana de tiempo, canal o combo requerido, solo acumulan pedidos que cumplen esos filtros base.
    if (passesBaseOrderFilters(order, rules) !== null) continue;

    const current = map.get(order.customerId) ?? { totalAmount: 0, totalTickets: 0 };
    current.totalAmount += order.totalAmount;
    current.totalTickets += getOrderTicketCount(order);
    map.set(order.customerId, current);
  }

  return map;
}

export function getOrderIneligibilityReason(
  order: OrderForEligibility,
  rules: PrizeEligibilityRules,
  customerAggregates: Map<string, CustomerAggregates>,
  excludedOrderIds: Set<string>,
): string | null {
  if (excludedOrderIds.has(order.id)) {
    return 'Este pedido ya resultó ganador en otro premio de esta campaña';
  }

  const baseReason = passesBaseOrderFilters(order, rules);
  if (baseReason) return baseReason;

  const isCustomerScope = rules.amountScope === PrizeAmountScope.CUSTOMER_TOTAL;
  const customerStats = customerAggregates.get(order.customerId) ?? {
    totalAmount: order.totalAmount,
    totalTickets: getOrderTicketCount(order),
  };

  if (rules.minOrderAmount && rules.minOrderAmount > 0) {
    const amountToCheck = isCustomerScope ? customerStats.totalAmount : order.totalAmount;
    if (amountToCheck < rules.minOrderAmount) {
      const scopeLabel = isCustomerScope ? 'acumulado del cliente' : 'del pedido';
      return `El monto ${scopeLabel} (₡${amountToCheck.toLocaleString('es-CR')}) es menor al mínimo de ₡${rules.minOrderAmount.toLocaleString('es-CR')} requerido para este premio`;
    }
  }

  if (rules.minTickets && rules.minTickets > 0) {
    const ticketsToCheck = isCustomerScope
      ? customerStats.totalTickets
      : getOrderTicketCount(order);
    if (ticketsToCheck < rules.minTickets) {
      const scopeLabel = isCustomerScope ? 'acumuladas del cliente' : 'del pedido';
      return `La cantidad de fichas ${scopeLabel} (${ticketsToCheck}) es menor al mínimo de ${rules.minTickets} requerido`;
    }
  }

  return null;
}

export async function getPrizeEligibilityPool(
  rules: PrizeEligibilityRules,
  excludedOrderIdsList: string[],
) {
  const participations = (await prisma.participation.findMany({
    where: {
      campaignId: rules.campaignId,
      status: ParticipationStatus.CONFIRMED,
    },
    select: {
      id: true,
      number: true,
      orderId: true,
      order: {
        select: {
          id: true,
          publicReference: true,
          customerId: true,
          totalAmount: true,
          confirmedAt: true,
          createdAt: true,
          channel: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          items: {
            select: {
              comboId: true,
              comboNameSnapshot: true,
              fichaQuantitySnapshot: true,
            },
          },
        },
      },
    },
  })) as EligibleParticipationRow[];

  const excludedSet = new Set(excludedOrderIdsList);
  const allOrders = participations
    .map((p) => p.order)
    .filter((o): o is OrderForEligibility => Boolean(o));

  const customerAggregates = buildCustomerAggregates(allOrders, rules);

  const eligibleParticipations: EligibleParticipationRow[] = [];
  const customerMap = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      phone: string;
      ticketCount: number;
      totalAmount: number;
      tickets: EligibleParticipationRow[];
    }
  >();

  for (const row of participations) {
    if (!row.order) continue;
    const reason = getOrderIneligibilityReason(row.order, rules, customerAggregates, excludedSet);
    if (reason !== null) continue;

    eligibleParticipations.push(row);

    const agg = customerAggregates.get(row.order.customerId);
    const existingCustomer = customerMap.get(row.order.customerId);
    if (existingCustomer) {
      existingCustomer.ticketCount += 1;
      existingCustomer.tickets.push(row);
    } else {
      customerMap.set(row.order.customerId, {
        customerId: row.order.customerId,
        customerName: row.order.customer.fullName,
        phone: row.order.customer.phone,
        ticketCount: 1,
        totalAmount: agg?.totalAmount ?? row.order.totalAmount,
        tickets: [row],
      });
    }
  }

  // En modo PER_CUSTOMER, cada cliente elegible entra una sola vez en la tómbola aleatoria.
  const drawPool: EligibleParticipationRow[] =
    rules.drawWeightMode === PrizeDrawWeightMode.PER_CUSTOMER
      ? Array.from(customerMap.values()).map((c) => {
          const picked = c.tickets[crypto.randomInt(0, c.tickets.length)]!;
          return picked;
        })
      : eligibleParticipations;

  return {
    totalConfirmedCount: participations.length,
    eligibleParticipations,
    drawPool,
    eligibleCustomers: Array.from(customerMap.values()).map((c) => ({
      customerId: c.customerId,
      customerName: c.customerName,
      phone: c.phone,
      ticketCount: c.ticketCount,
      totalAmount: c.totalAmount,
    })),
    excludedCount: participations.length - eligibleParticipations.length,
  };
}
