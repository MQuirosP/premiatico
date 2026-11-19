'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Eye,
  Loader2,
  PauseCircle,
  Plus,
  ShieldCheck,
  Ticket,
  Trash2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CampaignCombosPanel } from '@/components/admin/campaign-combos-panel';
import { CampaignWizard } from '@/components/admin/campaign-wizard';
import { TableSkeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import {
  CAMPAIGN_STATUS,
  getCampaignStatusBadge,
  getLegalStatusBadge,
  isCampaignReadOnly,
} from '@/lib/domain-constants';
import {
  closeAdminCampaign,
  createAdminCombo,
  deleteAdminCampaign,
  deleteAdminCombo,
  listAdminCampaigns,
  listAdminPasses,
  pauseAdminCampaign,
  publishAdminCampaign,
  updateAdminCampaign,
} from '@/services/campaigns';
import type { AdminCampaign } from '@/types/campaign';

export default function AdminCampaignsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      setShowForm(true);
    }
  }, []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [legalCampaignId, setLegalCampaignId] = useState<string | null>(null);
  const [legalRef, setLegalRef] = useState('');
  const [comboCampaignId, setComboCampaignId] = useState<string | null>(null);
  const [comboSavedMsg, setComboSavedMsg] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: listAdminCampaigns,
  });

  const { data: passes } = useQuery({
    queryKey: ['admin-passes'],
    queryFn: listAdminPasses,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });

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

  const renderActions = (c: AdminCampaign) => {
    const isClosed = isCampaignReadOnly(c.status);
    const isTransitioning =
      transitionMutation.isPending && transitionMutation.variables?.id === c.id;
    const transitionAction = isTransitioning ? transitionMutation.variables?.action : null;
    const isDeletingRow = deleteCampaignMutation.isPending && deleteCampaignMutation.variables === c.id;
    const rowBusy = isTransitioning || isDeletingRow;

    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {!isClosed && c.legalApprovalStatus !== 'APPROVED' && (
          <button
            type="button"
            disabled={rowBusy}
            onClick={() => {
              setLegalCampaignId(c.id);
              setLegalRef(c.legalApprovalReference ?? '');
            }}
            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60 active:scale-95 transition"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Aprobar legal
          </button>
        )}
        {!isClosed && (
          <button
            type="button"
            disabled={rowBusy}
            onClick={() => setComboCampaignId(c.id)}
            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60 active:scale-95 transition"
          >
            <Ticket className="h-3.5 w-3.5" /> + Combo
          </button>
        )}
      {(c.status === 'DRAFT' || c.status === 'PAUSED') && (
        <button
          type="button"
          disabled={rowBusy}
          onClick={() => transitionMutation.mutate({ id: c.id, action: 'publish' })}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 active:scale-95 transition"
        >
          {transitionAction === 'publish' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {transitionAction === 'publish' ? 'Publicando...' : 'Publicar'}
        </button>
      )}
      {c.status === 'ACTIVE' && (
        <button
          type="button"
          disabled={rowBusy}
          onClick={() => transitionMutation.mutate({ id: c.id, action: 'pause' })}
          className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60 active:scale-95 transition"
        >
          {transitionAction === 'pause' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PauseCircle className="h-3.5 w-3.5" />
          )}
          {transitionAction === 'pause' ? 'Pausando...' : 'Pausar'}
        </button>
      )}
      {c.status === 'DRAFT' && (
        <button
          type="button"
          disabled={rowBusy}
          onClick={() => deleteCampaignMutation.mutate(c.id)}
          className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 active:scale-95 transition"
        >
          {isDeletingRow ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          {isDeletingRow ? 'Eliminando...' : 'Eliminar'}
        </button>
      )}
      {c.status !== 'DRAFT' && !isClosed && (
        <button
          type="button"
          disabled={rowBusy}
          onClick={() => transitionMutation.mutate({ id: c.id, action: 'close' })}
          className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 active:scale-95 transition"
        >
          {transitionAction === 'close' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {transitionAction === 'close' ? 'Cerrando...' : 'Cerrar'}
        </button>
      )}
      {isClosed && (
        <Link
          href={`/admin/campanas/detalle?id=${encodeURIComponent(c.id)}`}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          <Eye className="h-3.5 w-3.5" /> Ver detalle
        </Link>
      )}
    </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campañas</h1>
          <p className="text-sm text-slate-500">
            Administrá campañas promocionales, autorización legal y publicación.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Nueva campaña
        </button>
      </div>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {showForm ? (
        <CampaignWizard
          onCancelCreate={() => setShowForm(false)}
          onFinishCreate={(campaignId) => {
            setShowForm(false);
            router.push(`/admin/campanas/detalle?id=${encodeURIComponent(campaignId)}`);
          }}
        />
      ) : null}

      <div className="rounded-xl border bg-white shadow-sm">
        {isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : !campaigns || campaigns.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay campañas registradas todavía.
          </div>
        ) : (
          <>
            {/* Vista móvil en cards */}
            <div className="divide-y sm:hidden">
              {campaigns.map((c) => {
                const statusBadge = getCampaignStatusBadge(c.status);
                const legalBadge = getLegalStatusBadge(c.legalApprovalStatus);
                return (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/campanas/detalle?id=${encodeURIComponent(c.id)}`}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {c.title}
                      </Link>
                      <div className="text-xs text-slate-500">/{c.slug}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${legalBadge.className}`}
                    >
                      Legal: {legalBadge.label}
                    </span>
                    <span>
                      {c.progress.confirmedFichas}/{c.totalFichas} ({c.progress.soldPercentage}%)
                    </span>
                  </div>
                  <div className="pt-1 flex justify-start">{renderActions(c)}</div>
                </div>
                );
              })}
            </div>

            {/* Vista desktop en tabla */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3">Campaña</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Autorización</th>
                    <th className="px-4 py-3">Progreso</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {campaigns.map((c) => {
                    const statusBadge = getCampaignStatusBadge(c.status);
                    const legalBadge = getLegalStatusBadge(c.legalApprovalStatus);
                    return (
                    <tr key={c.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/campanas/detalle?id=${encodeURIComponent(c.id)}`}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {c.title}
                        </Link>
                        <div className="text-xs text-slate-500">/{c.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${legalBadge.className}`}
                        >
                          {legalBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {c.progress.confirmedFichas}/{c.totalFichas} ({c.progress.soldPercentage}%)
                      </td>
                      <td className="px-4 py-3 text-right">{renderActions(c)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
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

      <CampaignCombosPanel
        campaign={campaigns?.find((item) => item.id === comboCampaignId)}
        passes={passes}
        savedMsg={comboSavedMsg}
        isCreating={createComboMutation.isPending}
        isDeleting={deleteComboMutation.isPending}
        onCreateCombo={(payload) => createComboMutation.mutate(payload)}
        onDeleteCombo={(comboId) => deleteComboMutation.mutate(comboId)}
        onClose={() => {
          setComboCampaignId(null);
          setComboSavedMsg(null);
        }}
      />
    </div>
  );
}
