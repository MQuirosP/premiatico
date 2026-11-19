'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, Calendar, Sparkles, Trophy, Zap } from 'lucide-react';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { formatCRC } from '@/lib/utils';
import { listPublicWinners } from '@/services/campaigns';

const SOURCE_META = {
  CAMPAIGN: {
    label: 'Campaña principal',
    badgeClass: 'bg-amber-100 text-amber-900',
    icon: Trophy,
  },
  FLASH: {
    label: 'Sorteo Flash',
    badgeClass: 'bg-purple-100 text-purple-800',
    icon: Zap,
  },
  PRIZE: {
    label: 'Dinámica / Premio',
    badgeClass: 'bg-blue-100 text-blue-800',
    icon: Award,
  },
} as const;

export default function GanadoresPage() {
  const { data: winners, isLoading, isError } = useQuery({
    queryKey: ['public-winners'],
    queryFn: listPublicWinners,
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-900">
            <Trophy className="h-3.5 w-3.5" />
            Últimos 5 ganadores
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Ganadores recientes
          </h1>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Resultados oficiales verificados de nuestras campañas principales y dinámicas flash.
          </p>
        </div>

        {isLoading ? (
          <CardGridSkeleton count={3} />
        ) : isError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 text-center">
            No pudimos cargar los ganadores en este momento. Intentá recargar en unos segundos.
          </div>
        ) : !winners || winners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
            <Sparkles className="h-9 w-9 mx-auto text-amber-500" />
            <p className="font-semibold text-slate-700">
              Aún no hay ganadores publicados recientemente.
            </p>
            <Link
              href="/#campanas"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95 transition"
            >
              Ver campañas activas
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {winners.map((winner) => {
              const meta = SOURCE_META[winner.sourceType];
              const Icon = meta.icon;
              return (
                <article
                  key={winner.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(winner.evaluatedAt).toLocaleString('es-CR', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900">{winner.winnerName}</h2>
                    <p className="text-sm text-slate-600">
                      <strong className="text-slate-800">{winner.prizeName}</strong>
                      {winner.sourceType !== 'CAMPAIGN' ? ` · ${winner.campaignTitle}` : ''}
                      {winner.estimatedValue && winner.estimatedValue > 0
                        ? ` (${formatCRC(winner.estimatedValue)})`
                        : ''}
                    </p>
                    {winner.drawReference ? (
                      <p className="text-xs font-medium text-blue-700">{winner.drawReference}</p>
                    ) : null}
                  </div>

                  <div className="shrink-0 flex flex-col items-start sm:items-end gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Número ganador
                    </span>
                    <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 font-mono text-2xl font-extrabold tracking-widest text-emerald-800">
                      {winner.winningNumber}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
