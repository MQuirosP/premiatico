'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { AdminCampaign, DigitalPass } from '@/types/campaign';

export interface ComboCreatePayload {
  campaignId: string;
  name: string;
  price: number;
  passQuantity: number;
  chanceQuantity: number;
  badgeLabel?: string;
  passItems?: Array<{ digitalPassId: string; quantity: number }>;
}

interface CampaignCombosPanelProps {
  campaign: AdminCampaign | undefined;
  passes: DigitalPass[] | undefined;
  savedMsg: string | null;
  isCreating: boolean;
  isDeleting: boolean;
  onCreateCombo: (payload: ComboCreatePayload) => void;
  onDeleteCombo: (comboId: string) => void;
  onClose: () => void;
}

export function CampaignCombosPanel({
  campaign,
  passes,
  savedMsg,
  isCreating,
  isDeleting,
  onCreateCombo,
  onDeleteCombo,
  onClose,
}: CampaignCombosPanelProps) {
  const [comboName, setComboName] = useState('');
  const [comboPrice, setComboPrice] = useState(4000);
  const [comboPassQty, setComboPassQty] = useState(1);
  const [comboChanceQty, setComboChanceQty] = useState(4);
  const [comboBadge, setComboBadge] = useState('');
  const [comboPassId, setComboPassId] = useState('');

  if (!campaign) return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreateCombo({
          campaignId: campaign.id,
          name: comboName,
          price: comboPrice,
          passQuantity: comboPassQty,
          chanceQuantity: comboChanceQty,
          badgeLabel: comboBadge.trim() || undefined,
          ...(comboPassId
            ? { passItems: [{ digitalPassId: comboPassId, quantity: comboPassQty }] }
            : {}),
        });
        setComboName('');
        setComboBadge('');
      }}
      className="rounded-xl border bg-white p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Combos de: {campaign.title}</h2>
          <p className="text-xs text-slate-500">
            Agregá uno o varios combos distintos (ej. 1 Pase, 2 Pases, 3 Pases...).
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Cerrar panel
        </button>
      </div>

      {campaign.combos && campaign.combos.length > 0 ? (
        <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Combos actuales ({campaign.combos.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {campaign.combos.map((combo) => (
              <div
                key={combo.id}
                className="rounded-lg border bg-white px-3 py-2 text-xs flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {combo.name}
                    {combo.badgeLabel ? (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
                        {combo.badgeLabel}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-slate-500">
                    {combo.passQuantity} pases · {combo.chanceQuantity} chances
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-700">
                    ₡{combo.price.toLocaleString('es-CR')}
                  </span>
                  <button
                    type="button"
                    title="Eliminar o desactivar combo"
                    disabled={isDeleting}
                    onClick={() => onDeleteCombo(combo.id)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Esta campaña aún no tiene combos. Agregá el primero abajo.
        </p>
      )}

      {savedMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {savedMsg}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Nombre del combo
          </label>
          <input
            required
            value={comboName}
            onChange={(e) => setComboName(e.target.value)}
            placeholder="Ej. 2 Pases"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Precio (CRC)</label>
          <input
            type="number"
            min={100}
            required
            value={comboPrice}
            onChange={(e) => setComboPrice(Number(e.target.value))}
            placeholder="8000"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Pases digitales
          </label>
          <input
            type="number"
            min={1}
            required
            value={comboPassQty}
            onChange={(e) => setComboPassQty(Number(e.target.value))}
            placeholder="2"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Chances de regalo
          </label>
          <input
            type="number"
            min={1}
            required
            value={comboChanceQty}
            onChange={(e) => setComboChanceQty(Number(e.target.value))}
            placeholder="8"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Etiqueta (opcional)
          </label>
          <input
            value={comboBadge}
            onChange={(e) => setComboBadge(e.target.value)}
            placeholder="Ej. Más popular"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Pase digital incluido (subilo primero en &ldquo;Pases digitales&rdquo;)
          </label>
          <select
            value={comboPassId}
            onChange={(e) => setComboPassId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
          >
            <option value="">Sin pase digital vinculado</option>
            {passes?.map((pass) => (
              <option key={pass.id} value={pass.id}>
                {pass.name} ({pass.mimeType})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={isCreating}
          className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400"
        >
          {isCreating ? 'Guardando...' : 'Agregar combo'}
        </button>
      </div>
    </form>
  );
}
