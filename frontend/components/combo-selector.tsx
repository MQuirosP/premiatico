'use client';

import { Check, Sparkles, Ticket } from 'lucide-react';
import { cn, formatCRC } from '@/lib/utils';
import type { CampaignCombo } from '@/types/campaign';

interface ComboSelectorProps {
  combos: CampaignCombo[];
  selectedComboId: string | null;
  onSelect: (combo: CampaignCombo) => void;
}

export function ComboSelector({
  combos,
  selectedComboId,
  onSelect,
}: ComboSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {combos.map((combo) => {
        const selected = combo.id === selectedComboId;
        return (
          <button
            key={combo.id}
            type="button"
            onClick={() => onSelect(combo)}
            className={cn(
              'relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all',
              selected
                ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-sm'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm',
            )}
          >
            {combo.badgeLabel ? (
              <span className="absolute -top-2.5 right-3 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-slate-900 shadow-sm">
                {combo.badgeLabel}
              </span>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{combo.name}</span>
                {selected ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Ticket className="h-3.5 w-3.5 text-blue-600" />
                <span>
                  {combo.passQuantity} {combo.passQuantity === 1 ? 'Pase digital' : 'Pases digitales'}
                </span>
              </div>

              <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {combo.chanceQuantity} {combo.chanceQuantity === 1 ? 'Chance de regalo' : 'Chances de regalo'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Precio</span>
              <span className="text-lg font-extrabold text-slate-900">
                {formatCRC(combo.price)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
