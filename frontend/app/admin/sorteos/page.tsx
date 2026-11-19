'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Settings, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { PrizeEvaluationCard } from '@/components/admin/prize-evaluation-card';
import { SingleWinnerEvaluationCard } from '@/components/admin/single-winner-evaluation-card';
import { DetailSkeleton } from '@/components/ui/skeleton';
import {
  CAMPAIGN_DRAW_MODE,
  CAMPAIGN_STATUS,
  getCampaignStatusBadge,
} from '@/lib/domain-constants';
import {
  getAdminCampaignDetail,
  listAdminCampaigns,
  type AdminCampaignPrize,
} from '@/services/campaigns';

const SORTEOS_TAB = {
  PENDING: 'PENDING',
  EVALUATED: 'EVALUATED',
} as const;

type SorteosTab = (typeof SORTEOS_TAB)[keyof typeof SORTEOS_TAB];

function sortPrizesByDrawDate(prizes: AdminCampaignPrize[]): AdminCampaignPrize[] {
  return [...prizes].sort((a, b) => {
    const aTime = a.drawAt ? new Date(a.drawAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.drawAt ? new Date(b.drawAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return a.position - b.position;
  });
}

function AdminDrawsCenterInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const campaignIdParam = searchParams.get('campaignId') ?? '';
  const [activeTab, setActiveTab] = useState<SorteosTab>(SORTEOS_TAB.PENDING);

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: listAdminCampaigns,
  });

  const selectedCampaignId = useMemo(() => {
    if (!campaigns || campaigns.length === 0) return '';
    if (campaignIdParam && campaigns.some((c) => c.id === campaignIdParam)) {
      return campaignIdParam;
    }
    const preferred =
      campaigns.find((c) => c.status === CAMPAIGN_STATUS.ACTIVE) ??
      campaigns.find((c) => c.status === CAMPAIGN_STATUS.CLOSED) ??
      campaigns[0];
    return preferred?.id ?? '';
  }, [campaigns, campaignIdParam]);

  useEffect(() => {
    if (selectedCampaignId && selectedCampaignId !== campaignIdParam) {
      router.replace(`/admin/sorteos?campaignId=${encodeURIComponent(selectedCampaignId)}`);
    }
  }, [selectedCampaignId, campaignIdParam, router]);

  const { data: campaign, isLoading: loadingDetail } = useQuery({
    queryKey: ['admin-campaign-detail', selectedCampaignId],
    queryFn: () => getAdminCampaignDetail(selectedCampaignId),
    enabled: Boolean(selectedCampaignId),
  });

  if (loadingCampaigns) {
    return <DetailSkeleton />;
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center space-y-2">
        <Trophy className="mx-auto h-8 w-8 text-amber-500" />
        <h1 className="text-lg font-bold text-slate-900">Centro de Sorteos</h1>
        <p className="text-sm text-slate-500">
          Todavía no hay campañas creadas. Creá una campaña primero para gestionar sus sorteos.
        </p>
        <Link
          href="/admin/campanas"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Ir a Campañas
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const isSingleWinner =
    (campaign?.drawMode ?? CAMPAIGN_DRAW_MODE.SINGLE_WINNER) ===
    CAMPAIGN_DRAW_MODE.SINGLE_WINNER;
  const digits = campaign?.numberDigits ?? 5;
  const allPrizes = campaign?.prizes ?? [];
  const pendingPrizes = sortPrizesByDrawDate(allPrizes.filter((p) => !p.winnerEvaluatedAt));
  const evaluatedPrizes = sortPrizesByDrawDate(allPrizes.filter((p) => Boolean(p.winnerEvaluatedAt)));

  const hasPendingMainWinner = Boolean(isSingleWinner && campaign && !campaign.winnerResult);
  const hasEvaluatedMainWinner = Boolean(isSingleWinner && campaign && campaign.winnerResult);

  const pendingCount = pendingPrizes.length + (hasPendingMainWinner ? 1 : 0);
  const evaluatedCount = evaluatedPrizes.length + (hasEvaluatedMainWinner ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Encabezado del Centro de Sorteos */}
      <div className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Centro de Sorteos y Evaluaciones
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditá participantes elegibles, ejecutá sorteos en vivo, enviá notificaciones y
              revertí evaluaciones sin distracciones de edición.
            </p>
          </div>

          {campaign ? (
            <Link
              href={`/admin/campanas/detalle?id=${encodeURIComponent(campaign.id)}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Settings className="h-3.5 w-3.5" />
              Configurar campaña
            </Link>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Campaña seleccionada
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) =>
                router.replace(`/admin/sorteos?campaignId=${encodeURIComponent(e.target.value)}`)
              }
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              {campaigns.map((c) => {
                const badge = getCampaignStatusBadge(c.status);
                return (
                  <option key={c.id} value={c.id}>
                    {c.title} ({badge.label})
                  </option>
                );
              })}
            </select>
          </div>

          {campaign ? (
            <div className="flex flex-wrap items-center gap-2 pt-4 sm:pt-5">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  getCampaignStatusBadge(campaign.status).className
                }`}
              >
                {getCampaignStatusBadge(campaign.status).label}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {isSingleWinner ? 'Sorteo único + Flash' : 'Múltiples premios'}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Pestañas operativas */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab(SORTEOS_TAB.PENDING)}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === SORTEOS_TAB.PENDING
              ? 'bg-amber-500 text-slate-900 shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Por evaluar ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(SORTEOS_TAB.EVALUATED)}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === SORTEOS_TAB.EVALUATED
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Evaluados / Ganadores ({evaluatedCount})
        </button>
      </div>

      {loadingDetail || !campaign ? (
        <DetailSkeleton />
      ) : activeTab === SORTEOS_TAB.PENDING ? (
        <div className="space-y-4">
          {pendingPrizes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingPrizes.map((prize) => (
                <PrizeEvaluationCard
                  key={prize.id}
                  campaignId={campaign.id}
                  campaignStatus={campaign.status}
                  digits={digits}
                  prize={prize}
                />
              ))}
            </div>
          ) : null}

          {hasPendingMainWinner ? <SingleWinnerEvaluationCard campaign={campaign} /> : null}

          {pendingPrizes.length === 0 && !hasPendingMainWinner ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
              No hay sorteos pendientes por evaluar en esta campaña.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {hasEvaluatedMainWinner ? <SingleWinnerEvaluationCard campaign={campaign} /> : null}

          {evaluatedPrizes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {evaluatedPrizes.map((prize) => (
                <PrizeEvaluationCard
                  key={prize.id}
                  campaignId={campaign.id}
                  campaignStatus={campaign.status}
                  digits={digits}
                  prize={prize}
                />
              ))}
            </div>
          ) : !hasEvaluatedMainWinner ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
              Todavía no se ha evaluado ningún sorteo en esta campaña.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function AdminDrawsCenterPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AdminDrawsCenterInner />
    </Suspense>
  );
}
