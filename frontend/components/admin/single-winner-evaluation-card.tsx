'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, CheckCircle2, Loader2, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatCRC } from '@/lib/utils';
import {
  evaluateAdminCampaignWinner,
  resetAdminCampaignEvaluation,
  type AdminCampaignDetail,
  type CampaignWinnerResult,
} from '@/services/campaigns';

interface SingleWinnerEvaluationCardProps {
  campaign: AdminCampaignDetail;
}

export function SingleWinnerEvaluationCard({ campaign }: SingleWinnerEvaluationCardProps) {
  const queryClient = useQueryClient();
  const [winningNumber, setWinningNumber] = useState('');
  const [winnerNotes, setWinnerNotes] = useState('');
  const [evalError, setEvalError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<CampaignWinnerResult | null>(null);

  const digits = campaign.numberDigits ?? 5;
  const maxNumberLabel = String(Math.max(0, campaign.totalFichas - 1)).padStart(digits, '0');
  const activeWinnerResult = latestResult ?? campaign.winnerResult ?? null;
  const targetDrawDate = new Date(campaign.drawAt ?? campaign.endAt);
  const drawTimePending = !activeWinnerResult && targetDrawDate > new Date();

  const evaluateMutation = useMutation({
    mutationFn: () =>
      evaluateAdminCampaignWinner(campaign.id, {
        winningNumber: winningNumber.trim(),
        notes: winnerNotes.trim() || undefined,
      }),
    onSuccess: (result) => {
      setLatestResult(result);
      setEvalError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', campaign.id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: (err) => {
      setEvalError(err instanceof ApiError ? err.message : 'No se pudo evaluar el ganador');
    },
  });

  const resetEvaluationMutation = useMutation({
    mutationFn: () => resetAdminCampaignEvaluation(campaign.id),
    onSuccess: () => {
      setLatestResult(null);
      setWinningNumber('');
      setWinnerNotes('');
      setEvalError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', campaign.id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: (err) => {
      setEvalError(err instanceof ApiError ? err.message : 'No se pudo revertir la evaluación');
    },
  });

  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Premio Mayor — Sorteo único
          </h2>
          <p className="text-xs text-slate-500">
            Números de <strong>{digits} dígitos</strong> (rango{' '}
            <span className="font-mono">{'0'.repeat(digits)}</span> –{' '}
            <span className="font-mono">{maxNumberLabel}</span>). Digitá el número favorecido para
            identificar al ganador y cerrar la campaña.
          </p>
        </div>

        {activeWinnerResult ? (
          <button
            type="button"
            disabled={resetEvaluationMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  '¿Seguro que querés revertir la evaluación de esta campaña? Se borrará el número ganador y la campaña volverá a quedar activa/cerrada según su fecha de cierre.',
                )
              ) {
                resetEvaluationMutation.mutate();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {resetEvaluationMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            {resetEvaluationMutation.isPending ? 'Revirtiendo...' : 'Revertir evaluación'}
          </button>
        ) : null}
      </div>

      {drawTimePending ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          La evaluación del premio mayor se habilitará el{' '}
          <strong>{targetDrawDate.toLocaleString('es-CR')}</strong>.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            evaluateMutation.mutate();
          }}
          className="grid gap-3 sm:grid-cols-[160px_1fr_auto] items-end"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Número favorecido
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={digits}
              minLength={digits}
              required
              value={winningNumber}
              onChange={(e) =>
                setWinningNumber(e.target.value.replace(/\D/g, '').slice(0, digits))
              }
              placeholder={'0'.repeat(digits)}
              className="w-full rounded-lg border px-3 py-2 font-mono text-base font-bold tracking-widest"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nota / referencia del sorteo (opcional)
            </label>
            <input
              type="text"
              value={winnerNotes}
              onChange={(e) => setWinnerNotes(e.target.value)}
              placeholder="Ej. Sorteo #4820 Lotería Nacional"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={evaluateMutation.isPending || winningNumber.length !== digits}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
          >
            <Award className="h-4 w-4" />
            {evaluateMutation.isPending ? 'Evaluando...' : 'Evaluar ganador'}
          </button>
        </form>
      )}

      {evalError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {evalError}
        </div>
      ) : null}

      {activeWinnerResult ? (
        activeWinnerResult.winner ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Ganador encontrado — Número {activeWinnerResult.winningNumber}
              </span>
              <span className="text-xs text-emerald-700">
                Evaluado: {new Date(activeWinnerResult.evaluatedAt).toLocaleString('es-CR')}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 text-xs text-emerald-900">
              <div>
                <span className="block text-[11px] uppercase text-emerald-700">Cliente</span>
                <strong>{activeWinnerResult.winner.customer.fullName}</strong>
              </div>
              <div>
                <span className="block text-[11px] uppercase text-emerald-700">Contacto</span>
                <span>
                  {activeWinnerResult.winner.customer.phone} ·{' '}
                  {activeWinnerResult.winner.customer.email}
                </span>
              </div>
              <div>
                <span className="block text-[11px] uppercase text-emerald-700">Pedido</span>
                <span className="font-mono font-semibold">
                  {activeWinnerResult.winner.publicReference}
                </span>{' '}
                ({formatCRC(activeWinnerResult.winner.totalAmount)})
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                El número <strong>{activeWinnerResult.winningNumber}</strong> no pertenece a
                ninguna orden confirmada (premio desierto).
              </span>
            </div>
            <span className="text-[11px] text-amber-700">
              Evaluado: {new Date(activeWinnerResult.evaluatedAt).toLocaleString('es-CR')}
              {activeWinnerResult.notes ? ` · ${activeWinnerResult.notes}` : ''}
            </span>
          </div>
        )
      ) : null}
    </section>
  );
}
