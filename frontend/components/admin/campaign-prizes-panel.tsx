'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Calendar, CheckCircle2, Dices, Plus, Trash2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatCRC } from '@/lib/utils';
import {
  createAdminPrizes,
  deleteAdminPrize,
  drawRandomAdminPrizeWinner,
  evaluateAdminPrizeWinner,
  type AdminCampaignPrize,
} from '@/services/campaigns';

interface CampaignPrizesPanelProps {
  campaignId: string;
  campaignStatus: string;
  digits: number;
  maxNumberLabel: string;
  prizes: AdminCampaignPrize[];
}

export function CampaignPrizesPanel({
  campaignId,
  campaignStatus,
  digits,
  maxNumberLabel,
  prizes,
}: CampaignPrizesPanelProps) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [drawReference, setDrawReference] = useState('');
  const [drawAt, setDrawAt] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [activePrizeId, setActivePrizeId] = useState<string | null>(null);
  const [winningNumber, setWinningNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [allowDuplicateOrder, setAllowDuplicateOrder] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', campaignId] });

  const createMutation = useMutation({
    mutationFn: createAdminPrizes,
    onSuccess: () => {
      setShowAddForm(false);
      setName('');
      setDescription('');
      setEstimatedValue('');
      setDrawReference('');
      setDrawAt('');
      setQuantity(1);
      setErrorMsg(null);
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudieron crear los premios');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminPrize,
    onSuccess: () => {
      setErrorMsg(null);
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo eliminar el premio');
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: ({
      prizeId,
      payload,
    }: {
      prizeId: string;
      payload: { winningNumber: string; notes?: string; allowDuplicateOrder?: boolean };
    }) => evaluateAdminPrizeWinner(prizeId, payload),
    onSuccess: () => {
      setActivePrizeId(null);
      setWinningNumber('');
      setNotes('');
      setAllowDuplicateOrder(false);
      setErrorMsg(null);
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo evaluar este sorteo');
    },
  });

  const drawRandomMutation = useMutation({
    mutationFn: ({
      prizeId,
      payload,
    }: {
      prizeId: string;
      payload: { notes?: string; allowDuplicateOrder?: boolean };
    }) => drawRandomAdminPrizeWinner(prizeId, payload),
    onSuccess: () => {
      setActivePrizeId(null);
      setWinningNumber('');
      setNotes('');
      setAllowDuplicateOrder(false);
      setErrorMsg(null);
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo realizar el sorteo al azar');
    },
  });

  const canDelete = campaignStatus !== 'CLOSED' && campaignStatus !== 'COMPLETED';

  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Premios y sorteos individuales ({prizes.length})
          </h2>
          <p className="text-xs text-slate-500">
            Creá uno o varios sorteos dentro de la campaña (ej. 6 de Nacional + 6 de Tiempos) y
            evaluá cada ganador por separado con números de <strong>{digits} dígitos</strong> (
            <span className="font-mono">{'0'.repeat(digits)}</span> –{' '}
            <span className="font-mono">{maxNumberLabel}</span>).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar premios / sorteos
        </button>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {showAddForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              campaignId,
              name,
              description,
              estimatedValue: estimatedValue ? Number(estimatedValue) : null,
              drawReference: drawReference.trim() || null,
              drawAt: drawAt ? new Date(drawAt).toISOString() : null,
              quantity,
            });
          }}
          className="rounded-xl border bg-slate-50 p-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre del premio
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Premio Lotería Nacional"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sorteo de referencia
              </label>
              <input
                value={drawReference}
                onChange={(e) => setDrawReference(e.target.value)}
                placeholder="Ej. Tiempos Mediodía / Nacional"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Fecha / hora del sorteo
              </label>
              <input
                type="datetime-local"
                value={drawAt}
                onChange={(e) => setDrawAt(e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Monto / valor estimado (CRC)
              </label>
              <input
                type="number"
                min={0}
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="3000000"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cantidad a crear (lote)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Descripción
              </label>
              <input
                required
                minLength={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. ₡3,000,000 en efectivo con la Lotería Nacional"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {createMutation.isPending
                ? 'Creando...'
                : quantity > 1
                  ? `Crear ${quantity} premios`
                  : 'Guardar premio'}
            </button>
          </div>
        </form>
      ) : null}

      {prizes.length === 0 ? (
        <p className="text-xs text-slate-500">
          No hay premios individuales configurados aún. Agregalos aquí para evaluar múltiples
          sorteos en esta campaña.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {prizes.map((prize) => {
            const isEvaluating = activePrizeId === prize.id;
            const isEvaluated = Boolean(prize.winningNumber && prize.winnerEvaluatedAt);
            const isBeforeDrawAt = Boolean(
              prize.drawAt && new Date(prize.drawAt).getTime() > Date.now(),
            );

            return (
              <div
                key={prize.id}
                className="rounded-xl border bg-slate-50/70 p-4 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{prize.name}</h3>
                      <p className="text-xs text-slate-600">{prize.description}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isEvaluated
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isEvaluated ? `Ganador: ${prize.winningNumber}` : 'Pendiente'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    {prize.drawReference ? (
                      <span className="font-semibold text-blue-700">{prize.drawReference}</span>
                    ) : null}
                    {prize.drawAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(prize.drawAt).toLocaleString('es-CR')}
                      </span>
                    ) : null}
                    {prize.estimatedValue ? (
                      <span className="font-semibold text-emerald-700">
                        {formatCRC(prize.estimatedValue)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {isEvaluated ? (
                  <div
                    className={`rounded-lg border p-3 text-xs space-y-1 ${
                      prize.winningOrder
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Número {prize.winningNumber}
                      </span>
                      <span className="text-[11px] opacity-80">
                        {new Date(prize.winnerEvaluatedAt!).toLocaleString('es-CR')}
                      </span>
                    </div>
                    {prize.winningOrder ? (
                      <div className="space-y-0.5">
                        <p className="font-semibold">
                          {prize.winningOrder.customer.fullName} ·{' '}
                          <span className="font-mono">{prize.winningOrder.publicReference}</span>
                        </p>
                        <p className="text-[11px]">
                          {prize.winningOrder.customer.phone} · {prize.winningOrder.customer.email}
                        </p>
                      </div>
                    ) : (
                      <p>Número desierto (no vendido/confirmado).</p>
                    )}
                    {prize.winnerNotes ? (
                      <p className="text-[11px] italic">{prize.winnerNotes}</p>
                    ) : null}
                  </div>
                ) : null}

                {isEvaluating ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      evaluateMutation.mutate({
                        prizeId: prize.id,
                        payload: {
                          winningNumber,
                          notes: notes.trim() || undefined,
                          allowDuplicateOrder,
                        },
                      });
                    }}
                    className="rounded-lg border bg-white p-3 space-y-2.5"
                  >
                    <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        minLength={digits}
                        maxLength={digits}
                        value={winningNumber}
                        onChange={(e) =>
                          setWinningNumber(e.target.value.replace(/\D/g, '').slice(0, digits))
                        }
                        placeholder={'0'.repeat(digits)}
                        className="w-full rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold tracking-widest"
                      />
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Nota opcional (ej. 1er premio)"
                        className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={allowDuplicateOrder}
                        onChange={(e) => setAllowDuplicateOrder(e.target.checked)}
                      />
                      Permitir si este pedido ya ganó otro premio de la campaña
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePrizeId(null)}
                        className="rounded-lg border px-2.5 py-1 text-xs text-slate-600"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={drawRandomMutation.isPending || evaluateMutation.isPending}
                        onClick={() =>
                          drawRandomMutation.mutate({
                            prizeId: prize.id,
                            payload: {
                              notes: notes.trim() || undefined,
                              allowDuplicateOrder,
                            },
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        <Dices className="h-3.5 w-3.5" />
                        {drawRandomMutation.isPending ? 'Sorteando...' : 'Sortear al azar'}
                      </button>
                      <button
                        type="submit"
                        disabled={
                          evaluateMutation.isPending ||
                          drawRandomMutation.isPending ||
                          winningNumber.length !== digits
                        }
                        className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                      >
                        {evaluateMutation.isPending ? 'Evaluando...' : 'Evaluar número'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {isBeforeDrawAt ? (
                      <span className="text-[11px] font-medium text-slate-500">
                        Evaluación habilitada el{' '}
                        {new Date(prize.drawAt!).toLocaleString('es-CR')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActivePrizeId(prize.id);
                          setWinningNumber(prize.winningNumber ?? '');
                          setNotes(prize.winnerNotes ?? '');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        {isEvaluated ? 'Re-evaluar' : 'Evaluar ganador'}
                      </button>
                    )}
                    {canDelete && !isEvaluated ? (
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(prize.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
