'use client';

import { Check, Gift, Ticket } from 'lucide-react';
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {combos.map((combo) => {
        const selected = combo.id === selectedComboId;
        const highlighted = Boolean(combo.badgeLabel);
        return (
          <button
            key={combo.id}
            type="button"
            onClick={() => onSelect(combo)}
            className={cn(
              'relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all',
              selected
                ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/25 shadow-md scale-[1.01]'
                : highlighted
                  ? 'border-amber-400 bg-amber-50/40 hover:border-amber-500 hover:shadow-md'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md',
            )}
          >
            {combo.badgeLabel ? (
              <span className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-950 shadow">
                {combo.badgeLabel}
              </span>
            ) : null}

            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full border transition',
                      selected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white',
                    )}
                  >
                    {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="text-base font-extrabold text-slate-900">{combo.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-7">
                  <Ticket className="h-3.5 w-3.5 text-blue-600" />
                  <span>
                    {combo.passQuantity}{' '}
                    {combo.passQuantity === 1 ? 'Pase digital' : 'Pases digitales'}
                  </span>
                </div>
              </div>

              <span className="text-xl font-extrabold text-slate-900">
                {formatCRC(combo.price)}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-amber-400 px-3.5 py-2.5 text-white shadow-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                <Gift className="h-4 w-4 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-50">
                  Tu compra incluye
                </p>
                <p className="text-sm font-extrabold">
                  {combo.chanceQuantity}{' '}
                  {combo.chanceQuantity === 1 ? 'chance de regalo' : 'chances de regalo'}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
