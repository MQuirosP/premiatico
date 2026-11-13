'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ticket, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { deleteAdminPass, listAdminPasses } from '@/services/campaigns';

export default function AdminPassesPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const { data: passes, isLoading } = useQuery({
    queryKey: ['admin-passes'],
    queryFn: listAdminPasses,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminPass,
    onSuccess: (res) => {
      setFeedback(
        res.deleted
          ? 'Pase eliminado permanentemente.'
          : 'Pase desactivado (ya estaba asignado a un combo).',
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-passes'] });
    },
    onError: (err) => {
      setFeedback(err instanceof ApiError ? err.message : 'No se pudo eliminar el pase');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pases digitales</h1>
        <p className="text-sm text-slate-500">
          Catálogo de pases digitales activos alojados en Cloudflare R2 y asignables a combos.
        </p>
      </div>

      {feedback ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          {feedback}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando pases digitales...</div>
        ) : !passes || passes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <Ticket className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            No hay pases digitales registrados aún.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {passes.map((pass) => (
                <tr key={pass.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{pass.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{pass.mimeType}</td>
                  <td className="px-4 py-3 text-xs">
                    {pass.isActive ? 'Activo' : 'Inactivo'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(pass.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
