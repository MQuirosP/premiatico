'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, Calendar, CheckCircle2, ExternalLink, Eye, Loader2, Pencil, RotateCcw, ShieldCheck, Ticket, Trophy, Users, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CampaignImagesCarouselEditor } from '@/components/admin/campaign-images-carousel';
import { CampaignPrizesPanel } from '@/components/admin/campaign-prizes-panel';
import { CampaignThemePicker } from '@/components/admin/campaign-theme-picker';
import { CampaignProgressBar } from '@/components/campaign-progress';
import { FichasModal, type FichasModalEntry } from '@/components/fichas-modal';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import {
  CAMPAIGN_DRAW_MODE,
  CAMPAIGN_STATUS,
  DRAW_MODE_OPTIONS,
  ORDER_STATUS_LABELS,
  getCampaignStatusBadge,
  getLegalStatusBadge,
  isCampaignReadOnly,
  type OrderStatus,
} from '@/lib/domain-constants';
import { formatCRC } from '@/lib/utils';
import { cancelAdminOrder, evaluateAdminCampaignWinner, getAdminCampaignDetail, resetAdminCampaignEvaluation, updateAdminCampaign, uploadAdminCampaignCover, type CampaignWinnerResult } from '@/services/campaigns';
import type { CampaignGalleryImage } from '@/types/campaign';

const ORDER_STATUS_LABEL = ORDER_STATUS_LABELS as Record<string, string>;

function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CampaignDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const queryClient = useQueryClient();
  const [winningNumber, setWinningNumber] = useState('');
  const [winnerNotes, setWinnerNotes] = useState('');
  const [evalError, setEvalError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<CampaignWinnerResult | null>(null);
  const [selectedFichas, setSelectedFichas] = useState<{
    title: string;
    subtitle: string;
    entries: FichasModalEntry[];
  } | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<{
    id: string;
    publicReference: string;
    channel?: 'WEB' | 'PARTNER';
    partnerCode?: string | null;
    customerName: string;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: campaign, isLoading, isError } = useQuery({
    queryKey: ['admin-campaign-detail', id],
    queryFn: () => getAdminCampaignDetail(id),
    enabled: Boolean(id),
  });

  const evaluateMutation = useMutation({
    mutationFn: (payload: { winningNumber: string; notes?: string }) =>
      evaluateAdminCampaignWinner(id, payload),
    onSuccess: (result) => {
      setEvalError(null);
      setLatestResult(result);
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: (err) => {
      setEvalError(err instanceof ApiError ? err.message : 'No se pudo evaluar el número ganador');
    },
  });

  const resetEvaluationMutation = useMutation({
    mutationFn: () => resetAdminCampaignEvaluation(id),
    onSuccess: () => {
      setEvalError(null);
      setLatestResult(null);
      setWinningNumber('');
      setWinnerNotes('');
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: (err) => {
      setEvalError(
        err instanceof ApiError ? err.message : 'No se pudo revertir la evaluación de la campaña',
      );
    },
  });

  const toggleInverseMutation = useMutation({
    mutationFn: (nextValue: boolean) =>
      updateAdminCampaign(id, { enableInverseNumbers: nextValue }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
    },
  });

  const updateThemeMutation = useMutation({
    mutationFn: (nextTheme: string) => updateAdminCampaign(id, { themeColor: nextTheme }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
    },
  });

  const updateDrawModeMutation = useMutation({
    mutationFn: (nextMode: 'SINGLE_WINNER' | 'MULTI_PRIZE') =>
      updateAdminCampaign(id, { drawMode: nextMode }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
    },
  });

  const [galleryImages, setGalleryImages] = useState<CampaignGalleryImage[]>([]);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTerms, setEditTerms] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editDrawAt, setEditDrawAt] = useState('');
  const [editDrawReference, setEditDrawReference] = useState('');
  const [editCountdownTitle, setEditCountdownTitle] = useState('');
  const [editInfoError, setEditInfoError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaign) return;
    if (campaign.galleryImages && campaign.galleryImages.length > 0) {
      setGalleryImages(campaign.galleryImages);
    } else if (campaign.coverImageKey) {
      setGalleryImages([
        {
          id: 'cover',
          key: campaign.coverImageKey,
          url: campaign.coverImageUrl ?? null,
          isCover: true,
          sortOrder: 0,
        },
      ]);
    } else {
      setGalleryImages([]);
    }
  }, [campaign]);

  const updateGalleryMutation = useMutation({
    mutationFn: (nextImages: CampaignGalleryImage[]) =>
      updateAdminCampaign(id, {
        galleryImages: nextImages.map((img) => ({
          imageKey: img.key,
          isCover: img.isCover,
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
  });

  const updateInfoMutation = useMutation({
    mutationFn: () =>
      updateAdminCampaign(id, {
        title: editTitle.trim(),
        category: editCategory.trim(),
        description: editDescription.trim(),
        terms: editTerms.trim() || undefined,
        endAt: editEndAt ? new Date(editEndAt).toISOString() : undefined,
        drawAt: editDrawAt ? new Date(editDrawAt).toISOString() : null,
        drawReference: editDrawReference.trim() || null,
        countdownTitle: editCountdownTitle.trim() || null,
      }),
    onSuccess: () => {
      setEditingInfo(false);
      setEditInfoError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: (err) => {
      setEditInfoError(
        err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios',
      );
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (payload: { orderId: string; reason?: string }) =>
      cancelAdminOrder(payload.orderId, payload.reason),
    onSuccess: () => {
      setCancelError(null);
      setOrderToCancel(null);
      setCancelReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
    },
    onError: (err) => {
      setCancelError(err instanceof ApiError ? err.message : 'No se pudo anular la orden');
    },
  });

  if (!id) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/campanas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a campañas
        </Link>
        <p className="text-sm text-slate-500">No se especificó ninguna campaña.</p>
      </div>
    );
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (isError || !campaign) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/campanas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a campañas
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar la campaña solicitada.
        </div>
      </div>
    );
  }

  const combos = campaign.combos ?? [];
  const orders = campaign.orders ?? [];
  const digits = campaign.numberDigits ?? 5;
  const maxNumberLabel = String(Math.max(0, campaign.totalFichas - 1)).padStart(digits, '0');
  const activeWinnerResult = latestResult ?? campaign.winnerResult ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/campanas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a campañas
        </Link>

        {campaign.status === 'ACTIVE' ? (
          <Link
            href={`/campana?slug=${encodeURIComponent(campaign.slug)}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
          >
            Ver página pública <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      {/* 1. Resumen de campaña (sin imagen suelta) */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        {(() => {
          const statusBadge = getCampaignStatusBadge(campaign.status);
          const legalBadge = getLegalStatusBadge(campaign.legalApprovalStatus);
          return (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{campaign.title}</h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}
                >
                  {statusBadge.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${legalBadge.className}`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Legal: {legalBadge.label}
                  {campaign.legalApprovalReference ? ` (${campaign.legalApprovalReference})` : ''}
                </span>
              </div>
              {!isCampaignReadOnly(campaign.status) && !editingInfo ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(campaign.title);
                    setEditCategory(campaign.category);
                    setEditDescription(campaign.description);
                    setEditTerms(campaign.terms ?? '');
                    setEditEndAt(toLocalDateTimeInput(campaign.endAt));
                    setEditDrawAt(toLocalDateTimeInput(campaign.drawAt));
                    setEditDrawReference(campaign.drawReference ?? '');
                    setEditCountdownTitle(campaign.countdownTitle ?? '');
                    setEditInfoError(null);
                    setEditingInfo(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar información y fechas
                </button>
              ) : null}
            </div>
          );
        })()}

        {editingInfo ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateInfoMutation.mutate();
            }}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Título de la campaña
                </label>
                <input
                  required
                  minLength={3}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Categoría
                </label>
                <input
                  required
                  minLength={2}
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Título personalizado del contador (opcional)
                </label>
                <input
                  maxLength={120}
                  value={editCountdownTitle}
                  onChange={(e) => setEditCountdownTitle(e.target.value)}
                  placeholder="Ej. 2 PALITOS CIERRA EN..."
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Sorteo de referencia
                </label>
                <input
                  value={editDrawReference}
                  onChange={(e) => setEditDrawReference(e.target.value)}
                  placeholder="Ej. Lotería Nacional JPS"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cierre de ventas
                </label>
                <input
                  required
                  type="datetime-local"
                  value={editEndAt}
                  onChange={(e) => setEditEndAt(e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Fecha y hora del sorteo
                </label>
                <input
                  type="datetime-local"
                  value={editDrawAt}
                  onChange={(e) => setEditDrawAt(e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Descripción
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Términos y condiciones
                </label>
                <textarea
                  rows={3}
                  value={editTerms}
                  onChange={(e) => setEditTerms(e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            {editInfoError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {editInfoError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingInfo(false);
                  setEditInfoError(null);
                }}
                className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateInfoMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {updateInfoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Guardar cambios
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm text-slate-600 whitespace-pre-line">{campaign.description}</p>

            {campaign.countdownTitle ? (
              <p className="text-xs font-medium text-slate-500">
                Título del contador:{' '}
                <span className="font-semibold text-slate-800">{campaign.countdownTitle}</span>
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3 text-xs text-slate-600">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] uppercase text-slate-400">Cierre de ventas</span>
                <span className="mt-0.5 inline-flex items-center gap-1 font-semibold text-slate-800">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(campaign.endAt).toLocaleString('es-CR')}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] uppercase text-slate-400">Fecha de sorteo</span>
                <span className="mt-0.5 block font-semibold text-slate-800">
                  {campaign.drawAt ? new Date(campaign.drawAt).toLocaleString('es-CR') : 'Sin definir'}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] uppercase text-slate-400">Sorteo</span>
                <span className="mt-0.5 block font-semibold text-slate-800">
                  {campaign.drawReference || 'No especificado'}
                </span>
              </div>
            </div>
          </>
        )}

        <CampaignProgressBar progress={campaign.progress} showAvailable />
      </section>

      {/* 2. Galería y portada */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
        <CampaignImagesCarouselEditor
          images={galleryImages}
          disabled={updateGalleryMutation.isPending || isCampaignReadOnly(campaign.status)}
          onUploadFile={(file) => uploadAdminCampaignCover(file)}
          onChange={(nextImages) => {
            setGalleryImages(nextImages);
            updateGalleryMutation.mutate(nextImages);
          }}
        />
        {updateGalleryMutation.isPending ? (
          <p className="text-[11px] font-semibold text-blue-600">Guardando galería...</p>
        ) : null}
      </section>

      {/* 3. Apariencia y reglas de compra */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Apariencia y reglas de compra</h2>
          <p className="text-xs text-slate-500">
            Personalizá los colores de la campaña y las opciones disponibles para el comprador.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-800">Paleta de color de la campaña</p>
              <p className="text-[11px] text-slate-500">
                Aplica de forma agrupada al contador, cards de combos, chip destacado y botón.
              </p>
            </div>
            {updateThemeMutation.isPending ? (
              <span className="text-[11px] font-semibold text-blue-600">Guardando...</span>
            ) : null}
          </div>
          <CampaignThemePicker
            value={campaign.themeColor ?? 'classic'}
            disabled={updateThemeMutation.isPending || isCampaignReadOnly(campaign.status)}
            onChange={(nextTheme) => updateThemeMutation.mutate(nextTheme)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <div>
            <p className="text-xs font-bold text-slate-800">Oferta de números inversos</p>
            <p className="text-[11px] text-slate-500">
              Permite al comprador agregar el número inverso disponible sumando otro paquete completo.
            </p>
          </div>
          <button
            type="button"
            disabled={toggleInverseMutation.isPending || isCampaignReadOnly(campaign.status)}
            onClick={() => toggleInverseMutation.mutate(!campaign.enableInverseNumbers)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
              campaign.enableInverseNumbers
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {campaign.enableInverseNumbers ? 'Habilitado' : 'Deshabilitado'}
          </button>
        </div>
      </section>

      {/* 4. Sorteo y ganadores (modalidad encima de la sección correspondiente) */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Modalidad de sorteo y ganadores</h2>
            <p className="text-xs text-slate-500">
              Elegí si la campaña tendrá un único ganador o varios premios/sorteos evaluados por separado.
            </p>
          </div>
          {updateDrawModeMutation.isPending ? (
            <span className="text-[11px] font-semibold text-blue-600">Guardando...</span>
          ) : null}
        </div>
        {(() => {
          const currentDrawMode = campaign.drawMode ?? CAMPAIGN_DRAW_MODE.SINGLE_WINNER;
          const hasEvaluatedWinner =
            Boolean(activeWinnerResult) ||
            (campaign.prizes?.some((p) => Boolean(p.winnerEvaluatedAt)) ?? false);
          const modeLocked =
            updateDrawModeMutation.isPending ||
            isCampaignReadOnly(campaign.status) ||
            hasEvaluatedWinner;
          return (
            <div className="grid gap-3 sm:grid-cols-2">
              {DRAW_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={modeLocked}
                  onClick={() => updateDrawModeMutation.mutate(opt.value)}
                  aria-pressed={currentDrawMode === opt.value}
                  className={`rounded-xl border p-3.5 text-left transition disabled:opacity-60 ${
                    currentDrawMode === opt.value
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{opt.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{opt.detailDescription}</p>
                </button>
              ))}
            </div>
          );
        })()}
      </section>

      {(campaign.drawMode ?? CAMPAIGN_DRAW_MODE.SINGLE_WINNER) === CAMPAIGN_DRAW_MODE.MULTI_PRIZE ? (
        <CampaignPrizesPanel
          campaignId={campaign.id}
          campaignStatus={campaign.status}
          drawMode={campaign.drawMode ?? CAMPAIGN_DRAW_MODE.MULTI_PRIZE}
          digits={digits}
          maxNumberLabel={maxNumberLabel}
          prizes={campaign.prizes ?? []}
          combos={combos}
        />
      ) : (
        <>
        <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        {(() => {
          const targetDrawDate = new Date(campaign.drawAt ?? campaign.endAt);
          const drawTimePending = !activeWinnerResult && targetDrawDate > new Date();
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Evaluación de sorteo y ganador
                  </h2>
                  <p className="text-xs text-slate-500">
                    Esta campaña usa números de <strong>{digits} dígitos</strong> (rango{' '}
                    <span className="font-mono">{'0'.repeat(digits)}</span> –{' '}
                    <span className="font-mono">{maxNumberLabel}</span>). Digitá el número favorecido para
                    identificar al ganador automáticamente.
                  </p>
                </div>
                {activeWinnerResult ? (
                  <button
                    type="button"
                    disabled={resetEvaluationMutation.isPending}
                    onClick={() => resetEvaluationMutation.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition"
                  >
                    {resetEvaluationMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    {resetEvaluationMutation.isPending ? 'Revirtiendo...' : 'Revertir evaluación'}
                  </button>
                ) : null}
              </div>

              {drawTimePending ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
                  Este sorteo está programado para el{' '}
                  <strong>
                    {targetDrawDate.toLocaleString('es-CR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </strong>{' '}
                  y aún no se puede evaluar.
                </div>
              ) : null}

              {!activeWinnerResult ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setEvalError(null);
                    evaluateMutation.mutate({
                      winningNumber,
                      notes: winnerNotes.trim() || undefined,
                    });
                  }}
                  className="grid gap-3 sm:grid-cols-[180px_1fr_auto] items-end"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Número ganador ({digits} dígitos)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      disabled={drawTimePending}
                      minLength={digits}
                      maxLength={digits}
                      value={winningNumber}
                      onChange={(e) =>
                        setWinningNumber(e.target.value.replace(/\D/g, '').slice(0, digits))
                      }
                      placeholder={'0'.repeat(digits)}
                      className="w-full rounded-lg border px-3 py-2 font-mono text-base font-bold tracking-widest text-slate-900 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Nota / referencia del sorteo (opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={500}
                      disabled={drawTimePending}
                      value={winnerNotes}
                      onChange={(e) => setWinnerNotes(e.target.value)}
                      placeholder="Ej. Sorteo JPS #4821 — Premio mayor"
                      className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      drawTimePending ||
                      evaluateMutation.isPending ||
                      winningNumber.length !== digits
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition"
                  >
                    {evaluateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Award className="h-4 w-4" />
                    )}
                    {evaluateMutation.isPending ? 'Evaluando...' : 'Evaluar ganador'}
                  </button>
                </form>
              ) : null}
            </>
          );
        })()}

        {evalError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {evalError}
          </div>
        ) : null}

        {activeWinnerResult ? (
          activeWinnerResult.winner ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ¡Ganador confirmado para el número{' '}
                  <span className="rounded bg-white px-2 py-0.5 font-mono text-base border border-emerald-200">
                    {activeWinnerResult.winningNumber}
                  </span>
                  !
                </div>
                <span className="text-[11px] text-emerald-700">
                  Evaluado: {new Date(activeWinnerResult.evaluatedAt).toLocaleString('es-CR')}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded-lg bg-white p-3 border border-emerald-100">
                  <span className="block text-[11px] uppercase text-slate-400">Ganador</span>
                  <span className="mt-0.5 block font-bold text-slate-900">
                    {activeWinnerResult.winner.customer.fullName}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-3 border border-emerald-100">
                  <span className="block text-[11px] uppercase text-slate-400">Contacto</span>
                  <span className="mt-0.5 block font-semibold text-slate-800">
                    {activeWinnerResult.winner.customer.phone}
                  </span>
                  <span className="block text-slate-500">
                    {activeWinnerResult.winner.customer.email}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-3 border border-emerald-100">
                  <span className="block text-[11px] uppercase text-slate-400">Orden y combo</span>
                  <span className="mt-0.5 block font-mono font-bold text-slate-900">
                    {activeWinnerResult.winner.publicReference}
                  </span>
                  <span className="block text-slate-500">
                    {activeWinnerResult.winner.comboNames.join(', ') || 'Combo'} ·{' '}
                    {formatCRC(activeWinnerResult.winner.totalAmount)}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-3 border border-emerald-100">
                  <span className="block text-[11px] uppercase text-slate-400">Confirmación</span>
                  <span className="mt-0.5 block font-semibold text-slate-800">
                    {activeWinnerResult.winner.confirmedAt
                      ? new Date(activeWinnerResult.winner.confirmedAt).toLocaleString('es-CR')
                      : 'Confirmada'}
                  </span>
                  {activeWinnerResult.notes ? (
                    <span className="block text-slate-500 mt-0.5">{activeWinnerResult.notes}</span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <XCircle className="h-4 w-4 text-amber-600" />
                El número{' '}
                <span className="rounded bg-white px-2 py-0.5 font-mono text-sm border border-amber-200">
                  {activeWinnerResult.winningNumber}
                </span>{' '}
                no tiene un comprador confirmado (quedó desierto).
              </div>
              <span className="text-[11px] text-amber-700">
                Evaluado: {new Date(activeWinnerResult.evaluatedAt).toLocaleString('es-CR')}
                {activeWinnerResult.notes ? ` · ${activeWinnerResult.notes}` : ''}
              </span>
            </div>
          )
        ) : null}
      </section>
      <CampaignPrizesPanel
        campaignId={campaign.id}
        campaignStatus={campaign.status}
        drawMode={CAMPAIGN_DRAW_MODE.SINGLE_WINNER}
        digits={digits}
        maxNumberLabel={maxNumberLabel}
        prizes={campaign.prizes ?? []}
        combos={combos}
      />
      </>
      )}

      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-amber-500" />
          Combos y pases digitales ({combos.length})
        </h2>

        {combos.length === 0 ? (
          <p className="text-sm text-slate-500">Esta campaña no tiene combos activos.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {combos.map((combo) => (
              <div key={combo.id} className="rounded-xl border bg-slate-50/70 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{combo.name}</span>
                  <span className="font-extrabold text-blue-700">{formatCRC(combo.price)}</span>
                </div>
                <p className="text-slate-600">
                  {combo.passQuantity} pases · {combo.fichaQuantity} fichas de regalo
                </p>
                {combo.passItems && combo.passItems.length > 0 ? (
                  <div className="pt-1 border-t space-y-1">
                    {combo.passItems.map((pi) => (
                      <div key={pi.id} className="text-[11px] text-emerald-700 font-medium">
                        Pase vinculado: {pi.digitalPass.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pt-1 border-t text-[11px] text-amber-700">
                    Sin pase digital vinculado
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            Órdenes y clientes participantes ({orders.length})
          </h2>
        </div>

        {orders.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            Aún no hay órdenes registradas en esta campaña.
          </div>
        ) : (
          <>
            <div className="divide-y sm:hidden">
              {orders.map((order) => {
                const items = order.items ?? [];
                const participations = order.participations ?? [];
                const comboLabel = items.map((i) => i.comboNameSnapshot).join(', ') || '—';
                return (
                  <div key={order.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-sm text-slate-900">
                          {order.publicReference}
                        </div>
                        <div className="text-xs font-medium text-slate-800">
                          {order.customer?.fullName ?? '—'}
                        </div>
                        <div className="text-xs text-slate-500 break-all">
                          {order.customer?.phone ?? '—'} · {order.customer?.email ?? '—'}
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 whitespace-nowrap shrink-0">
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Combo:</span> {comboLabel}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCRC(order.totalAmount)}
                      </span>
                      <div className="flex items-center gap-2">
                        {participations.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedFichas({
                                title: `${order.publicReference} · ${order.customer?.fullName ?? 'Cliente'}`,
                                subtitle: campaign.title,
                                entries: [
                                  {
                                    label: items.map((i) => i.comboNameSnapshot).join(', ') || 'Combo',
                                    sublabel: `${participations.length} fichas`,
                                    numbers: participations,
                                  },
                                ],
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver ({participations.length})
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Sin números</span>
                        )}
                        {campaign.status === 'ACTIVE' &&
                          order.status !== 'CANCELLED' &&
                          order.status !== 'REJECTED' &&
                          order.status !== 'EXPIRED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelError(null);
                                setCancelReason('');
                                setOrderToCancel({
                                  id: order.id,
                                  publicReference: order.publicReference,
                                  channel: order.channel,
                                  partnerCode: order.partnerCode,
                                  customerName: order.customer?.fullName ?? 'Cliente',
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Anular
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Combo</th>
                    <th className="px-4 py-3">Fichas</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => {
                    const items = order.items ?? [];
                    const participations = order.participations ?? [];
                    return (
                      <tr key={order.id}>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {order.publicReference}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 whitespace-nowrap">
                            {order.customer?.fullName ?? '—'}
                          </div>
                          <div className="text-xs text-slate-500 whitespace-nowrap">
                            {order.customer?.phone ?? '—'} · {order.customer?.email ?? '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          {items.map((i) => i.comboNameSnapshot).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {participations.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedFichas({
                                  title: `${order.publicReference} · ${order.customer?.fullName ?? 'Cliente'}`,
                                  subtitle: campaign.title,
                                  entries: [
                                    {
                                      label: items.map((i) => i.comboNameSnapshot).join(', ') || 'Combo',
                                      sublabel: `${participations.length} fichas`,
                                      numbers: participations,
                                    },
                                  ],
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver ({participations.length})
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Sin números</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">
                          {formatCRC(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                          {ORDER_STATUS_LABEL[order.status] ?? order.status}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {campaign.status === 'ACTIVE' &&
                          order.status !== 'CANCELLED' &&
                          order.status !== 'REJECTED' &&
                          order.status !== 'EXPIRED' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelError(null);
                                setCancelReason('');
                                setOrderToCancel({
                                  id: order.id,
                                  publicReference: order.publicReference,
                                  channel: order.channel,
                                  partnerCode: order.partnerCode,
                                  customerName: order.customer?.fullName ?? 'Cliente',
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Anular
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <FichasModal
        open={Boolean(selectedFichas)}
        onClose={() => setSelectedFichas(null)}
        title={selectedFichas?.title ?? ''}
        subtitle={selectedFichas?.subtitle}
        entries={selectedFichas?.entries ?? []}
      />

      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Anular orden {orderToCancel.publicReference}
            </h3>
            <p className="text-sm text-slate-600">
              Cliente: <span className="font-semibold text-slate-900">{orderToCancel.customerName}</span>.
              Esta acción cancelará la orden y liberará los números asignados.
            </p>

            {orderToCancel.channel === 'PARTNER' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Esta orden proviene de <strong>{orderToCancel.partnerCode ?? 'PARTNER'}</strong>.
                Anularla aquí liberará los números en Premiático, pero si el tiquete sigue activo en Bancas
                debes anularlo también allá para revertir crédito y estado de cuenta.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Motivo (opcional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: Anulado en Bancas / solicitud del cliente"
                maxLength={250}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {cancelError && (
              <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                {cancelError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={cancelOrderMutation.isPending}
                onClick={() => setOrderToCancel(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={cancelOrderMutation.isPending}
                onClick={() =>
                  cancelOrderMutation.mutate({
                    orderId: orderToCancel.id,
                    reason: cancelReason.trim() || undefined,
                  })
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelOrderMutation.isPending ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCampaignDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <CampaignDetailInner />
    </Suspense>
  );
}
