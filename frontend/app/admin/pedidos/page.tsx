'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ChancesModal, type ChancesModalEntry } from '@/components/chances-modal';
import { apiRequest, ApiError } from '@/lib/api';
import { formatCRC } from '@/lib/utils';

interface AdminPaymentRow {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  order: {
    publicReference: string;
    status: string;
    customer: { fullName: string; email: string; phone: string };
    campaign: { title: string; slug: string };
    items?: Array<{ comboNameSnapshot: string; chanceQuantitySnapshot: number }>;
    participations?: Array<{ number: string; status: string }>;
  };
  proofs: Array<{ id: string; mimeType: string; signedUrl: string | null }>;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente de comprobante', className: 'bg-slate-100 text-slate-700' },
  UNDER_REVIEW: { label: 'En revisión', className: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Aprobado', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Rechazado', className: 'bg-red-100 text-red-700' },
};

export default function AdminPedidosPage() {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('UNDER_REVIEW');
  const [campaignFilter, setCampaignFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProof, setSelectedProof] = useState<{
    payment: AdminPaymentRow;
    url: string;
    mimeType: string;
  } | null>(null);
  const [selectedChances, setSelectedChances] = useState<{
    title: string;
    subtitle: string;
    entries: ChancesModalEntry[];
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('Comprobante rechazado en revisión manual');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', statusFilter],
    queryFn: () =>
      apiRequest<{ payments: AdminPaymentRow[] }>(
        statusFilter === 'ALL' ? '/admin/payments' : `/admin/payments?status=${statusFilter}`,
      ),
  });

  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.payments ?? []) {
      map.set(p.order.campaign.slug, p.order.campaign.title);
    }
    return Array.from(map.entries());
  }, [data?.payments]);

  const filteredPayments = useMemo(() => {
    const list = data?.payments ?? [];
    const q = searchTerm.trim().toLowerCase();
    return list.filter((p) => {
      if (campaignFilter !== 'ALL' && p.order.campaign.slug !== campaignFilter) return false;
      if (!q) return true;
      return (
        p.order.publicReference.toLowerCase().includes(q) ||
        p.order.customer.fullName.toLowerCase().includes(q) ||
        p.order.customer.phone.toLowerCase().includes(q) ||
        p.order.customer.email.toLowerCase().includes(q)
      );
    });
  }, [data?.payments, campaignFilter, searchTerm]);

  const approveMutation = useMutation({
    mutationFn: (paymentId: string) =>
      apiRequest(`/admin/payments/${paymentId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      setErrorMsg(null);
      setSelectedProof(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'Error al aprobar pago');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      apiRequest(`/admin/payments/${paymentId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason: reason }),
      }),
    onSuccess: () => {
      setErrorMsg(null);
      setSelectedProof(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'Error al rechazar pago');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pedidos y revisión SINPE</h1>
        <p className="text-sm text-slate-500">
          Verificá comprobantes bancarios antes de confirmar los chances del cliente.
        </p>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar ref, cliente, tel o correo..."
              className="w-full rounded-lg border pl-9 pr-3 py-1.5 text-xs"
            />
          </div>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            <option value="ALL">Todas las campañas</option>
            {campaignOptions.map(([slug, title]) => (
              <option key={slug} value={slug}>
                {title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'UNDER_REVIEW', label: 'En revisión' },
            { key: 'PENDING', label: 'Pendientes' },
            { key: 'APPROVED', label: 'Aprobados' },
            { key: 'REJECTED', label: 'Rechazados' },
            { key: 'ALL', label: 'Todos' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'border bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando pagos...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay pagos que coincidan con los filtros seleccionados.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 whitespace-nowrap">
              <tr>
                <th className="px-4 py-3">Pedido y campaña</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Combo / Chances</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Comprobante</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Revisión</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPayments.map((p) => {
                const badge = STATUS_BADGES[p.status] ?? {
                  label: p.status,
                  className: 'bg-slate-100 text-slate-700',
                };
                const proof = p.proofs[0];
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900">
                        {p.order.publicReference}
                      </div>
                      <div className="mt-0.5 inline-block rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {p.order.campaign.title}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 whitespace-nowrap">
                        {p.order.customer.fullName}
                      </div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">
                        {p.order.customer.phone} · {p.order.customer.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">
                          {p.order.items?.map((item) => item.comboNameSnapshot).join(', ') || 'Combo'}
                        </span>
                        {p.order.participations && p.order.participations.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedChances({
                                title: `${p.order.publicReference} · ${p.order.customer.fullName}`,
                                subtitle: p.order.campaign.title,
                                entries: [
                                  {
                                    label:
                                      p.order.items?.map((item) => item.comboNameSnapshot).join(', ') ||
                                      'Combo',
                                    sublabel: `${p.order.participations!.length} chances`,
                                    numbers: p.order.participations!,
                                  },
                                ],
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver ({p.order.participations.length})
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Sin números</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {formatCRC(p.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {proof?.signedUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedProof({
                              payment: p,
                              url: proof.signedUrl!,
                              mimeType: proof.mimeType,
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {p.status === 'UNDER_REVIEW' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Aprobar pago"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(p.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            <Check className="h-3.5 w-3.5" /> Aprobar
                          </button>
                          <button
                            type="button"
                            title="Rechazar pago"
                            disabled={rejectMutation.isPending}
                            onClick={() =>
                              rejectMutation.mutate({
                                paymentId: p.id,
                                reason: rejectReason,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            <X className="h-3.5 w-3.5" /> Rechazar
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedProof ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setSelectedProof(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Comprobante · {selectedProof.payment.order.publicReference}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedProof.payment.order.campaign.title} ·{' '}
                  {selectedProof.payment.order.customer.fullName} ·{' '}
                  {formatCRC(selectedProof.payment.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProof(null)}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" /> Cerrar
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
              {selectedProof.mimeType.startsWith('image/') ? (
                <img
                  src={selectedProof.url}
                  alt={`Comprobante ${selectedProof.payment.order.publicReference}`}
                  className="max-h-[65vh] w-auto rounded-lg object-contain shadow"
                />
              ) : (
                <iframe
                  src={selectedProof.url}
                  title={`Comprobante ${selectedProof.payment.order.publicReference}`}
                  className="h-[65vh] w-full rounded-lg border bg-white"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-white px-5 py-3">
              {selectedProof.payment.status === 'UNDER_REVIEW' ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Motivo de rechazo (opcional)"
                    className="flex-1 min-w-[200px] rounded-lg border px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={rejectMutation.isPending}
                    onClick={() =>
                      rejectMutation.mutate({
                        paymentId: selectedProof.payment.id,
                        reason: rejectReason.trim() || 'Comprobante rechazado en revisión manual',
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    <X className="h-3.5 w-3.5" /> Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(selectedProof.payment.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" /> Aprobar pago
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  Estado actual:{' '}
                  <strong>
                    {STATUS_BADGES[selectedProof.payment.status]?.label ??
                      selectedProof.payment.status}
                  </strong>
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelectedProof(null)}
                className="rounded-lg border px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ChancesModal
        open={Boolean(selectedChances)}
        onClose={() => setSelectedChances(null)}
        title={selectedChances?.title ?? ''}
        subtitle={selectedChances?.subtitle}
        entries={selectedChances?.entries ?? []}
      />
    </div>
  );
}
