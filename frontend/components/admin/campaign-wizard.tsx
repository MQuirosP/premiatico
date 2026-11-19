'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Loader2,
  Lock,
  Save,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { CampaignDetailCombosPanel } from '@/components/admin/campaign-detail-combos-panel';
import { CampaignImagesCarouselEditor } from '@/components/admin/campaign-images-carousel';
import { CampaignPrizesBuilder } from '@/components/admin/campaign-prizes-builder';
import { CampaignThemePicker } from '@/components/admin/campaign-theme-picker';
import { ApiError } from '@/lib/api';
import type { CampaignThemeColor } from '@/lib/campaign-themes';
import {
  CAMPAIGN_DRAW_MODE,
  DRAW_MODE_OPTIONS,
  LEGAL_APPROVAL_STATUS,
  isCampaignReadOnly,
  type CampaignDrawMode,
} from '@/lib/domain-constants';
import {
  createAdminCampaign,
  getAdminCampaignDetail,
  updateAdminCampaign,
  uploadAdminCampaignCover,
  type AdminCampaignDetail,
} from '@/services/campaigns';
import type { CampaignGalleryImage } from '@/types/campaign';

export const WIZARD_STEP = {
  GENERAL: 'GENERAL',
  TOKENS_MODE: 'TOKENS_MODE',
  APPEARANCE: 'APPEARANCE',
  COMBOS: 'COMBOS',
  PRIZES: 'PRIZES',
  ORDERS: 'ORDERS',
} as const;

export type WizardStep = (typeof WIZARD_STEP)[keyof typeof WIZARD_STEP];

const CONSTRUCTION_STEPS: Array<{ id: WizardStep; number: number; label: string }> = [
  { id: WIZARD_STEP.GENERAL, number: 1, label: 'General y Fechas' },
  { id: WIZARD_STEP.TOKENS_MODE, number: 2, label: 'Fichas y Modalidad' },
  { id: WIZARD_STEP.APPEARANCE, number: 3, label: 'Apariencia y Galería' },
  { id: WIZARD_STEP.COMBOS, number: 4, label: 'Combos y Pases' },
  { id: WIZARD_STEP.PRIZES, number: 5, label: 'Diseño de Sorteos' },
];

function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CampaignWizardProps {
  /** Si se omite, el wizard arranca en modo creación guiada (5 pasos). */
  campaign?: AdminCampaignDetail | null;
  /** Panel opcional de Pedidos (solo visible en modo edición). */
  ordersSlot?: ReactNode;
  ordersCount?: number;
  onCancelCreate?: () => void;
  onFinishCreate?: (campaignId: string) => void;
}

export function CampaignWizard({
  campaign: initialCampaign = null,
  ordersSlot,
  ordersCount = 0,
  onCancelCreate,
  onFinishCreate,
}: CampaignWizardProps) {
  const queryClient = useQueryClient();
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<WizardStep>(WIZARD_STEP.GENERAL);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const { data: createdCampaign } = useQuery({
    queryKey: ['admin-campaign-detail', createdCampaignId],
    queryFn: () => getAdminCampaignDetail(createdCampaignId!),
    enabled: Boolean(createdCampaignId && !initialCampaign),
  });

  const activeCampaign = initialCampaign ?? createdCampaign ?? null;
  const isEditMode = Boolean(activeCampaign);
  const isReadOnly = activeCampaign ? isCampaignReadOnly(activeCampaign.status) : false;

  // Campos del wizard
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Vehículos');
  const [description, setDescription] = useState('');
  const [terms, setTerms] = useState('Aplican restricciones. Promoción válida en Costa Rica.');
  const [endAt, setEndAt] = useState('');
  const [drawAt, setDrawAt] = useState('');
  const [drawReference, setDrawReference] = useState('');
  const [countdownTitle, setCountdownTitle] = useState('');

  const [totalFichas, setTotalFichas] = useState(10000);
  const [maxNumberChanges, setMaxNumberChanges] = useState(5);
  const [enableInverseNumbers, setEnableInverseNumbers] = useState(false);
  const [drawMode, setDrawMode] = useState<CampaignDrawMode>(CAMPAIGN_DRAW_MODE.SINGLE_WINNER);
  const [themeColor, setThemeColor] = useState<CampaignThemeColor>('classic');
  const [galleryImages, setGalleryImages] = useState<CampaignGalleryImage[]>([]);

  useEffect(() => {
    if (!activeCampaign) return;
    setSlug(activeCampaign.slug);
    setTitle(activeCampaign.title);
    setCategory(activeCampaign.category);
    setDescription(activeCampaign.description);
    setTerms(activeCampaign.terms ?? '');
    setEndAt(toLocalDateTimeInput(activeCampaign.endAt));
    setDrawAt(toLocalDateTimeInput(activeCampaign.drawAt));
    setDrawReference(activeCampaign.drawReference ?? '');
    setCountdownTitle(activeCampaign.countdownTitle ?? '');
    setTotalFichas(activeCampaign.totalFichas);
    setMaxNumberChanges(activeCampaign.maxNumberChanges);
    setEnableInverseNumbers(activeCampaign.enableInverseNumbers);
    setDrawMode(activeCampaign.drawMode ?? CAMPAIGN_DRAW_MODE.SINGLE_WINNER);
    setThemeColor((activeCampaign.themeColor as CampaignThemeColor) ?? 'classic');

    if (activeCampaign.galleryImages && activeCampaign.galleryImages.length > 0) {
      setGalleryImages(activeCampaign.galleryImages);
    } else if (activeCampaign.coverImageKey) {
      setGalleryImages([
        {
          id: 'cover',
          key: activeCampaign.coverImageKey,
          url: activeCampaign.coverImageUrl ?? null,
          isCover: true,
          sortOrder: 0,
        },
      ]);
    } else {
      setGalleryImages([]);
    }
  }, [activeCampaign]);

  const invalidateCampaign = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', id] });
    void queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
  };

  const createDraftMutation = useMutation({
    mutationFn: () => {
      const now = new Date();
      const drawIso = drawAt ? new Date(drawAt).toISOString() : null;
      const resolvedEndAt = endAt
        ? new Date(endAt).toISOString()
        : (drawIso ?? new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString());
      const coverKey =
        galleryImages.find((img) => img.isCover)?.key ?? galleryImages[0]?.key ?? null;

      return createAdminCampaign({
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        startAt: now.toISOString(),
        endAt: resolvedEndAt,
        drawAt: drawIso,
        drawReference: drawReference.trim() || null,
        coverImageKey: coverKey,
        galleryImages: galleryImages.map((img) => ({
          imageKey: img.key,
          isCover: img.isCover,
        })),
        totalFichas,
        maxNumberChanges,
        enableInverseNumbers,
        themeColor,
        countdownTitle: countdownTitle.trim() || null,
        drawMode,
        requiresLegalApproval: true,
        legalApprovalStatus: LEGAL_APPROVAL_STATUS.PENDING,
        terms: terms.trim() || 'Aplican restricciones. Promoción válida en Costa Rica.',
      });
    },
    onSuccess: (created) => {
      setErrorMsg(null);
      setCreatedCampaignId(created.id);
      setStatusMsg('Borrador guardado. Ahora podés agregar los combos y pases.');
      setActiveStep(WIZARD_STEP.COMBOS);
      invalidateCampaign(created.id);
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo crear la campaña');
    },
  });

  const updateInfoMutation = useMutation({
    mutationFn: () => {
      if (!activeCampaign) throw new Error('Sin campaña activa');
      return updateAdminCampaign(activeCampaign.id, {
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        terms: terms.trim() || undefined,
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
        drawAt: drawAt ? new Date(drawAt).toISOString() : null,
        drawReference: drawReference.trim() || null,
        countdownTitle: countdownTitle.trim() || null,
      });
    },
    onSuccess: () => {
      setErrorMsg(null);
      setStatusMsg('Información y fechas actualizadas.');
      if (activeCampaign) invalidateCampaign(activeCampaign.id);
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios');
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateAdminCampaign>[1]) => {
      if (!activeCampaign) throw new Error('Sin campaña activa');
      return updateAdminCampaign(activeCampaign.id, payload);
    },
    onSuccess: () => {
      setErrorMsg(null);
      if (activeCampaign) invalidateCampaign(activeCampaign.id);
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo actualizar la campaña');
    },
  });

  const validateStep1 = (): boolean => {
    if (title.trim().length < 3) {
      setErrorMsg('El título debe tener al menos 3 caracteres.');
      return false;
    }
    if (!isEditMode && slug.trim().length < 3) {
      setErrorMsg('El slug debe tener al menos 3 caracteres.');
      return false;
    }
    if (category.trim().length < 2) {
      setErrorMsg('Indicá una categoría válida.');
      return false;
    }
    if (description.trim().length < 10) {
      setErrorMsg('La descripción debe tener al menos 10 caracteres.');
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const currentIndex = CONSTRUCTION_STEPS.findIndex((s) => s.id === activeStep);
  const digits = activeCampaign?.numberDigits ?? Math.max(1, String(Math.max(0, totalFichas - 1)).length);
  const maxNumberLabel = String(
    Math.max(0, (activeCampaign?.totalFichas ?? totalFichas) - 1),
  ).padStart(digits, '0');

  const hasEvaluatedWinner = Boolean(
    activeCampaign?.winnerResult ||
      activeCampaign?.prizes?.some((p) => Boolean(p.winnerEvaluatedAt)),
  );
  const modeLocked = isReadOnly || hasEvaluatedWinner || updateFieldMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Barra de pasos del Wizard */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isEditMode ? 'Configuración de campaña' : 'Nueva campaña · Asistente paso a paso'}
            </p>
            {!isEditMode && currentIndex >= 0 ? (
              <p className="text-xs text-slate-500">
                Paso {currentIndex + 1} de {CONSTRUCTION_STEPS.length}:{' '}
                <strong className="text-slate-800">{CONSTRUCTION_STEPS[currentIndex]!.label}</strong>
              </p>
            ) : null}
          </div>
          {onCancelCreate && !isEditMode ? (
            <button
              type="button"
              onClick={onCancelCreate}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition"
            >
              Cerrar asistente
            </button>
          ) : null}
        </div>

        <nav
          aria-label="Pasos de construcción de campaña"
          className="flex flex-wrap gap-1.5"
        >
          {CONSTRUCTION_STEPS.map((step) => {
            const locked =
              !isEditMode &&
              (step.id === WIZARD_STEP.COMBOS || step.id === WIZARD_STEP.PRIZES);
            const isActive = activeStep === step.id;
            const isCompleted =
              (!isEditMode && currentIndex > step.number - 1) ||
              (isEditMode && Boolean(activeCampaign));

            return (
              <button
                key={step.id}
                type="button"
                disabled={locked}
                onClick={() => {
                  setErrorMsg(null);
                  setStatusMsg(null);
                  setActiveStep(step.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : locked
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-white text-slate-900'
                      : isCompleted && !locked
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {locked ? (
                    <Lock className="h-2.5 w-2.5" />
                  ) : !isEditMode && currentIndex > step.number - 1 ? (
                    <Check className="h-2.5 w-2.5" />
                  ) : (
                    step.number
                  )}
                </span>
                {step.label}
                {step.id === WIZARD_STEP.COMBOS && activeCampaign
                  ? ` (${activeCampaign.combos.length})`
                  : step.id === WIZARD_STEP.PRIZES && activeCampaign
                    ? ` (${activeCampaign.prizes?.length ?? 0})`
                    : ''}
              </button>
            );
          })}

          {ordersSlot ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setStatusMsg(null);
                setActiveStep(WIZARD_STEP.ORDERS);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                activeStep === WIZARD_STEP.ORDERS
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pedidos ({ordersCount})
            </button>
          ) : null}
        </nav>
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {statusMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          {statusMsg}
        </div>
      ) : null}

      {/* PASO 1: General y Fechas */}
      {activeStep === WIZARD_STEP.GENERAL ? (
        <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Título de la campaña
              </label>
              <input
                required
                minLength={3}
                disabled={isReadOnly}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Casa en la Playa + 2 Palitos"
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            {!isEditMode ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Slug URL (sin espacios)
                </label>
                <input
                  required
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                  }
                  placeholder="casa-en-la-playa"
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Slug URL
                </label>
                <input
                  disabled
                  value={slug}
                  className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm font-mono text-slate-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
              <input
                required
                disabled={isReadOnly}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Título personalizado del contador (opcional)
              </label>
              <input
                maxLength={120}
                disabled={isReadOnly}
                value={countdownTitle}
                onChange={(e) => setCountdownTitle(e.target.value)}
                placeholder="Ej. 2 PALITOS CIERRA EN..."
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cierre de ventas
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  disabled={isReadOnly}
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Fecha y hora del sorteo principal
              </label>
              <input
                type="datetime-local"
                disabled={isReadOnly}
                value={drawAt}
                onChange={(e) => setDrawAt(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sorteo de referencia
              </label>
              <input
                disabled={isReadOnly}
                value={drawReference}
                onChange={(e) => setDrawReference(e.target.value)}
                placeholder="Ej. Lotería Nacional JPS — Sorteo #4820"
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
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
                disabled={isReadOnly}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Términos y condiciones
              </label>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          </div>

          {activeCampaign ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                Cierre actual: {new Date(activeCampaign.endAt).toLocaleString('es-CR')}
              </span>
              {!isReadOnly ? (
                <button
                  type="button"
                  disabled={updateInfoMutation.isPending}
                  onClick={() => {
                    if (validateStep1()) updateInfoMutation.mutate();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 active:scale-95 transition"
                >
                  {updateInfoMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {updateInfoMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setActiveStep(WIZARD_STEP.TOKENS_MODE);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95 transition"
              >
                Siguiente: Fichas y Modalidad
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </section>
      ) : null}

      {/* PASO 2: Fichas y Modalidad */}
      {activeStep === WIZARD_STEP.TOKENS_MODE ? (
        <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Total de fichas (ej. 10000 = 0000–9999)
              </label>
              <input
                type="number"
                min={10}
                max={100000}
                disabled={isEditMode}
                value={totalFichas}
                onChange={(e) => setTotalFichas(Number(e.target.value) || 10000)}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cambios de número permitidos por pedido
              </label>
              <input
                type="number"
                min={0}
                max={20}
                disabled={isReadOnly}
                value={maxNumberChanges}
                onChange={(e) => setMaxNumberChanges(Number(e.target.value) || 0)}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div>
              <p className="text-xs font-bold text-slate-800">Oferta de números inversos</p>
              <p className="text-[11px] text-slate-500">
                Permite al comprador agregar el número inverso disponible sumando otro paquete.
              </p>
            </div>
            <button
              type="button"
              disabled={isReadOnly || updateFieldMutation.isPending}
              onClick={() => {
                const next = !enableInverseNumbers;
                setEnableInverseNumbers(next);
                if (activeCampaign) {
                  updateFieldMutation.mutate({ enableInverseNumbers: next });
                }
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold active:scale-95 transition disabled:opacity-50 ${
                enableInverseNumbers
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {enableInverseNumbers ? 'Habilitado' : 'Deshabilitado'}
            </button>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-bold text-slate-800">Modalidad de sorteo principal</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {DRAW_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={activeCampaign ? modeLocked : false}
                  onClick={() => {
                    setDrawMode(opt.value);
                    if (activeCampaign && opt.value !== drawMode) {
                      updateFieldMutation.mutate({ drawMode: opt.value });
                    }
                  }}
                  aria-pressed={drawMode === opt.value}
                  className={`rounded-xl border p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60 ${
                    drawMode === opt.value
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{opt.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {activeCampaign ? opt.detailDescription : opt.createDescription}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {!isEditMode ? (
            <div className="flex justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveStep(WIZARD_STEP.GENERAL)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setActiveStep(WIZARD_STEP.APPEARANCE)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95 transition"
              >
                Siguiente: Apariencia y Galería
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : !isReadOnly ? (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={updateFieldMutation.isPending}
                onClick={() => updateFieldMutation.mutate({ maxNumberChanges })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 active:scale-95 transition"
              >
                {updateFieldMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Guardar límite de cambios
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* PASO 3: Apariencia y Galería */}
      {activeStep === WIZARD_STEP.APPEARANCE ? (
        <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">
              Paleta de color de la campaña (contador, combos, chip y botón)
            </label>
            <CampaignThemePicker
              value={themeColor}
              disabled={isReadOnly || updateFieldMutation.isPending}
              onChange={(nextTheme) => {
                setThemeColor(nextTheme);
                if (activeCampaign) {
                  updateFieldMutation.mutate({ themeColor: nextTheme });
                }
              }}
            />
          </div>

          <CampaignImagesCarouselEditor
            images={galleryImages}
            disabled={isReadOnly || updateFieldMutation.isPending}
            onUploadFile={(file) => uploadAdminCampaignCover(file)}
            onChange={(nextImages) => {
              setGalleryImages(nextImages);
              if (activeCampaign) {
                updateFieldMutation.mutate({
                  galleryImages: nextImages.map((img) => ({
                    imageKey: img.key,
                    isCover: img.isCover,
                  })),
                });
              }
            }}
          />

          {!isEditMode ? (
            <div className="flex justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveStep(WIZARD_STEP.TOKENS_MODE)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                disabled={createDraftMutation.isPending}
                onClick={() => createDraftMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 active:scale-95 transition"
              >
                {createDraftMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {createDraftMutation.isPending
                  ? 'Guardando borrador...'
                  : 'Guardar borrador y continuar a Combos →'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* PASO 4: Combos y Pases */}
      {activeStep === WIZARD_STEP.COMBOS && activeCampaign ? (
        <div className="space-y-4">
          <CampaignDetailCombosPanel
            campaignId={activeCampaign.id}
            campaignStatus={activeCampaign.status}
            combos={activeCampaign.combos}
          />
          {!initialCampaign ? (
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(WIZARD_STEP.APPEARANCE)}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setActiveStep(WIZARD_STEP.PRIZES)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95 transition"
              >
                Siguiente: Diseño de Sorteos
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* PASO 5: Diseño de Sorteos */}
      {activeStep === WIZARD_STEP.PRIZES && activeCampaign ? (
        <div className="space-y-4">
          <CampaignPrizesBuilder
            campaignId={activeCampaign.id}
            campaignStatus={activeCampaign.status}
            drawMode={activeCampaign.drawMode ?? CAMPAIGN_DRAW_MODE.SINGLE_WINNER}
            digits={digits}
            maxNumberLabel={maxNumberLabel}
            prizes={activeCampaign.prizes ?? []}
            combos={activeCampaign.combos}
          />
          {!initialCampaign && onFinishCreate ? (
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(WIZARD_STEP.COMBOS)}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => onFinishCreate(activeCampaign.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 transition"
              >
                <Check className="h-3.5 w-3.5" />
                Finalizar y ver campaña
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* PEDIDOS (solo modo edición) */}
      {activeStep === WIZARD_STEP.ORDERS && ordersSlot ? ordersSlot : null}
    </div>
  );
}
