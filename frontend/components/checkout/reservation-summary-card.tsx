'use client';

import { Clock, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatCRC } from '@/lib/utils';
import type { ReservationSessionData } from '@/services/checkout';

interface ReservationSummaryCardProps {
  session: ReservationSessionData | null;
  isReserving: boolean;
  isRegenerating: boolean;
  onRegenerate: () => void;
  onReserveAgain: () => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ReservationSummaryCard({
  session,
  isReserving,
  isRegenerating,
  onRegenerate,
  onReserveAgain,
}: ReservationSummaryCardProps) {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    session ? Math.max(0, new Date(session.expiresAt).getTime() - Date.now()) : 0,
  );

  useEffect(() => {
    if (!session) return;
    const update = () => {
      setRemainingMs(Math.max(0, new Date(session.expiresAt).getTime() - Date.now()));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const isExpired = Boolean(session && remainingMs <= 0);

  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Descubrí tus chances</h1>
          {session ? (
            <p className="text-sm text-slate-500">
              {session.comboName} · {formatCRC(session.price)}
            </p>
          ) : null}
        </div>
        {session ? (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
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
            {!isExpired ? (
              <button
                type="button"
                disabled={session.remainingChanges <= 0 || isRegenerating}
                onClick={onRegenerate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                Cambiá tus números ({session.remainingChanges} restantes)
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isReserving || !session ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Generando tus números aleatorios...
        </div>
      ) : isExpired ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center space-y-3">
          <p className="text-sm font-medium text-red-800">
            El tiempo de tu reserva expiró y los números fueron liberados.
          </p>
          <button
            type="button"
            onClick={onReserveAgain}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reservar nuevos números
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {session.numbers.map((num) => (
            <div
              key={num}
              className="rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-center font-mono text-base font-extrabold text-slate-900"
            >
              {num}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
