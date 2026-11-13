'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ProofReviewModal } from '@/components/admin/proof-review-modal';
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

      <div className="rounded-xl border bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando pagos...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay pagos que coincidan con los filtros seleccionados.
          </div>
        ) : (
          <>
            {/* Vista móvil en cards */}
            <div className="divide-y sm:hidden">
              {filteredPayments.map((p) => {
                const badge = STATUS_BADGES[p.status] ?? {
                  label: p.status,
                  className: 'bg-slate-100 text-slate-700',
                };
                const proof = p.proofs[0];
                const comboLabel =
                  p.order.items?.map((item) => item.comboNameSnapshot).join(', ') || 'Combo';

                return (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-sm font-bold text-slate-900">
                          {p.order.publicReference}
                        </div>
                        <div className="mt-0.5 inline-block rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          {p.order.campaign.title}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-0.5">
                      <p className="font-semibold text-slate-900">{p.order.customer.fullName}</p>
                      <p className="break-all">
                        {p.order.customer.phone} · {p.order.customer.email}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs border-t pt-2">
                      <span className="font-semibold text-slate-700">{comboLabel}</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatCRC(p.amount)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {p.order.participations && p.order.participations.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedChances({
                              title: `${p.order.publicReference} · ${p.order.customer.fullName}`,
                              subtitle: p.order.campaign.title,
                              entries: [
                                {
                                  label: comboLabel,
                                  sublabel: `${p.order.participations!.length} chances`,
                                  numbers: p.order.participations!,
                                },
                              ],
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Chances ({p.order.participations.length})
                        </button>
                      ) : null}

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
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Comprobante
                        </button>
                      ) : null}

                      {p.status === 'UNDER_REVIEW' ? (
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(p.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            <Check className="h-3.5 w-3.5" /> Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={rejectMutation.isPending}
                            onClick={() =>
                              rejectMutation.mutate({
                                paymentId: p.id,
                                reason: rejectReason,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            <X className="h-3.5 w-3.5" /> Rechazar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista desktop en tabla */}
            <div className="hidden sm:block overflow-x-auto">
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
            </div>
          </>
        )}
      </div>

      <ProofReviewModal
        selectedProof={selectedProof}
        statusLabel={
          selectedProof
            ? (STATUS_BADGES[selectedProof.payment.status]?.label ?? selectedProof.payment.status)
            : ''
        }
        rejectReason={rejectReason}
        onRejectReasonChange={setRejectReason}
        onClose={() => setSelectedProof(null)}
        onApprove={(paymentId) => approveMutation.mutate(paymentId)}
        onReject={(paymentId, reason) => rejectMutation.mutate({ paymentId, reason })}
        isSubmitting={approveMutation.isPending || rejectMutation.isPending}
      />

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
