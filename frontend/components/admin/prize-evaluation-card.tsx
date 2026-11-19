'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Dices,
  Loader2,
  Mail,
  MessageCircle,
  RotateCcw,
  Share2,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { CAMPAIGN_STATUS } from '@/lib/domain-constants';
import { buildPrizeWinnerMessage, getPrizeRuleBadges, normalizeCostaRicaPhone } from '@/lib/prize-helpers';
import { formatCRC } from '@/lib/utils';
import {
  drawRandomAdminPrizeWinner,
  evaluateAdminPrizeWinner,
  getAdminPrizeEligibleSummary,
  notifyAdminPrizeWinnerEmail,
  resetAdminPrizeEvaluation,
  type AdminCampaignPrize,
  type PrizeEligibleSummary,
} from '@/services/campaigns';

interface PrizeEvaluationCardProps {
  campaignId: string;
  campaignStatus: string;
  digits: number;
  prize: AdminCampaignPrize;
}

export function PrizeEvaluationCard({
  campaignId,
  campaignStatus,
  digits,
  prize,
}: PrizeEvaluationCardProps) {
  const isEvaluationClosed =
    campaignStatus === CAMPAIGN_STATUS.COMPLETED || campaignStatus === CAMPAIGN_STATUS.CANCELLED;
  const queryClient = useQueryClient();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [winningNumber, setWinningNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [allowDuplicateOrder, setAllowDuplicateOrder] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [eligiblePreview, setEligiblePreview] = useState<PrizeEligibleSummary | null>(null);
  const [emailFeedback, setEmailFeedback] = useState<{
    status: 'sent' | 'already_sent' | 'info' | 'error';
    message: string;
  } | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', campaignId] });

  const previewMutation = useMutation({
    mutationFn: () => getAdminPrizeEligibleSummary(prize.id, allowDuplicateOrder),
    onSuccess: (summary) => {
      setEligiblePreview(summary);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiError ? err.message : 'No se pudo calcular la lista de elegibles',
      );
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: (payload: { winningNumber: string; notes?: string; allowDuplicateOrder?: boolean }) =>
      evaluateAdminPrizeWinner(prize.id, payload),
    onSuccess: () => {
      setIsEvaluating(false);
      setWinningNumber('');
      setNotes('');
      setAllowDuplicateOrder(false);
      setErrorMsg(null);
      setStatusMsg('Ganador evaluado correctamente.');
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo evaluar este sorteo');
    },
  });

  const drawRandomMutation = useMutation({
    mutationFn: (payload: { notes?: string; allowDuplicateOrder?: boolean }) =>
      drawRandomAdminPrizeWinner(prize.id, payload),
    onSuccess: () => {
      setIsEvaluating(false);
      setWinningNumber('');
      setNotes('');
      setAllowDuplicateOrder(false);
      setErrorMsg(null);
      setStatusMsg('Sorteo aleatorio completado.');
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo realizar el sorteo al azar');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetAdminPrizeEvaluation(prize.id),
    onSuccess: () => {
      setIsEvaluating(false);
      setWinningNumber('');
      setNotes('');
      setErrorMsg(null);
      setStatusMsg('Evaluación revertida. El premio volvió a estado pendiente.');
      void refresh();
    },
    onError: (err) => {
      setStatusMsg(null);
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo revertir la evaluación');
    },
  });

  const notifyEmailMutation = useMutation({
    mutationFn: (forceResend: boolean) => notifyAdminPrizeWinnerEmail(prize.id, forceResend),
    onSuccess: (res) => {
      setErrorMsg(null);
      if (res.sent) {
        setEmailFeedback({
          status: 'sent',
          message: `Correo de ganador enviado a ${res.recipientEmail}.`,
        });
      } else if (res.skippedReason === 'RESEND_NOT_CONFIGURED') {
        setEmailFeedback({
          status: 'info',
          message: `El servicio automático de correo no está configurado. Podés usar "Abrir en correo" o WhatsApp para ${res.recipientEmail}.`,
        });
      } else if (res.skippedReason === 'ALREADY_SENT') {
        setEmailFeedback({
          status: 'already_sent',
          message: `Ya se había enviado la notificación por correo a ${res.recipientEmail}.`,
        });
      } else {
        setEmailFeedback({
          status: 'error',
          message: res.errorMessage || 'No se pudo enviar el correo al ganador',
        });
      }
    },
    onError: (err) => {
      setEmailFeedback({
        status: 'error',
        message: err instanceof ApiError ? err.message : 'No se pudo notificar por correo',
      });
    },
  });

  const handleNativeShare = async () => {
    const message = buildPrizeWinnerMessage(prize);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Ganador ${prize.name} — Premiático`, text: message });
        return;
      } catch {
        // usuario canceló o no soportado
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(message);
      setStatusMsg('Mensaje del ganador copiado al portapapeles.');
    }
  };

  const isEvaluated = Boolean(prize.winnerEvaluatedAt);
  const drawAtMs = prize.drawAt ? new Date(prize.drawAt).getTime() : null;
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (isEvaluated || !drawAtMs || drawAtMs <= Date.now()) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= drawAtMs) {
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isEvaluated, drawAtMs]);

  const isBeforeDrawAt = Boolean(!isEvaluated && drawAtMs && drawAtMs > nowMs);
  const remainingSec = isBeforeDrawAt && drawAtMs ? Math.max(0, Math.ceil((drawAtMs - nowMs) / 1000)) : 0;
  const remainingLabel =
    remainingSec > 0 && remainingSec < 86400
      ? `${String(Math.floor(remainingSec / 3600)).padStart(2, '0')}:${String(
          Math.floor((remainingSec % 3600) / 60),
        ).padStart(2, '0')}:${String(remainingSec % 60).padStart(2, '0')}`
      : null;
  const showDirectEvalForm = !isEvaluated && !isEvaluationClosed && !isBeforeDrawAt;
  const badges = getPrizeRuleBadges(prize);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3 flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">{prize.name}</h3>
            <p className="text-xs text-slate-600">{prize.description}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isEvaluated
                ? 'bg-emerald-100 text-emerald-800'
                : isBeforeDrawAt
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isEvaluated
              ? `Ganador: ${prize.winningNumber}`
              : isBeforeDrawAt
                ? 'Programado'
                : 'Listo para evaluar'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
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
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-full px-2 py-0.5 font-semibold ${badge.className}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {statusMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {statusMsg}
        </div>
      ) : null}

      {isEvaluated ? (
        <div
          className={`rounded-lg border p-3 text-xs space-y-2 ${
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
            <div className="space-y-2">
              <div>
                <p className="font-semibold">
                  {prize.winningOrder.customer.fullName} ·{' '}
                  <span className="font-mono">{prize.winningOrder.publicReference}</span>
                </p>
                <p className="text-[11px]">
                  {prize.winningOrder.customer.phone} · {prize.winningOrder.customer.email}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <a
                  href={`https://wa.me/${normalizeCostaRicaPhone(
                    prize.winningOrder.customer.phone,
                  )}?text=${encodeURIComponent(buildPrizeWinnerMessage(prize))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => void handleNativeShare()}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <Share2 className="h-3 w-3" />
                  Compartir
                </button>
                <button
                  type="button"
                  disabled={notifyEmailMutation.isPending}
                  onClick={() => notifyEmailMutation.mutate(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
                >
                  {notifyEmailMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Mail className="h-3 w-3" />
                  )}
                  {notifyEmailMutation.isPending ? 'Enviando...' : 'Enviar correo'}
                </button>
                <a
                  href={`mailto:${prize.winningOrder.customer.email}?subject=${encodeURIComponent(
                    `¡Ganaste ${prize.name} en Premiático!`,
                  )}&body=${encodeURIComponent(buildPrizeWinnerMessage(prize))}`}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Mail className="h-3 w-3" />
                  Abrir en correo
                </a>
              </div>

              {emailFeedback ? (
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                    emailFeedback.status === 'error'
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : emailFeedback.status === 'already_sent'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-emerald-300 bg-white/90 text-emerald-900'
                  }`}
                >
                  <span>{emailFeedback.message}</span>
                  {emailFeedback.status === 'already_sent' ? (
                    <button
                      type="button"
                      disabled={notifyEmailMutation.isPending}
                      onClick={() => notifyEmailMutation.mutate(true)}
                      className="rounded border border-amber-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Reenviar correo
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px]">Número desierto (no vendido/confirmado).</p>
          )}
        </div>
      ) : null}

      {isEvaluating || showDirectEvalForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            evaluateMutation.mutate({
              winningNumber,
              notes: notes.trim() || undefined,
              allowDuplicateOrder,
            });
          }}
          className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5"
        >
          <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
            <input
              type="text"
              inputMode="numeric"
              required
              minLength={digits}
              maxLength={digits}
              value={winningNumber}
              onChange={(e) => setWinningNumber(e.target.value.replace(/\D/g, '').slice(0, digits))}
              placeholder={'0'.repeat(digits)}
              className="w-full rounded-lg border bg-white px-2.5 py-1.5 font-mono text-sm font-bold tracking-widest"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nota opcional (ej. 1er premio)"
              className="w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs"
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
          <div className="flex flex-wrap justify-between items-center gap-2">
            {!isEvaluated ? (
              <button
                type="button"
                disabled={previewMutation.isPending}
                onClick={() => previewMutation.mutate()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 active:scale-95 transition"
              >
                {previewMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Users className="h-3.5 w-3.5" />
                )}
                {previewMutation.isPending ? 'Calculando...' : 'Ver elegibles'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {isEvaluated ? (
                <button
                  type="button"
                  onClick={() => setIsEvaluating(false)}
                  className="rounded-lg border bg-white px-2.5 py-1 text-xs text-slate-600 active:scale-95 transition"
                >
                  Cancelar
                </button>
              ) : null}
              <button
                type="button"
                disabled={drawRandomMutation.isPending || evaluateMutation.isPending}
                onClick={() =>
                  drawRandomMutation.mutate({
                    notes: notes.trim() || undefined,
                    allowDuplicateOrder,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 active:scale-95 transition"
              >
                {drawRandomMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Dices className="h-3.5 w-3.5" />
                )}
                {drawRandomMutation.isPending ? 'Sorteando...' : 'Sortear al azar'}
              </button>
              <button
                type="submit"
                disabled={
                  evaluateMutation.isPending ||
                  drawRandomMutation.isPending ||
                  winningNumber.length !== digits
                }
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60 active:scale-95 transition"
              >
                {evaluateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {evaluateMutation.isPending ? 'Evaluando...' : 'Evaluar número'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isEvaluationClosed ? (
            <span className="text-[11px] font-medium text-slate-500">
              Campaña {campaignStatus === CAMPAIGN_STATUS.CANCELLED ? 'cancelada' : 'completada'}
            </span>
          ) : isBeforeDrawAt ? (
            <span className="text-[11px] font-medium text-slate-500">
              {remainingLabel
                ? `Se habilita en ${remainingLabel}`
                : `Evaluación habilitada el ${new Date(prize.drawAt!).toLocaleString('es-CR')}`}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsEvaluating(true);
                setWinningNumber(prize.winningNumber ?? '');
                setNotes(prize.winnerNotes ?? '');
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200 active:scale-95 transition"
            >
              <Trophy className="h-3.5 w-3.5" />
              {isEvaluated ? 'Re-evaluar' : 'Evaluar ganador'}
            </button>
          )}

          {isEvaluated ? (
            <button
              type="button"
              disabled={resetMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `¿Seguro que querés revertir la evaluación de "${prize.name}"? Quedará como pendiente sin ganador.`,
                  )
                ) {
                  resetMutation.mutate();
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 active:scale-95 transition"
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {resetMutation.isPending ? 'Revirtiendo...' : 'Revertir evaluación'}
            </button>
          ) : (
            <button
              type="button"
              disabled={previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 active:scale-95 transition"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              {previewMutation.isPending ? 'Calculando...' : 'Ver elegibles'}
            </button>
          )}
        </div>
      )}

      {eligiblePreview ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-800">Elegibles para este sorteo</span>
            <button
              type="button"
              onClick={() => setEligiblePreview(null)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-white p-1.5 border border-slate-100">
              <span className="block text-[10px] text-slate-500">Fichas elegibles</span>
              <span className="font-bold text-slate-900">
                {eligiblePreview.eligibleTicketsCount}
              </span>
            </div>
            <div className="rounded-md bg-white p-1.5 border border-slate-100">
              <span className="block text-[10px] text-slate-500">Clientes únicos</span>
              <span className="font-bold text-emerald-700">
                {eligiblePreview.eligibleCustomersCount}
              </span>
            </div>
            <div className="rounded-md bg-white p-1.5 border border-slate-100">
              <span className="block text-[10px] text-slate-500">Excluidas</span>
              <span className="font-bold text-slate-600">{eligiblePreview.excludedCount}</span>
            </div>
          </div>
          {eligiblePreview.eligibleCustomers.length > 0 ? (
            <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 rounded border border-slate-200 bg-white">
              {eligiblePreview.eligibleCustomers.map((c) => (
                <div
                  key={c.customerId}
                  className="flex items-center justify-between px-2 py-1 text-[11px]"
                >
                  <span className="font-medium text-slate-700 truncate">
                    {c.customerName} ({c.phone})
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {c.ticketCount} {c.ticketCount === 1 ? 'ficha' : 'fichas'} ·{' '}
                    {formatCRC(c.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-amber-700">
              Ningún participante cumple los criterios configurados todavía.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
