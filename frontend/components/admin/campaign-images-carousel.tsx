'use client';

import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CampaignGalleryImage } from '@/types/campaign';

export const MAX_CAMPAIGN_IMAGES = 7;

interface CampaignImagesCarouselEditorProps {
  images: CampaignGalleryImage[];
  disabled?: boolean;
  onChange: (next: CampaignGalleryImage[]) => void;
  onUploadFile: (file: File) => Promise<{ key: string; url: string | null }>;
}

export function CampaignImagesCarouselEditor({
  images,
  disabled = false,
  onChange,
  onUploadFile,
}: CampaignImagesCarouselEditorProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const remainingSlots = Math.max(0, MAX_CAMPAIGN_IMAGES - images.length);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled) return;
    setUploadError(null);

    if (remainingSlots === 0) {
      setUploadError(`Ya alcanzaste el máximo de ${MAX_CAMPAIGN_IMAGES} fotos por campaña.`);
      return;
    }

    const selected = Array.from(fileList).slice(0, remainingSlots);
    if (fileList.length > remainingSlots) {
      setUploadError(
        `Solo se subirán ${remainingSlots} foto(s) para no superar el máximo de ${MAX_CAMPAIGN_IMAGES}.`,
      );
    }

    setIsUploading(true);
    try {
      const uploaded: CampaignGalleryImage[] = [];
      for (const file of selected) {
        const res = await onUploadFile(file);
        uploaded.push({
          key: res.key,
          url: res.url,
          isCover: false,
        });
      }

      const combined = [...images, ...uploaded].slice(0, MAX_CAMPAIGN_IMAGES);
      const hasCover = combined.some((img) => img.isCover);
      const normalized = combined.map((img, idx) => ({
        ...img,
        isCover: hasCover ? img.isCover : idx === 0,
        sortOrder: idx,
      }));
      onChange(normalized);
    } catch {
      setUploadError('No se pudieron subir una o más fotos. Verificá formato y tamaño.');
    } finally {
      setIsUploading(false);
    }
  };

  const setAsCover = (targetKey: string) => {
    if (disabled) return;
    onChange(
      images.map((img) => ({
        ...img,
        isCover: img.key === targetKey,
      })),
    );
  };

  const removeImage = (targetKey: string) => {
    if (disabled) return;
    const filtered = images.filter((img) => img.key !== targetKey);
    const first = filtered[0];
    if (first && !filtered.some((img) => img.isCover)) {
      filtered[0] = { ...first, isCover: true };
    }
    onChange(filtered.map((img, idx) => ({ ...img, sortOrder: idx })));
  };

  const scrollTrack = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600">
            Galería y portada ({images.length}/{MAX_CAMPAIGN_IMAGES} fotos)
          </label>
          <p className="text-[11px] text-slate-500">
            Subí hasta {MAX_CAMPAIGN_IMAGES} fotos (JPG, PNG o WEBP) y elegí cuál será la portada predeterminada.
          </p>
        </div>

        {!disabled ? (
          <label
            className={`inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition ${
              remainingSlots === 0 || isUploading
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer hover:bg-blue-100'
            }`}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {isUploading ? 'Subiendo...' : 'Agregar fotos'}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={remainingSlots === 0 || isUploading}
              onChange={(e) => {
                void handleFilesSelected(e.target.files);
                e.currentTarget.value = '';
              }}
              className="hidden"
            />
          </label>
        ) : null}
      </div>

      {uploadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {uploadError}
        </p>
      ) : null}

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
          Aún no hay fotos cargadas para esta campaña.
        </div>
      ) : (
        <div className="relative group">
          {images.length > 2 ? (
            <>
              <button
                type="button"
                aria-label="Desplazar galería a la izquierda"
                onClick={() => scrollTrack(-1)}
                className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full border bg-white/95 text-slate-700 shadow-md hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Desplazar galería a la derecha"
                onClick={() => scrollTrack(1)}
                className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full border bg-white/95 text-slate-700 shadow-md hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}

          <div
            ref={trackRef}
            className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
          >
            {images.map((img, idx) => (
              <div
                key={img.key}
                className={`snap-start shrink-0 w-44 rounded-xl border bg-white overflow-hidden shadow-sm transition ${
                  img.isCover ? 'border-blue-500 ring-2 ring-blue-500/25' : 'border-slate-200'
                }`}
              >
                <div className="relative w-44 h-44 bg-slate-100">
                  {img.url ? (
                    <img
                      src={img.url}
                      alt={`Foto ${idx + 1} de campaña`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                      Imagen cargada
                    </div>
                  )}

                  {img.isCover ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                      <Star className="h-3 w-3 fill-current" />
                      Portada
                    </span>
                  ) : null}
                </div>

                {!disabled ? (
                  <div className="flex items-center justify-between gap-1.5 p-2 border-t bg-slate-50/70">
                    {img.isCover ? (
                      <span className="text-[11px] font-semibold text-blue-700 px-1">
                        Predeterminada
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAsCover(img.key)}
                        className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 truncate"
                      >
                        Usar portada
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeImage(img.key)}
                      aria-label="Eliminar foto"
                      className="inline-flex items-center justify-center rounded-md bg-red-50 p-1.5 text-red-700 hover:bg-red-100 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
