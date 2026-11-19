'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Tag } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  createAdminCategory,
  listAdminCategories,
  updateAdminCategory,
} from '@/services/campaigns';

export function CategoryCatalogPanel() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories', 'all'],
    queryFn: () => listAdminCategories(false),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
  };

  const createMutation = useMutation({
    mutationFn: () => createAdminCategory({ name: newName.trim() }),
    onSuccess: (created) => {
      setNewName('');
      setErrorMsg(null);
      setStatusMsg(`Categoría "${created.name}" agregada al catálogo.`);
      refresh();
    },
    onError: (err) => {
      setStatusMsg(null);
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo crear la categoría');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateAdminCategory(id, { isActive }),
    onSuccess: () => {
      setErrorMsg(null);
      refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo actualizar la categoría');
    },
  });

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Tag className="h-4 w-4 text-blue-600" />
          Catálogo de categorías de campañas
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Estandarizá las categorías disponibles en el asistente de campañas para evitar duplicados
          como &ldquo;Vehículos&rdquo; y &ldquo;vehiculos&rdquo;.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim().length < 2) return;
          createMutation.mutate();
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          required
          minLength={2}
          maxLength={60}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva categoría (ej. Motocicletas)"
          className="flex-1 min-w-[220px] rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || newName.trim().length < 2}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 active:scale-95 transition"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Agregar categoría
        </button>
      </form>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {statusMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {statusMsg}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-xs text-slate-500">Cargando categorías...</p>
      ) : (
        <div className="divide-y rounded-xl border border-slate-200">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{cat.name}</span>
                <span className="font-mono text-[11px] text-slate-400">({cat.slug})</span>
                {typeof cat._count?.campaigns === 'number' ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {cat._count.campaigns}{' '}
                    {cat._count.campaigns === 1 ? 'campaña' : 'campañas'}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                disabled={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate({ id: cat.id, isActive: !cat.isActive })}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold active:scale-95 transition ${
                  cat.isActive
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {cat.isActive ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
