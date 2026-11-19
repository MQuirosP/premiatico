'use client';

import { useState } from 'react';
import { CampaignImagesCarouselEditor } from '@/components/admin/campaign-images-carousel';
import { CampaignThemePicker } from '@/components/admin/campaign-theme-picker';
import type { CampaignThemeColor } from '@/lib/campaign-themes';
import type { CampaignGalleryImage } from '@/types/campaign';

export interface CampaignCreatePayload {
  slug: string;
  title: string;
  description: string;
  category: string;
  startAt: string;
  endAt: string;
  drawAt: string | null;
  drawReference: string | null;
  coverImageKey: string | null;
  galleryImages: Array<{ imageKey: string; isCover: boolean }>;
  totalFichas: number;
  maxNumberChanges: number;
  enableInverseNumbers: boolean;
  themeColor: CampaignThemeColor;
  requiresLegalApproval: boolean;
  legalApprovalStatus: 'PENDING';
  terms: string;
}

interface CampaignCreateFormProps {
  isSubmitting: boolean;
  isUploadingCover: boolean;
  onUploadCover: (file: File) => Promise<{ key: string; url: string | null }>;
  onSubmit: (payload: CampaignCreatePayload) => void;
  onCancel: () => void;
}

export function CampaignCreateForm({
  isSubmitting,
  onUploadCover,
  onSubmit,
  onCancel,
}: CampaignCreateFormProps) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Vehículos');
  const [description, setDescription] = useState('');
  const [totalFichas, setTotalFichas] = useState(10000);
  const [maxNumberChanges, setMaxNumberChanges] = useState(5);
  const [enableInverseNumbers, setEnableInverseNumbers] = useState(false);
  const [themeColor, setThemeColor] = useState<CampaignThemeColor>('classic');
  const [endAt, setEndAt] = useState('');
  const [drawAt, setDrawAt] = useState('');
  const [drawReference, setDrawReference] = useState('');
  const [galleryImages, setGalleryImages] = useState<CampaignGalleryImage[]>([]);
  const [terms, setTerms] = useState('Aplican restricciones. Promoción válida en Costa Rica.');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const now = new Date();
        const drawIso = drawAt ? new Date(drawAt).toISOString() : null;
        const resolvedEndAt = endAt
          ? new Date(endAt).toISOString()
          : (drawIso ?? new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString());
        const coverKey =
          galleryImages.find((img) => img.isCover)?.key ?? galleryImages[0]?.key ?? null;
        onSubmit({
          slug,
          title,
          description,
          category,
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
          requiresLegalApproval: true,
          legalApprovalStatus: 'PENDING',
          terms,
        });
      }}
      className="rounded-xl border bg-white p-5 sm:p-6 shadow-sm space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Título</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Ej. Pick-up 4x4 2026"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Slug URL</label>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="pickup-4x4-2026"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
          <input
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Total de fichas
          </label>
          <input
            type="number"
            min={1}
            max={100000}
            required
            value={totalFichas}
            onChange={(e) => setTotalFichas(Number(e.target.value))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Cambios de números permitidos
          </label>
          <input
            type="number"
            min={0}
            max={20}
            required
            value={maxNumberChanges}
            onChange={(e) => setMaxNumberChanges(Number(e.target.value))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 cursor-pointer hover:border-blue-300 transition">
            <input
              type="checkbox"
              checked={enableInverseNumbers}
              onChange={(e) => setEnableInverseNumbers(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="block text-sm font-semibold text-slate-900">
                Habilitar oferta de números inversos
              </span>
              <span className="block text-xs text-slate-500">
                Si está activo, al seleccionar un paquete el comprador podrá agregar el número
                inverso disponible (ej. 83897 → 79838) sumando otro paquete completo.
              </span>
            </div>
          </label>
        </div>
        <div className="sm:col-span-2 space-y-2">
          <label className="block text-xs font-semibold text-slate-600">
            Paleta de color de la campaña (contador, combos, chip y botón)
          </label>
          <CampaignThemePicker value={themeColor} onChange={setThemeColor} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Cierre de ventas (opcional, usa fecha del sorteo si se omite)
          </label>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Fecha y hora del sorteo
          </label>
          <input
            type="datetime-local"
            value={drawAt}
            onChange={(e) => setDrawAt(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Sorteo de referencia
          </label>
          <input
            value={drawReference}
            onChange={(e) => setDrawReference(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Ej. Lotería Nacional JPS — Sorteo #4820"
          />
        </div>
        <div className="sm:col-span-2">
          <CampaignImagesCarouselEditor
            images={galleryImages}
            onChange={setGalleryImages}
            onUploadFile={onUploadCover}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
        <textarea
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Términos</label>
        <textarea
          required
          rows={2}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Guardar borrador
        </button>
      </div>
    </form>
  );
}
