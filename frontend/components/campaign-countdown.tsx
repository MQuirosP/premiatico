'use client';

import { Clock, Flame, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCampaignTheme } from '@/lib/campaign-themes';
import type { CampaignPrize } from '@/types/campaign';

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
  themeColor,
  countdownTitle,
  prizes,
}: {
  endAt: string;
  drawAt?: string | null;
  drawReference?: string | null;
  themeColor?: string | null;
  countdownTitle?: string | null;
  prizes?: CampaignPrize[];
}) {
  const theme = getCampaignTheme(themeColor);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const nextUpcomingPrize = (prizes ?? [])
    .filter((p) => !p.winnerEvaluatedAt && p.drawAt && new Date(p.drawAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.drawAt!).getTime() - new Date(b.drawAt!).getTime())[0];

  // El contador principal siempre mantiene la fecha oficial de la campaña.
  const targetAt = drawAt || endAt;
  const effectiveDrawDate = drawAt;
  const effectiveDrawRef = drawReference;
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [flashTimeLeft, setFlashTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const tick = () => {
      const current = Date.now();
      setNowMs(current);
      setTimeLeft(computeTimeLeft(targetAt));
      setFlashTimeLeft(
        nextUpcomingPrize?.drawAt ? computeTimeLeft(nextUpcomingPrize.drawAt) : null,
      );
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [targetAt, nextUpcomingPrize?.drawAt]);

  const units = [
    { label: 'Días', value: timeLeft ? pad2(timeLeft.days) : '--' },
    { label: 'Horas', value: timeLeft ? pad2(timeLeft.hours) : '--' },
    { label: 'Min', value: timeLeft ? pad2(timeLeft.minutes) : '--' },
    { label: 'Seg', value: timeLeft ? pad2(timeLeft.seconds) : '--' },
  ];

  const isUrgent = Boolean(timeLeft && !timeLeft.expired && timeLeft.days < 3);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 text-white shadow-md ${theme.countdownCard}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div
            className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${theme.countdownAccentText}`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            {timeLeft?.expired ? (
              <span>Campaña finalizada</span>
            ) : countdownTitle?.trim() ? (
              <span className="inline-flex items-center gap-1">
                <Flame className={`h-3.5 w-3.5 ${theme.countdownIconColor}`} />
                {countdownTitle.trim()}
              </span>
            ) : isUrgent ? (
              <span className="inline-flex items-center gap-1">
                <Flame className={`h-3.5 w-3.5 ${theme.countdownIconColor}`} />
                ¡Últimos días para participar!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Clock className={`h-3.5 w-3.5 ${theme.countdownAccentText}`} />
                Cierre de participación en
              </span>
            )}
          </div>

          {effectiveDrawDate || effectiveDrawRef ? (
            <p className={`text-xs ${theme.countdownSubText}`}>
              {effectiveDrawDate
                ? `Juega el ${new Date(effectiveDrawDate).toLocaleString('es-CR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}`
                : 'Sorteo'}
              {effectiveDrawRef ? ` · ${effectiveDrawRef}` : ''}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
          {units.map((unit) => (
            <div
              key={unit.label}
              className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 backdrop-blur-sm min-w-[58px] ${theme.countdownBox}`}
            >
              <span className="font-mono text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-white">
                {unit.value}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${theme.countdownAccentText}`}
              >
                {unit.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {nextUpcomingPrize && flashTimeLeft && !flashTimeLeft.expired ? (
        <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            Subcampaña en juego: <strong className="text-white">{nextUpcomingPrize.name}</strong>
          </span>
          <span className="font-mono text-[11px] font-bold text-white/90">
            {flashTimeLeft.days > 0 ? `${flashTimeLeft.days}d ` : ''}
            {pad2(flashTimeLeft.hours)}:{pad2(flashTimeLeft.minutes)}:{pad2(flashTimeLeft.seconds)}
            {nextUpcomingPrize.drawReference ? ` · ${nextUpcomingPrize.drawReference}` : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}
