'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Ticket, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { isCampaignReadOnly } from '@/lib/domain-constants';
import { formatCRC } from '@/lib/utils';
import {
  createAdminCombo,
  deleteAdminCombo,
  listAdminPasses,
  type AdminCampaignDetail,
} from '@/services/campaigns';

interface CampaignDetailCombosPanelProps {
  campaignId: string;
  campaignStatus: string;
  combos: AdminCampaignDetail['combos'];
}

export function CampaignDetailCombosPanel({
  campaignId,
  campaignStatus,
  combos,
}: CampaignDetailCombosPanelProps) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [passQuantity, setPassQuantity] = useState('1');
  const [fichaQuantity, setFichaQuantity] = useState('1');
  const [badgeLabel, setBadgeLabel] = useState('');
  const [selectedPassIds, setSelectedPassIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const canEdit = !isCampaignReadOnly(campaignStatus);

  const { data: passes = [] } = useQuery({
    queryKey: ['admin-passes'],
    queryFn: listAdminPasses,
    enabled: showAddForm && canEdit,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', campaignId] });

  const createMutation = useMutation({
    mutationFn: createAdminCombo,
    onSuccess: () => {
      setShowAddForm(false);
      setName('');
      setPrice('');
      setPassQuantity('1');
      setFichaQuantity('1');
      setBadgeLabel('');
      setSelectedPassIds([]);
      setErrorMsg(null);
      setStatusMsg('Combo agregado correctamente.');
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo crear el combo');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCombo,
    onSuccess: (res) => {
      setErrorMsg(null);
      setStatusMsg(
        res.deactivated
          ? 'Combo desactivado (tenía órdenes asociadas).'
          : 'Combo eliminado correctamente.',
      );
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo eliminar el combo');
    },
  });

  const togglePass = (passId: string) => {
    setSelectedPassIds((prev) =>
      prev.includes(passId) ? prev.filter((id) => id !== passId) : [...prev, passId],
    );
  };

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-amber-500" />
          Combos y pases digitales ({combos.length})
        </h2>

        {canEdit ? (
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar combo
          </button>
        ) : null}
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {statusMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          {statusMsg}
        </div>
      ) : null}

      {showAddForm && canEdit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              campaignId,
              name: name.trim(),
              price: Number(price),
              passQuantity: Number(passQuantity),
              fichaQuantity: Number(fichaQuantity),
              badgeLabel: badgeLabel.trim() || undefined,
              passItems:
                selectedPassIds.length > 0
                  ? selectedPassIds.map((digitalPassId) => ({ digitalPassId, quantity: 1 }))
                  : undefined,
            });
          }}
          className="rounded-xl border bg-slate-50 p-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre del combo
              </label>
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. 4 PASES"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Precio (CRC)
              </label>
              <input
                required
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="16000"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Etiqueta destacada (opcional)
              </label>
              <input
                maxLength={40}
                value={badgeLabel}
                onChange={(e) => setBadgeLabel(e.target.value)}
                placeholder="Ej. Más vendido"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cantidad de pases
              </label>
              <input
                required
                type="number"
                min={1}
                value={passQuantity}
                onChange={(e) => setPassQuantity(e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Fichas de regalo
              </label>
              <input
                required
                type="number"
                min={1}
                value={fichaQuantity}
                onChange={(e) => setFichaQuantity(e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          {passes.length > 0 ? (
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-600">
                Pases digitales vinculados (opcional)
              </span>
              <div className="flex flex-wrap gap-2">
                {passes
                  .filter((p) => p.isActive)
                  .map((pass) => {
                    const selected = selectedPassIds.includes(pass.id);
                    return (
                      <button
                        key={pass.id}
                        type="button"
                        onClick={() => togglePass(pass.id)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold active:scale-95 transition ${
                          selected
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                        }`}
                      >
                        {pass.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 active:scale-95 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 active:scale-95 transition"
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {createMutation.isPending ? 'Guardando...' : 'Guardar combo'}
            </button>
          </div>
        </form>
      ) : null}

      {combos.length === 0 ? (
        <p className="text-sm text-slate-500">Esta campaña no tiene combos activos.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => {
            const isDeletingThis =
              deleteMutation.isPending && deleteMutation.variables === combo.id;
            return (
              <div
                key={combo.id}
                className="rounded-xl border bg-slate-50/70 p-4 space-y-2 text-xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
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

                {canEdit ? (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={isDeletingThis}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar o desactivar el combo "${combo.name}"?`)) {
                          deleteMutation.mutate(combo.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 active:scale-95 transition"
                    >
                      {isDeletingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Eliminar
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
