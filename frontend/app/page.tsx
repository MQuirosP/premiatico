'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, Ticket } from 'lucide-react';
import Link from 'next/link';
import { CampaignProgressBar } from '@/components/campaign-progress';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { formatCRC } from '@/lib/utils';
import { listPublicCampaigns } from '@/services/campaigns';

export default function HomePage() {
  const { data: campaigns, isLoading, isError } = useQuery({
    queryKey: ['public-campaigns'],
    queryFn: listPublicCampaigns,
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <SiteHeader />

      <main className="flex-1">
        <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-16 px-4">
          <div className="mx-auto max-w-4xl text-center space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider">
              Costa Rica · ¡Más chances, más emoción!
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Elegí tu combo, descubrí tus chances y participá por grandes premios
            </h1>
            <p className="text-blue-100 text-lg max-w-2xl mx-auto">
              Adquirí tus pases digitales, recibí chances de regalo de 5 dígitos y pagá fácil con SINPE Móvil.
            </p>
          </div>
        </section>

        <section id="campanas" className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Campañas activas</h2>
          </div>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-72 animate-pulse rounded-2xl border bg-white p-5" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
              No pudimos cargar las campañas en este momento. Intentá recargar en unos segundos.
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              <Ticket className="h-10 w-10 mx-auto mb-3 text-slate-400" />
              <p className="font-medium text-slate-700">
                No hay campañas activas en este momento.
              </p>
              <p className="text-sm mt-1">
                Muy pronto publicaremos nuevas promociones. ¡Más chances, más emoción!
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => {
                const minPrice = campaign.combos.reduce(
                  (min, c) => (c.price < min ? c.price : min),
                  campaign.combos[0]?.price ?? 0,
                );
                return (
                  <article
                    key={campaign.id}
                    className="flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg"
                  >
                    <div>
                      {campaign.coverImageUrl ? (
                        <div className="aspect-[16/10] w-full overflow-hidden bg-slate-900">
                          <img
                            src={campaign.coverImageUrl}
                            alt={campaign.title}
                            className="h-full w-full object-cover transition duration-300 hover:scale-105"
                          />
                        </div>
                      ) : null}
                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            {campaign.category}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            Cierra {new Date(campaign.endAt).toLocaleDateString('es-CR')}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{campaign.title}</h3>
                          <p className="mt-1 line-clamp-3 text-sm text-slate-600 whitespace-pre-line">
                            {campaign.description}
                          </p>
                          {campaign.drawAt || campaign.drawReference ? (
                            <p className="mt-2 text-xs font-medium text-amber-700">
                              {campaign.drawAt
                                ? `Juega ${new Date(campaign.drawAt).toLocaleDateString('es-CR')}`
                                : 'Sorteo'}
                              {campaign.drawReference ? ` · ${campaign.drawReference}` : ''}
                            </p>
                          ) : null}
                        </div>

                        <CampaignProgressBar progress={campaign.progress} />
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-4 border-t flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">
                          Combos desde
                        </p>
                        <p className="text-lg font-extrabold text-slate-900">
                          {minPrice > 0 ? formatCRC(minPrice) : 'Consultar'}
                        </p>
                      </div>
                      <Link
                        href={`/campana?slug=${encodeURIComponent(campaign.slug)}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <span>Elegí tu combo</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
