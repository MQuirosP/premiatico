'use client';

import { Check } from 'lucide-react';
import { CAMPAIGN_THEME_LIST, type CampaignThemeColor } from '@/lib/campaign-themes';
import { cn } from '@/lib/utils';

interface CampaignThemePickerProps {
  value: string;
  disabled?: boolean;
  onChange: (themeId: CampaignThemeColor) => void;
}

export function CampaignThemePicker({
  value,
  disabled = false,
  onChange,
}: CampaignThemePickerProps) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {CAMPAIGN_THEME_LIST.map((theme) => {
        const selected = value === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(theme.id)}
            className={cn(
              'relative flex flex-col gap-2 rounded-xl border p-3 text-left transition disabled:opacity-50',
              selected
                ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">{theme.label}</span>
              {selected ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
            </div>

            {/* Mini preview of countdown + combo gradient */}
            <div className="grid grid-cols-2 gap-1.5">
              <div
                className={cn('h-5 rounded-md border', theme.countdownCard)}
                title="Degradado del contador"
              />
              <div
                className={cn('h-5 rounded-md', theme.comboBanner)}
                title="Degradado de combos, chip y botón"
              />
            </div>

            <span className="text-[11px] text-slate-500 leading-tight">{theme.description}</span>
          </button>
        );
      })}
    </div>
  );
}
