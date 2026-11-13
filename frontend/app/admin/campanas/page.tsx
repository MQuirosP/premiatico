'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PauseCircle, Plus, ShieldCheck, Ticket, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  closeAdminCampaign,
  createAdminCampaign,
  createAdminCombo,
  deleteAdminCampaign,
  deleteAdminCombo,
  listAdminCampaigns,
  pauseAdminCampaign,
  publishAdminCampaign,
  updateAdminCampaign,
} from '@/services/campaigns';

export default function AdminCampaignsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Vehículos');
  const [description, setDescription] = useState('');
  const [totalChances, setTotalChances] = useState(10000);
  const [drawAt, setDrawAt] = useState('');
  const [drawReference, setDrawReference] = useState('');
  const [terms, setTerms] = useState('Aplican restricciones. Promoción válida en Costa Rica.');

  const [legalCampaignId, setLegalCampaignId] = useState<string | null>(null);
  const [legalRef, setLegalRef] = useState('');

  const [comboCampaignId, setComboCampaignId] = useState<string | null>(null);
  const [comboName, setComboName] = useState('');
  const [comboPrice, setComboPrice] = useState(4000);
  const [comboPassQty, setComboPassQty] = useState(1);
  const [comboChanceQty, setComboChanceQty] = useState(4);
  const [comboBadge, setComboBadge] = useState('');
  const [comboSavedMsg, setComboSavedMsg] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: listAdminCampaigns,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });

  const createMutation = useMutation({
    mutationFn: createAdminCampaign,
    onSuccess: () => {
      setShowForm(false);
      setSlug('');
      setTitle('');
      setDescription('');
      setDrawAt('');
      setDrawReference('');
      setActionError(null);
      void refresh();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Error al crear campaña');
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'publish' | 'pause' | 'close' }) => {
      if (action === 'publish') return publishAdminCampaign(id);
      if (action === 'pause') return pauseAdminCampaign(id);
      return closeAdminCampaign(id);
    },
    onSuccess: () => {
      setActionError(null);
      void refresh();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado');
    },
  });

  const approveLegalMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      updateAdminCampaign(id, {
        legalApprovalStatus: 'APPROVED',
        legalApprovalReference: reference,
      }),
    onSuccess: () => {
      setLegalCampaignId(null);
      setLegalRef('');
      setActionError(null);
      void refresh();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Error al registrar autorización');
    },
  });

  const createComboMutation = useMutation({
    mutationFn: createAdminCombo,
    onSuccess: () => {
      setComboSavedMsg('Combo agregado. Podés agregar otro o cerrar.');
      setComboName('');
      setComboBadge('');
      setActionError(null);
      void refresh();
    },
    onError: (err) => {
      setComboSavedMsg(null);
      setActionError(err instanceof ApiError ? err.message : 'Error al crear combo');
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: deleteAdminCampaign,
    onSuccess: () => {
      setActionError(null);
      void refresh();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo eliminar la campaña');
    },
  });

  const deleteComboMutation = useMutation({
    mutationFn: deleteAdminCombo,
    onSuccess: (res) => {
      setComboSavedMsg(
        res.deleted
          ? 'Combo eliminado permanentemente.'
          : 'Combo desactivado (ya tenía pedidos asociados).',
      );
      setActionError(null);
      void refresh();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo eliminar el combo');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campañas</h1>
          <p className="text-sm text-slate-500">
            Administrá campañas promocionales, autorización legal y publicación.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nueva campaña
        </button>
      </div>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const now = new Date();
            const nextMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
            createMutation.mutate({
              slug,
              title,
              description,
              category,
              startAt: now.toISOString(),
              endAt: nextMonth.toISOString(),
              drawAt: drawAt ? new Date(drawAt).toISOString() : null,
              drawReference: drawReference.trim() || null,
              totalChances,
              maxNumberChanges: 5,
              requiresLegalApproval: true,
              legalApprovalStatus: 'PENDING',
              terms,
            });
          }}
          className="rounded-xl border bg-white p-6 shadow-sm space-y-4"
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
              <label className="block text-xs font-semibold text-slate-600 mb-1">Total de chances</label>
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
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Guardar borrador
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando campañas...</div>
        ) : !campaigns || campaigns.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay campañas registradas todavía.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Campaña</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Autorización</th>
                <th className="px-4 py-3">Progreso</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{c.title}</div>
                    <div className="text-xs text-slate-500">/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.legalApprovalStatus}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.progress.confirmedChances}/{c.totalChances} ({c.progress.soldPercentage}%)
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {c.legalApprovalStatus !== 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setLegalCampaignId(c.id);
                          setLegalRef(c.legalApprovalReference ?? '');
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Aprobar legal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setComboCampaignId(c.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      <Ticket className="h-3.5 w-3.5" /> + Combo
                    </button>
                    {(c.status === 'DRAFT' || c.status === 'PAUSED') && (
                      <button
                        type="button"
                        onClick={() => transitionMutation.mutate({ id: c.id, action: 'publish' })}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Publicar
                      </button>
                    )}
                    {c.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => transitionMutation.mutate({ id: c.id, action: 'pause' })}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        <PauseCircle className="h-3.5 w-3.5" /> Pausar
                      </button>
                    )}
                    {c.status === 'DRAFT' && (
                      <button
                        type="button"
                        disabled={deleteCampaignMutation.isPending}
                        onClick={() => deleteCampaignMutation.mutate(c.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    )}
                    {c.status !== 'DRAFT' && c.status !== 'CLOSED' && c.status !== 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => transitionMutation.mutate({ id: c.id, action: 'close' })}
                        className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cerrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {legalCampaignId ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            approveLegalMutation.mutate({ id: legalCampaignId, reference: legalRef });
          }}
          className="rounded-xl border bg-white p-5 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-bold text-slate-900">Registrar autorización legal</h2>
          <input
            required
            value={legalRef}
            onChange={(e) => setLegalRef(e.target.value)}
            placeholder="Número de oficio / resolución (ej. MEIC-DAC-2026-001)"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLegalCampaignId(null)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={approveLegalMutation.isPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Marcar APPROVED
            </button>
          </div>
        </form>
      ) : null}

      {comboCampaignId ? (() => {
        const selectedCampaign = campaigns?.find((item) => item.id === comboCampaignId);
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createComboMutation.mutate({
                campaignId: comboCampaignId,
                name: comboName,
                price: comboPrice,
                passQuantity: comboPassQty,
                chanceQuantity: comboChanceQty,
                badgeLabel: comboBadge.trim() || undefined,
              });
            }}
            className="rounded-xl border bg-white p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Combos de: {selectedCampaign?.title ?? 'Campaña'}
                </h2>
                <p className="text-xs text-slate-500">
                  Agregá uno o varios combos distintos (ej. 1 Pase, 2 Pases, 3 Pases...).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComboCampaignId(null);
                  setComboSavedMsg(null);
                }}
                className="rounded-lg border px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cerrar panel
              </button>
            </div>

            {selectedCampaign?.combos && selectedCampaign.combos.length > 0 ? (
              <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Combos actuales ({selectedCampaign.combos.length})
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedCampaign.combos.map((combo) => (
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
                          disabled={deleteComboMutation.isPending}
                          onClick={() => deleteComboMutation.mutate(combo.id)}
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

            {comboSavedMsg ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {comboSavedMsg}
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Precio (CRC)
                </label>
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
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={createComboMutation.isPending}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400"
              >
                {createComboMutation.isPending ? 'Guardando...' : 'Agregar combo'}
              </button>
            </div>
          </form>
        );
      })() : null}
    </div>
  );
}
