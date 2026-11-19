'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Hash } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CampaignCountdown } from '@/components/campaign-countdown';
import { CampaignProgressBar } from '@/components/campaign-progress';
import { CampaignPublicGallery } from '@/components/campaign-public-gallery';
import { ComboSelector } from '@/components/combo-selector';
import { PackageFichasModal } from '@/components/package-fichas-modal';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { getCampaignTheme } from '@/lib/campaign-themes';
import { formatCRC } from '@/lib/utils';
import { getPublicCampaignBySlug } from '@/services/campaigns';
import type { CampaignCombo } from '@/types/campaign';

function CampaignDetailContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') ?? '';
  const [selectedCombo, setSelectedCombo] = useState<CampaignCombo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
      <div className="mx-auto max-w-5xl px-4 py-10">
        <DetailSkeleton />
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

  const theme = getCampaignTheme(campaign.themeColor);
  const safeTotalFichas = Math.max(10, Math.min(100000, Math.trunc(campaign.totalFichas)));
  const numberDigits = Math.min(5, Math.max(2, String(safeTotalFichas - 1).length));

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
              (campaign.galleryImages && campaign.galleryImages.length > 0) ||
              campaign.coverImageUrl
                ? 'grid gap-8 lg:grid-cols-[380px_1fr] items-start'
                : 'space-y-5'
            }
          >
            <CampaignPublicGallery
              title={campaign.title}
              coverImageUrl={campaign.coverImageUrl}
              galleryImages={campaign.galleryImages}
            />

            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {campaign.category}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    <Hash className="h-3.5 w-3.5 text-slate-500" />
                    Fichas de {numberDigits} dígitos
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Vigente hasta el{' '}
                    {new Date(campaign.drawAt ?? campaign.endAt).toLocaleDateString('es-CR')}
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
                themeColor={campaign.themeColor}
                countdownTitle={campaign.countdownTitle}
                prizes={campaign.prizes}
              />

              <CampaignProgressBar progress={campaign.progress} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">1. Elegí tu combo</h2>
            <p className="text-sm text-slate-500">
              Seleccioná la cantidad de pases digitales que querés adquirir y recibí tus fichas de regalo.
            </p>
          </div>

          <ComboSelector
            combos={campaign.combos}
            selectedComboId={selectedCombo?.id ?? null}
            themeColor={campaign.themeColor}
            onSelect={(combo) => {
              setSelectedCombo(combo);
              setModalOpen(true);
            }}
          />

          {selectedCombo ? (
            <div
              className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${theme.summaryBox}`}
            >
              <div>
                <p className="font-bold text-slate-900">
                  Combo seleccionado: {selectedCombo.name} ({formatCRC(selectedCombo.price)})
                </p>
                <p className="text-sm text-slate-600">
                  Incluye {selectedCombo.passQuantity} pases y {selectedCombo.fichaQuantity} fichas de regalo (hasta {campaign.maxNumberChanges} cambios de números).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className={`inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition ${theme.ctaButton}`}
              >
                Descubrí tus fichas
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border bg-white p-6 space-y-2">
          <h2 className="text-base font-bold text-slate-900">Condiciones y reglamento</h2>
          <p className="text-xs text-slate-600 whitespace-pre-line">{campaign.terms}</p>
        </section>
      </main>
      <PackageFichasModal
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        combo={selectedCombo}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
      <SiteFooter />
    </div>
  );
}

export default function CampaignPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-10">
          <DetailSkeleton />
        </div>
      }
    >
      <CampaignDetailContent />
    </Suspense>
  );
}
