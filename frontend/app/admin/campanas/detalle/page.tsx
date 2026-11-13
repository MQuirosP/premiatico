'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, ExternalLink, ShieldCheck, Ticket, Users } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CampaignProgressBar } from '@/components/campaign-progress';
import { formatCRC } from '@/lib/utils';
import { getAdminCampaignDetail } from '@/services/campaigns';

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  UNDER_REVIEW: 'En revisión',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
};

function CampaignDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';

  const { data: campaign, isLoading, isError } = useQuery({
    queryKey: ['admin-campaign-detail', id],
    queryFn: () => getAdminCampaignDetail(id),
    enabled: Boolean(id),
  });

  if (!id) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/campanas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a campañas
        </Link>
        <p className="text-sm text-slate-500">No se especificó ninguna campaña.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-slate-500">Cargando detalles de la campaña...</div>;
  }

  if (isError || !campaign) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/campanas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a campañas
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar la campaña solicitada.
        </div>
      </div>
    );
  }

  const combos = campaign.combos ?? [];
  const orders = campaign.orders ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/campanas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a campañas
        </Link>

        {campaign.status === 'ACTIVE' ? (
          <Link
            href={`/campana?slug=${encodeURIComponent(campaign.slug)}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
          >
            Ver página pública <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] items-start">
          {campaign.coverImageUrl ? (
            <img
              src={campaign.coverImageUrl}
              alt={campaign.title}
              className="aspect-square w-full rounded-xl border object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-xl border border-dashed bg-slate-50 flex items-center justify-center text-xs text-slate-400">
              Sin portada
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{campaign.title}</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {campaign.status}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Legal: {campaign.legalApprovalStatus}
                {campaign.legalApprovalReference ? ` (${campaign.legalApprovalReference})` : ''}
              </span>
            </div>

            <p className="text-sm text-slate-600 whitespace-pre-line">{campaign.description}</p>

            <div className="grid gap-3 sm:grid-cols-3 text-xs text-slate-600">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] uppercase text-slate-400">Cierre de ventas</span>
                <span className="mt-0.5 inline-flex items-center gap-1 font-semibold text-slate-800">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(campaign.endAt).toLocaleString('es-CR')}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] uppercase text-slate-400">Fecha de sorteo</span>
                <span className="mt-0.5 block font-semibold text-slate-800">
                  {campaign.drawAt ? new Date(campaign.drawAt).toLocaleString('es-CR') : 'Sin definir'}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] uppercase text-slate-400">Sorteo</span>
                <span className="mt-0.5 block font-semibold text-slate-800">
                  {campaign.drawReference || 'No especificado'}
                </span>
              </div>
            </div>

            <CampaignProgressBar progress={campaign.progress} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-amber-500" />
          Combos y pases digitales ({combos.length})
        </h2>

        {combos.length === 0 ? (
          <p className="text-sm text-slate-500">Esta campaña no tiene combos activos.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {combos.map((combo) => (
              <div key={combo.id} className="rounded-xl border bg-slate-50/70 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{combo.name}</span>
                  <span className="font-extrabold text-blue-700">{formatCRC(combo.price)}</span>
                </div>
                <p className="text-slate-600">
                  {combo.passQuantity} pases · {combo.chanceQuantity} chances de regalo
                </p>
                {combo.passItems && combo.passItems.length > 0 ? (
                  <div className="pt-1 border-t space-y-1">
                    {combo.passItems.map((pi) => (
                      <div key={pi.id} className="text-[11px] text-emerald-700 font-medium">
                        Pase vinculado: {pi.digitalPass.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pt-1 border-t text-[11px] text-amber-700">
                    Sin pase digital vinculado
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            Órdenes y clientes participantes ({orders.length})
          </h2>
        </div>

        {orders.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            Aún no hay órdenes registradas en esta campaña.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Combo</th>
                  <th className="px-4 py-3">Chances</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => {
                  const items = order.items ?? [];
                  const participations = order.participations ?? [];
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {order.publicReference}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 whitespace-nowrap">
                          {order.customer?.fullName ?? '—'}
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                          {order.customer?.phone ?? '—'} · {order.customer?.email ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                        {items.map((i) => i.comboNameSnapshot).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {participations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {participations.map((p) => (
                              <span
                                key={p.number}
                                className="rounded border bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800"
                              >
                                {p.number}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Sin números activos</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        {formatCRC(order.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminCampaignDetailPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Cargando...</div>}>
      <CampaignDetailInner />
    </Suspense>
  );
}
