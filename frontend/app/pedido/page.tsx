'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import {
  getPublicOrderRequest,
  lookupPublicOrdersByCustomerRequest,
  type PublicOrderDetail,
} from '@/services/checkout';

function formatOrderStatusLabel(order: PublicOrderDetail): { label: string; className: string } {
  if (order.status === 'CONFIRMED' && order.payment?.status === 'APPROVED') {
    return { label: 'Pago confirmado', className: 'text-emerald-700' };
  }
  if (order.status === 'UNDER_REVIEW' || order.payment?.status === 'UNDER_REVIEW') {
    return { label: 'En verificación', className: 'text-amber-700' };
  }
  if (order.status === 'CANCELLED' || order.payment?.status === 'REJECTED') {
    return { label: 'Rechazado / Cancelado', className: 'text-red-700' };
  }
  return { label: 'Pendiente de pago', className: 'text-slate-600' };
}

function formatCampaignStatusBadge(status?: string): { label: string; className: string } {
  if (status === 'COMPLETED' || status === 'CLOSED') {
    return { label: 'FINALIZADA', className: 'bg-slate-100 text-slate-700' };
  }
  return { label: 'ACTIVA', className: 'bg-emerald-100 text-emerald-700' };
}

function OrdersSummaryView({ orders }: { orders: PublicOrderDetail[] }) {
  const { customerName, totalChances, activeCampaigns, finishedCampaigns, pendingOrders, grouped } =
    useMemo(() => {
      const map = new Map<
        string,
        {
          campaign: PublicOrderDetail['campaign'];
          chances: string[];
          orders: PublicOrderDetail[];
        }
      >();

      let pending = 0;
      let total = 0;
      let resolvedName: string | null = null;

      for (const order of orders) {
        if (!resolvedName && order.customerName) {
          resolvedName = order.customerName;
        }
        if (order.status !== 'CONFIRMED' || order.payment?.status !== 'APPROVED') {
          pending += 1;
        }
        total += order.chances.length;

        const existing = map.get(order.campaign.id);
        const orderNumbers = order.chances.map((c) => c.number);
        if (existing) {
          existing.chances.push(...orderNumbers);
          existing.orders.push(order);
        } else {
          map.set(order.campaign.id, {
            campaign: order.campaign,
            chances: [...orderNumbers],
            orders: [order],
          });
        }
      }

      const groups = Array.from(map.values()).map((g) => ({
        ...g,
        chances: [...g.chances].sort(),
      }));

      const activeCount = groups.filter(
        (g) => g.campaign.status !== 'COMPLETED' && g.campaign.status !== 'CLOSED',
      ).length;
      const finishedCount = groups.length - activeCount;

      return {
        customerName: resolvedName,
        totalChances: total,
        activeCampaigns: activeCount,
        finishedCampaigns: finishedCount,
        pendingOrders: pending,
        grouped: groups,
      };
    }, [orders]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div>
          {customerName ? (
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {customerName}
            </p>
          ) : null}
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            {totalChances} {totalChances === 1 ? 'chance' : 'chances'} en {grouped.length}{' '}
            {grouped.length === 1 ? 'campaña' : 'campañas'}
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
            <div className="text-xl font-extrabold text-slate-900">{activeCampaigns}</div>
            <div className="text-xs text-slate-500 mt-0.5">Activas</div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
            <div className="text-xl font-extrabold text-slate-900">{finishedCampaigns}</div>
            <div className="text-xs text-slate-500 mt-0.5">Finalizadas</div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
            <div className="text-xl font-extrabold text-slate-900">{pendingOrders}</div>
            <div className="text-xs text-slate-500 mt-0.5">Pendientes</div>
          </div>
        </div>
      </section>

      {grouped.map((group) => {
        const badge = formatCampaignStatusBadge(group.campaign.status);
        return (
          <section
            key={group.campaign.id}
            className="rounded-2xl border bg-white p-6 shadow-sm space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-slate-900">{group.campaign.title}</h3>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <Link
                href={`/campana?slug=${encodeURIComponent(group.campaign.slug)}`}
                className="text-xs font-semibold text-slate-600 hover:text-blue-600 whitespace-nowrap"
              >
                Ver campaña
              </Link>
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-bold text-slate-700">
                Tus chances ({group.chances.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {group.chances.map((num, idx) => (
                  <span
                    key={`${num}-${idx}`}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 font-mono text-xs font-bold text-blue-700"
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              {group.orders.map((order) => {
                const statusInfo = formatOrderStatusLabel(order);
                const dateStr = new Date(
                  order.confirmedAt ?? order.createdAt ?? order.expiresAt,
                ).toLocaleDateString('es-CR');

                return (
                  <div key={order.publicReference} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">Pedido {order.publicReference}</p>
                        <p className={`font-medium ${statusInfo.className}`}>{statusInfo.label}</p>
                      </div>
                      <span className="text-slate-400">{dateStr}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.chances.map((c) => (
                        <span
                          key={c.number}
                          className="rounded-lg bg-blue-50 px-3 py-1.5 font-mono text-xs font-bold text-blue-700"
                        >
                          {c.number}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function OrderLookupContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get('ref') ?? '';
  const initialToken = searchParams.get('token') ?? '';

  const [identifierInput, setIdentifierInput] = useState('');
  const [customerQuery, setCustomerQuery] = useState<string | null>(null);

  const directQuery = useQuery({
    queryKey: ['public-order', initialRef, initialToken],
    queryFn: () => getPublicOrderRequest(initialRef, initialToken),
    enabled: Boolean(initialRef && initialToken),
    retry: false,
  });

  const customerOrdersQuery = useQuery({
    queryKey: ['public-orders-customer', customerQuery],
    queryFn: () => lookupPublicOrdersByCustomerRequest(customerQuery!),
    enabled: Boolean(customerQuery),
    retry: false,
  });

  const isLoading = directQuery.isLoading || customerOrdersQuery.isLoading;
  const isError = directQuery.isError || customerOrdersQuery.isError;
  const orders: PublicOrderDetail[] = customerQuery
    ? (customerOrdersQuery.data ?? [])
    : directQuery.data
      ? [directQuery.data]
      : [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (identifierInput.trim()) {
              setCustomerQuery(identifierInput.trim());
            }
          }}
          className="rounded-2xl border bg-white p-6 shadow-sm space-y-4"
        >
          <div>
            <h1 className="text-xl font-bold text-slate-900">Consultá tus pedidos</h1>
            <p className="text-sm text-slate-500 mt-1">
              Usá los mismos datos que ingresaste en el checkout. No necesitás crear cuenta.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              required
              value={identifierInput}
              onChange={(e) => setIdentifierInput(e.target.value)}
              placeholder="Correo electrónico o teléfono (ej. 88887777)"
              className="flex-1 rounded-lg border px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Search className="h-4 w-4" />
              Buscar chances
            </button>
          </div>
        </form>

        {isLoading ? (
          <div className="text-center text-sm text-slate-500 py-6">Buscando pedidos...</div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No pudimos consultar tus pedidos. Verificá que el correo o teléfono tenga el formato correcto.
          </div>
        ) : customerQuery && orders.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No encontramos pedidos en sorteos vigentes con ese dato.
          </div>
        ) : orders.length > 0 ? (
          <OrdersSummaryView orders={orders} />
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

export default function PedidoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
          Cargando...
        </div>
      }
    >
      <OrderLookupContent />
    </Suspense>
  );
}
