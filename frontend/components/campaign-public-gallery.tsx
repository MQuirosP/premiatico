'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CampaignGalleryImage } from '@/types/campaign';

interface CampaignPublicGalleryProps {
  title: string;
  coverImageUrl?: string | null;
  galleryImages?: CampaignGalleryImage[];
}

export function CampaignPublicGallery({
  title,
  coverImageUrl,
  galleryImages,
}: CampaignPublicGalleryProps) {
  const thumbsRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => {
    const valid = (galleryImages ?? []).filter((img) => Boolean(img.url));
    if (valid.length > 0) return valid;
    if (coverImageUrl) {
      return [{ id: 'cover', key: 'cover', url: coverImageUrl, isCover: true, sortOrder: 0 }];
    }
    return [];
  }, [galleryImages, coverImageUrl]);

  const defaultIndex = useMemo(() => {
    const idx = items.findIndex((img) => img.isCover);
    return idx >= 0 ? idx : 0;
  }, [items]);

  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  useEffect(() => {
    setActiveIndex(defaultIndex);
  }, [defaultIndex]);

  if (items.length === 0) return null;

  const activeImage = items[activeIndex] ?? items[0];
  if (!activeImage) return null;

  const scrollThumbs = (direction: -1 | 1) => {
    thumbsRef.current?.scrollBy({ left: direction * 200, behavior: 'smooth' });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border bg-slate-900 shadow-md aspect-square">
        <img
          src={activeImage.url ?? ''}
          alt={title}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover transition-opacity duration-200"
        />
      </div>

      {items.length > 1 ? (
        <div className="relative flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Miniaturas anteriores"
            onClick={() => scrollThumbs(-1)}
            className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white text-slate-700 shadow-sm hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={thumbsRef}
            className="flex flex-1 gap-2.5 overflow-x-auto py-1 px-0.5 snap-x snap-mandatory scroll-smooth"
          >
            {items.map((img, idx) => {
              const selected = idx === activeIndex;
              return (
                <button
                  key={img.id ?? img.key}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`Ver foto ${idx + 1} de ${title}`}
                  aria-pressed={selected}
                  className={`snap-start shrink-0 w-16 h-16 sm:w-[72px] sm:h-[72px] overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selected
                      ? 'border-blue-600 ring-2 ring-blue-500/30 scale-[1.03]'
                      : 'border-slate-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.url ?? ''}
                    alt={`${title} — miniatura ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Siguientes miniaturas"
            onClick={() => scrollThumbs(1)}
            className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white text-slate-700 shadow-sm hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
