'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2, Loader2, MessageCircle, Save } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  WINNER_DELIVERY_META,
  WINNER_DELIVERY_STATUS,
  WINNER_SOURCE_TYPE,
  type WinnerDeliveryStatus,
} from '@/lib/domain-constants';
import { normalizeCostaRicaPhone } from '@/lib/prize-helpers';
import { formatCRC } from '@/lib/utils';
import {
  listAdminDrawWinners,
  updateAdminWinnerDelivery,
  type DrawWinnerItem,
} from '@/services/campaigns';

const EDITABLE_DELIVERY_OPTIONS: WinnerDeliveryStatus[] = [
  WINNER_DELIVERY_STATUS.PENDING_CONTACT,
  WINNER_DELIVERY_STATUS.CONTACTED,
  WINNER_DELIVERY_STATUS.SCHEDULED,
  WINNER_DELIVERY_STATUS.DELIVERED,
  WINNER_DELIVERY_STATUS.UNCLAIMED,
];

interface WinnerDeliveryPanelProps {
  campaignId?: string;
}

export function WinnerDeliveryPanel({ campaignId }: WinnerDeliveryPanelProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<WinnerDeliveryStatus | 'ALL'>('ALL');
  const [notesDraftById, setNotesDraftById] = useState<Record<string, string>>({});
  const [statusDraftById, setStatusDraftById] = useState<Record<string, WinnerDeliveryStatus>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: winners = [], isLoading } = useQuery({
    queryKey: ['admin-draw-winners', campaignId ?? 'all', statusFilter],
    queryFn: () =>
      listAdminDrawWinners({
        ...(campaignId ? { campaignId } : {}),
        ...(statusFilter !== 'ALL' ? { deliveryStatus: statusFilter } : {}),
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      winnerId,
      deliveryStatus,
      deliveryNotes,
    }: {
      winnerId: string;
      deliveryStatus: WinnerDeliveryStatus;
      deliveryNotes?: string | null;
    }) => updateAdminWinnerDelivery(winnerId, { deliveryStatus, deliveryNotes }),
    onSuccess: () => {
      setErrorMsg(null);
      setFeedback('Seguimiento de entrega actualizado.');
      void queryClient.invalidateQueries({ queryKey: ['admin-draw-winners'] });
    },
    onError: (err) => {
      setFeedback(null);
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo actualizar la entrega');
    },
  });

  const getSourceLabel = (w: DrawWinnerItem) => {
    if (w.sourceType === WINNER_SOURCE_TYPE.CAMPAIGN_MAIN) return 'Premio Mayor';
    if (w.sourceType === WINNER_SOURCE_TYPE.FLASH) return 'Sorteo Flash';
    return 'Premio';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'ALL' as const, label: 'Todos' },
            ...EDITABLE_DELIVERY_OPTIONS.map((status) => ({
              value: status,
              label: WINNER_DELIVERY_META[status].label,
            })),
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                statusFilter === opt.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          {feedback}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
          Cargando historial de ganadores...
        </div>
      ) : winners.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
          No hay registros de ganadores con el filtro seleccionado.
        </div>
      ) : (
        <div className="space-y-3">
          {winners.map((w) => {
            const meta = WINNER_DELIVERY_META[w.deliveryStatus];
            const currentStatus = statusDraftById[w.id] ?? w.deliveryStatus;
            const currentNotes = notesDraftById[w.id] ?? w.deliveryNotes ?? '';
            const isSavingThis =
              updateMutation.isPending && updateMutation.variables?.winnerId === w.id;

            return (
              <div
                key={w.id}
                className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        {getSourceLabel(w)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(w.evaluatedAt).toLocaleString('es-CR')}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-slate-900">
                      {w.prize?.name ?? w.campaign.title}
                      {w.prize?.estimatedValue ? ` · ${formatCRC(w.prize.estimatedValue)}` : ''}
                    </h3>
                    <p className="text-xs text-slate-500">{w.campaign.title}</p>
                  </div>

                  <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-lg font-extrabold tracking-widest text-emerald-800">
                    {w.winningNumber}
                  </span>
                </div>

                {w.order ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{w.order.customer.fullName}</span>
                      {' · '}
                      <span className="font-mono text-slate-600">{w.order.publicReference}</span>
                      <span className="block text-[11px] text-slate-500">
                        {w.order.customer.phone}
                        {w.order.customer.email ? ` · ${w.order.customer.email}` : ''}
                      </span>
                    </div>
                    <a
                      href={`https://wa.me/${normalizeCostaRicaPhone(w.order.customer.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 transition"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </div>
                ) : (
                  <div className="rounded-xl bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
                    Número desierto (sin orden confirmada).
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto] items-center pt-1">
                  <select
                    value={currentStatus}
                    onChange={(e) =>
                      setStatusDraftById((prev) => ({
                        ...prev,
                        [w.id]: e.target.value as WinnerDeliveryStatus,
                      }))
                    }
                    className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    {EDITABLE_DELIVERY_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {WINNER_DELIVERY_META[status].label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    maxLength={500}
                    value={currentNotes}
                    onChange={(e) =>
                      setNotesDraftById((prev) => ({ ...prev, [w.id]: e.target.value }))
                    }
                    placeholder="Nota de seguimiento (ej. Se coordinó SINPE / Entregado)"
                    className="rounded-lg border bg-white px-3 py-1.5 text-xs"
                  />

                  <button
                    type="button"
                    disabled={isSavingThis}
                    onClick={() =>
                      updateMutation.mutate({
                        winnerId: w.id,
                        deliveryStatus: currentStatus,
                        deliveryNotes: currentNotes.trim() || null,
                      })
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 active:scale-95 transition"
                  >
                    {isSavingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : w.deliveryStatus === WINNER_DELIVERY_STATUS.DELIVERED ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {isSavingThis ? 'Guardando...' : 'Guardar seguimiento'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
