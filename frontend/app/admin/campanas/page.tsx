'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PauseCircle, Plus, ShieldCheck, Ticket, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  closeAdminCampaign,
  createAdminCampaign,
  createAdminCombo,
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
  const [terms, setTerms] = useState('Aplican restricciones. Promoción válida en Costa Rica.');

  const [legalCampaignId, setLegalCampaignId] = useState<string | null>(null);
  const [legalRef, setLegalRef] = useState('');

  const [comboCampaignId, setComboCampaignId] = useState<string | null>(null);
  const [comboName, setComboName] = useState('1 Pase');
  const [comboPrice, setComboPrice] = useState(4000);
  const [comboPassQty, setComboPassQty] = useState(1);
  const [comboChanceQty, setComboChanceQty] = useState(4);

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
      setComboCampaignId(null);
      setActionError(null);
      void refresh();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Error al crear combo');
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
                    {c.status !== 'CLOSED' && c.status !== 'COMPLETED' && (
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

      {comboCampaignId ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createComboMutation.mutate({
              campaignId: comboCampaignId,
              name: comboName,
              price: comboPrice,
              passQuantity: comboPassQty,
              chanceQuantity: comboChanceQty,
            });
          }}
          className="rounded-xl border bg-white p-5 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-bold text-slate-900">Agregar combo a la campaña</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              required
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              placeholder="Nombre (ej. 1 Pase)"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={100}
              required
              value={comboPrice}
              onChange={(e) => setComboPrice(Number(e.target.value))}
              placeholder="Precio CRC"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              required
              value={comboPassQty}
              onChange={(e) => setComboPassQty(Number(e.target.value))}
              placeholder="Pases"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              required
              value={comboChanceQty}
              onChange={(e) => setComboChanceQty(Number(e.target.value))}
              placeholder="Chances"
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComboCampaignId(null)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createComboMutation.isPending}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400"
            >
              Guardar combo
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
