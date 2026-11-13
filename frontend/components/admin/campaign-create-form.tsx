'use client';

import { useState } from 'react';

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
  totalChances: number;
  maxNumberChanges: number;
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
  isUploadingCover,
  onUploadCover,
  onSubmit,
  onCancel,
}: CampaignCreateFormProps) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Vehículos');
  const [description, setDescription] = useState('');
  const [totalChances, setTotalChances] = useState(10000);
  const [endAt, setEndAt] = useState('');
  const [drawAt, setDrawAt] = useState('');
  const [drawReference, setDrawReference] = useState('');
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
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
        onSubmit({
          slug,
          title,
          description,
          category,
          startAt: now.toISOString(),
          endAt: resolvedEndAt,
          drawAt: drawIso,
          drawReference: drawReference.trim() || null,
          coverImageKey,
          totalChances,
          maxNumberChanges: 5,
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
            Total de chances
          </label>
          <input
            type="number"
            min={1}
            max={100000}
            required
            value={totalChances}
            onChange={(e) => setTotalChances(Number(e.target.value))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
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
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Imagen de portada (JPG, PNG o WEBP)
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const selected = e.target.files?.[0];
                if (!selected) return;
                try {
                  const res = await onUploadCover(selected);
                  setCoverImageKey(res.key);
                  setCoverPreviewUrl(res.url);
                } catch {
                  // error handled by caller mutation
                }
              }}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700"
            />
            {isUploadingCover ? (
              <span className="text-xs text-slate-500">Subiendo imagen...</span>
            ) : coverPreviewUrl ? (
              <img
                src={coverPreviewUrl}
                alt="Vista previa portada"
                className="h-16 w-16 rounded-lg border object-cover"
              />
            ) : null}
          </div>
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
