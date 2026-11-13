'use client';

import { Clock, Flame } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function computeTimeLeft(targetIso: string): TimeLeft {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, expired: false };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function CampaignCountdown({
  endAt,
  drawAt,
  drawReference,
}: {
  endAt: string;
  drawAt?: string | null;
  drawReference?: string | null;
}) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTimeLeft(computeTimeLeft(endAt));
    const timer = window.setInterval(() => {
      setTimeLeft(computeTimeLeft(endAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endAt]);

  const units = [
    { label: 'Días', value: timeLeft ? pad2(timeLeft.days) : '--' },
    { label: 'Horas', value: timeLeft ? pad2(timeLeft.hours) : '--' },
    { label: 'Min', value: timeLeft ? pad2(timeLeft.minutes) : '--' },
    { label: 'Seg', value: timeLeft ? pad2(timeLeft.seconds) : '--' },
  ];

  const isUrgent = Boolean(timeLeft && !timeLeft.expired && timeLeft.days < 3);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 p-4 sm:p-5 text-white shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            {timeLeft?.expired ? (
              <span>Campaña finalizada</span>
            ) : isUrgent ? (
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                ¡Últimos días para participar!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-amber-300" />
                Cierre de participación en
              </span>
            )}
          </div>

          {drawAt || drawReference ? (
            <p className="text-xs text-blue-100/90">
              {drawAt ? `Juega el ${new Date(drawAt).toLocaleDateString('es-CR')}` : 'Sorteo'}
              {drawReference ? ` · ${drawReference}` : ''}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
          {units.map((unit) => (
            <div
              key={unit.label}
              className="flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm min-w-[58px]"
            >
              <span className="font-mono text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-white">
                {unit.value}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
                {unit.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
