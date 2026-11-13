'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Ticket, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { deleteAdminPass, listAdminPasses, uploadAdminPass } from '@/services/campaigns';

export default function AdminPassesPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: passes, isLoading } = useQuery({
    queryKey: ['admin-passes'],
    queryFn: listAdminPasses,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAdminPass,
    onSuccess: () => {
      setShowForm(false);
      setName('');
      setDescription('');
      setFile(null);
      setFeedback('Pase digital guardado correctamente.');
      void queryClient.invalidateQueries({ queryKey: ['admin-passes'] });
    },
    onError: (err) => {
      setFeedback(err instanceof ApiError ? err.message : 'Error al subir pase digital');
    },
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pases digitales</h1>
          <p className="text-sm text-slate-500">
            Catálogo de pases digitales activos asignables a combos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Nuevo pase
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return;
            uploadMutation.mutate({ name, description, file });
          }}
          className="rounded-xl border bg-white p-6 shadow-sm space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900">Subir nuevo pase digital</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre del pase
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Wallpaper Combo Flash 4K"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Archivo (JPG, PNG, WEBP o PDF)
              </label>
              <input
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
            <input
              required
              minLength={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Fondo de pantalla digital exclusivo en alta resolución"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-2 text-xs font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!file || uploadMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploadMutation.isPending ? 'Subiendo...' : 'Guardar pase'}
            </button>
          </div>
        </form>
      ) : null}

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
