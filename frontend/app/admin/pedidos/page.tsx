'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
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
    campaign: { title: string };
  };
  proofs: Array<{ id: string; mimeType: string; signedUrl: string | null }>;
}

export default function AdminPedidosPage() {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => apiRequest<{ payments: AdminPaymentRow[] }>('/admin/payments'),
  });

  const approveMutation = useMutation({
    mutationFn: (paymentId: string) =>
      apiRequest(`/admin/payments/${paymentId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      setErrorMsg(null);
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

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando pagos...</div>
        ) : !data || data.payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay pagos registrados aún.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Comprobante</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Revisión</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-slate-900">
                      {p.order.publicReference}
                    </div>
                    <div className="text-xs text-slate-500">{p.order.campaign.title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{p.order.customer.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {p.order.customer.phone} · {p.order.customer.email}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatCRC(p.amount)}</td>
                  <td className="px-4 py-3">
                    {p.proofs[0]?.signedUrl ? (
                      <a
                        href={p.proofs[0].signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Ver archivo <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Sin comprobante</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {p.status === 'UNDER_REVIEW' ? (
                      <>
                        <button
                          type="button"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(p.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" /> Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={rejectMutation.isPending}
                          onClick={() =>
                            rejectMutation.mutate({
                              paymentId: p.id,
                              reason: 'Comprobante rechazado en revisión manual',
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          <X className="h-3.5 w-3.5" /> Rechazar
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
