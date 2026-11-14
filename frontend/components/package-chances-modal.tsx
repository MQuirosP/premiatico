'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, Clock, RefreshCw, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatCRC } from '@/lib/utils';
import {
  addInversePackageRequest,
  createReservationRequest,
  regenerateNumbersRequest,
  type InverseOffer,
  type ReservationSessionData,
} from '@/services/checkout';
import type { CampaignCombo } from '@/types/campaign';

interface PackageChancesModalProps {
  campaignId: string;
  campaignTitle: string;
  combo: CampaignCombo | null;
  open: boolean;
  onClose: () => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function PackageChancesModal({
  campaignId,
  campaignTitle,
  combo,
  open,
  onClose,
}: PackageChancesModalProps) {
  const router = useRouter();
  const [session, setSession] = useState<ReservationSessionData | null>(null);
  const [selectedInverseSource, setSelectedInverseSource] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);

  const storageKey = combo ? `premiatico_res_${campaignId}_${combo.id}` : '';

  const saveSession = (next: ReservationSessionData) => {
    setSession(next);
    if (storageKey) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
    }
  };

  const reserveMutation = useMutation({
    mutationFn: createReservationRequest,
    onSuccess: (data) => {
      saveSession(data);
      setErrorMsg(null);
      setSelectedInverseSource(data.availableInverses[0]?.sourceNumber ?? '');
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No pudimos reservar tus chances');
    },
  });

  const regenMutation = useMutation({
    mutationFn: regenerateNumbersRequest,
    onSuccess: (data) => {
      if (!session) return;
      const updated: ReservationSessionData = {
        ...session,
        ...data,
      };
      saveSession(updated);
      setErrorMsg(null);
      setSelectedInverseSource(data.availableInverses[0]?.sourceNumber ?? '');
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No pudimos cambiar tus números');
    },
  });

  const addInverseMutation = useMutation({
    mutationFn: addInversePackageRequest,
    onSuccess: (data) => {
      if (!session) return;
      const updated: ReservationSessionData = {
        ...session,
        ...data,
      };
      saveSession(updated);
      setErrorMsg(null);
      setSelectedInverseSource(data.availableInverses[0]?.sourceNumber ?? '');
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No pudimos agregar el número inverso');
    },
  });

  useEffect(() => {
    if (!open || !combo || !campaignId) return;

    setErrorMsg(null);
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ReservationSessionData;
        if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now()) {
          setSession(parsed);
          setSelectedInverseSource(parsed.availableInverses?.[0]?.sourceNumber ?? '');
          return;
        }
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // ignore
    }

    setSession(null);
    reserveMutation.mutate({ campaignId, comboId: combo.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, combo?.id, campaignId]);

  useEffect(() => {
    if (!session) {
      setRemainingMs(0);
      return;
    }
    const update = () => {
      setRemainingMs(Math.max(0, new Date(session.expiresAt).getTime() - Date.now()));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !combo) return null;

  const isExpired = Boolean(session && remainingMs <= 0);
  const availableInverses: InverseOffer[] = session?.availableInverses ?? [];
  const activeOffer =
    availableInverses.find((o) => o.sourceNumber === selectedInverseSource) ??
    availableInverses[0] ??
    null;

  const addedInverseNumbers = new Set(
    (session?.inverseAdditions ?? []).map((item) => item.inverseNumber),
  );
  const inverseSourceNumbers = new Set(
    availableInverses.map((item) => item.sourceNumber),
  );

  const isBusy =
    reserveMutation.isPending || regenMutation.isPending || addInverseMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-chances-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-1 pr-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Tu paquete · {campaignTitle}
          </p>
          <h2 id="package-chances-modal-title" className="text-2xl font-extrabold text-slate-900">
            Estos son tus chances
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>
              {session ? `${session.passQuantity}` : combo.passQuantity}{' '}
              {(session?.passQuantity ?? combo.passQuantity) === 1
                ? 'pase digital'
                : 'pases digitales'}{' '}
              · {session ? session.chanceQuantity : combo.chanceQuantity} chances
              {session && session.packageCount > 1
                ? ` (${session.packageCount} paquetes)`
                : ''}
            </span>
            <span>·</span>
            <span className="font-extrabold text-slate-900">
              {formatCRC(session?.price ?? combo.price)}
            </span>
            {session ? (
              <span
                className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isExpired
                    ? 'bg-red-100 text-red-700'
                    : remainingMs <= 120_000
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {isExpired ? 'Expirada' : formatRemaining(remainingMs)}
              </span>
            ) : null}
          </div>
        </div>

        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {reserveMutation.isPending || !session ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Generando tus números aleatorios disponibles...
          </div>
        ) : isExpired ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center space-y-3">
            <p className="text-sm font-medium text-red-800">
              El tiempo de tu reserva expiró y los números fueron liberados.
            </p>
            <button
              type="button"
              onClick={() => reserveMutation.mutate({ campaignId, comboId: combo.id })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reservar nuevos números
            </button>
          </div>
        ) : (
          <>
            {/* Assigned numbers */}
            <div className="flex flex-wrap gap-2">
              {session.numbers.map((num) => {
                const isAddedInverse = addedInverseNumbers.has(num);
                const hasOffer = inverseSourceNumbers.has(num);
                const isSelectedSource = activeOffer?.sourceNumber === num;

                return (
                  <button
                    key={num}
                    type="button"
                    disabled={!hasOffer}
                    onClick={() => {
                      if (hasOffer) setSelectedInverseSource(num);
                    }}
                    className={`rounded-xl border px-3.5 py-2 font-mono text-sm font-extrabold transition ${
                      isSelectedSource
                        ? 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-400/30'
                        : isAddedInverse
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : hasOffer
                            ? 'border-blue-300 bg-blue-50/70 text-blue-800 hover:border-amber-400'
                            : 'border-slate-200 bg-slate-50 text-slate-800 cursor-default'
                    }`}
                    title={
                      hasOffer
                        ? 'Este número tiene su inverso disponible'
                        : isAddedInverse
                          ? 'Número inverso agregado'
                          : undefined
                    }
                  >
                    {num}
                    {isAddedInverse ? (
                      <span className="ml-1.5 text-[10px] font-sans font-bold uppercase text-emerald-700">
                        Inv.
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Inverse offer */}
            {session.enableInverseNumbers && activeOffer ? (
              <div className="rounded-2xl border border-blue-200 bg-slate-50/90 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 text-xs sm:text-sm text-slate-700">
                    <p>
                      El chance{' '}
                      <strong className="font-mono text-blue-700">
                        {activeOffer.sourceNumber}
                      </strong>{' '}
                      tiene su inverso{' '}
                      <strong className="font-mono text-blue-700">
                        {activeOffer.inverseNumber}
                      </strong>{' '}
                      disponible. Al agregarlo se suma otro paquete completo y el total pasa a{' '}
                      <strong className="text-slate-900">
                        {formatCRC(session.price + session.unitPrice)}
                      </strong>
                      .
                    </p>
                  </div>
                </div>

                {availableInverses.length > 1 ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Elegí a cuál número querés agregarle su inverso:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableInverses.map((offer) => {
                        const selected = offer.sourceNumber === activeOffer.sourceNumber;
                        return (
                          <button
                            key={offer.sourceNumber}
                            type="button"
                            onClick={() => setSelectedInverseSource(offer.sourceNumber)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                              selected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                            }`}
                          >
                            {offer.sourceNumber} → {offer.inverseNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    addInverseMutation.mutate({
                      sessionId: session.sessionId,
                      sessionToken: session.sessionToken,
                      sourceNumber: activeOffer.sourceNumber,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  {addInverseMutation.isPending
                    ? 'Agregando inverso...'
                    : `Agregar inverso ${activeOffer.inverseNumber}`}
                </button>
              </div>
            ) : null}

            {/* Change numbers */}
            <div className="space-y-2.5 pt-1">
              <p className="text-xs text-slate-500">
                Oportunidades para cambiar:{' '}
                <strong className="text-slate-700">
                  {session.remainingChanges} de {session.maxNumberChanges}
                </strong>
              </p>
              <button
                type="button"
                disabled={session.remainingChanges <= 0 || isBusy}
                onClick={() =>
                  regenMutation.mutate({
                    sessionId: session.sessionId,
                    sessionToken: session.sessionToken,
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                <RefreshCw
                  className={`h-4 w-4 ${regenMutation.isPending ? 'animate-spin' : ''}`}
                />
                {regenMutation.isPending ? 'Generando otros números...' : 'Seleccionar otros'}
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  onClose();
                  router.push(
                    `/checkout?campaignId=${encodeURIComponent(campaignId)}&comboId=${encodeURIComponent(combo.id)}`,
                  );
                }}
                className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition"
              >
                Confirmar y pasar al checkout ({formatCRC(session.price)})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
