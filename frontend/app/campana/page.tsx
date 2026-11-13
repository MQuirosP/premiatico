'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CampaignCountdown } from '@/components/campaign-countdown';
import { CampaignProgressBar } from '@/components/campaign-progress';
import { ComboSelector } from '@/components/combo-selector';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { formatCRC } from '@/lib/utils';
import { getPublicCampaignBySlug } from '@/services/campaigns';
import type { CampaignCombo } from '@/types/campaign';

function CampaignDetailContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') ?? '';
  const [selectedCombo, setSelectedCombo] = useState<CampaignCombo | null>(null);

  const { data: campaign, isLoading, isError } = useQuery({
    queryKey: ['public-campaign', slug],
    queryFn: () => getPublicCampaignBySlug(slug),
    enabled: Boolean(slug),
  });

  if (!slug) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <p className="text-slate-600">No se especificó ninguna campaña.</p>
        <Link href="/" className="text-blue-600 font-semibold hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-500">
        Cargando campaña...
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <p className="text-red-600 font-medium">No encontramos la campaña solicitada.</p>
        <Link href="/" className="text-blue-600 font-semibold hover:underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a campañas
          </Link>
        </div>

        <section className="rounded-3xl border bg-white p-6 sm:p-8 shadow-sm">
          <div
            className={
              campaign.coverImageUrl
                ? 'grid gap-8 lg:grid-cols-[380px_1fr] items-start'
                : 'space-y-5'
            }
          >
            {campaign.coverImageUrl ? (
              <div className="overflow-hidden rounded-2xl border bg-slate-900 shadow-md aspect-square">
                <img
                  src={campaign.coverImageUrl}
                  alt={campaign.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {campaign.category}
                </span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Vigente hasta el {new Date(campaign.endAt).toLocaleDateString('es-CR')}
                  </span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                {campaign.title}
              </h1>

              <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4 text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
                {campaign.description}
              </div>

              <CampaignCountdown
                endAt={campaign.endAt}
                drawAt={campaign.drawAt}
                drawReference={campaign.drawReference}
              />

              <CampaignProgressBar progress={campaign.progress} />
            </div>
          </div>
        </section>

        {campaign.prizes.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Premios de la campaña
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {campaign.prizes.map((prize) => (
                <div key={prize.id} className="rounded-2xl border bg-white p-5 shadow-sm space-y-2">
                  <h3 className="font-bold text-slate-900">{prize.name}</h3>
                  <p className="text-sm text-slate-600">{prize.description}</p>
                  {prize.estimatedValue ? (
                    <p className="text-xs font-semibold text-emerald-700">
                      Valor estimado: {formatCRC(prize.estimatedValue)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">1. Elegí tu combo</h2>
            <p className="text-sm text-slate-500">
              Seleccioná la cantidad de pases digitales que querés adquirir y recibí tus chances de regalo.
            </p>
          </div>

          <ComboSelector
            combos={campaign.combos}
            selectedComboId={selectedCombo?.id ?? null}
            onSelect={setSelectedCombo}
          />

          {selectedCombo ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-slate-900">
                  Combo seleccionado: {selectedCombo.name} ({formatCRC(selectedCombo.price)})
                </p>
                <p className="text-sm text-slate-600">
                  Incluye {selectedCombo.passQuantity} pases y {selectedCombo.chanceQuantity} chances de regalo (hasta {campaign.maxNumberChanges} cambios de números).
                </p>
              </div>
              <Link
                href={`/checkout?campaignId=${encodeURIComponent(campaign.id)}&comboId=${encodeURIComponent(selectedCombo.id)}`}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Descubrí tus chances
              </Link>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border bg-white p-6 space-y-2">
          <h2 className="text-base font-bold text-slate-900">Condiciones y reglamento</h2>
          <p className="text-xs text-slate-600 whitespace-pre-line">{campaign.terms}</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function CampaignPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
          Cargando...
        </div>
      }
    >
      <CampaignDetailContent />
    </Suspense>
  );
}
