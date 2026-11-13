'use client';

import { Ticket, X } from 'lucide-react';
import { useEffect } from 'react';

export interface ChancesModalEntry {
  label: string;
  sublabel?: string;
  numbers: Array<{ number: string; status: string }>;
}

interface ChancesModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  entries: ChancesModalEntry[];
}

export function ChancesModal({ open, onClose, title, subtitle, entries }: ChancesModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-bold text-slate-900 text-base truncate">
              <Ticket className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="truncate">{title}</span>
            </h3>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No hay combos ni números asignados.
            </p>
          ) : (
            entries.map((entry, idx) => (
              <div key={`${entry.label}-${idx}`} className="rounded-xl border bg-slate-50/70 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">{entry.label}</span>
                  {entry.sublabel ? (
                    <span className="text-[11px] font-medium text-slate-500">{entry.sublabel}</span>
                  ) : null}
                </div>

                {entry.numbers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {entry.numbers.map((ch) => (
                      <span
                        key={`${ch.number}-${ch.status}`}
                        className={`rounded-md border px-2 py-1 font-mono text-xs font-bold ${
                          ch.status === 'CONFIRMED'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-amber-200 bg-amber-50 text-slate-800'
                        }`}
                        title={ch.status === 'CONFIRMED' ? 'Confirmado' : 'Reservado'}
                      >
                        {ch.number}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Sin números activos</p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end border-t bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
