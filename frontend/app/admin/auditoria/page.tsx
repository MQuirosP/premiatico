'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

interface AuditResponse {
  logs: AuditRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

export default function AdminAuditoriaPage() {
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-audit', currentCursor],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '20' });
      if (currentCursor) params.set('cursor', currentCursor);
      return apiRequest<AuditResponse>(`/admin/audit?${params.toString()}`);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Auditoría</h1>
        <p className="text-sm text-slate-500">
          Registro de acciones críticas ejecutadas en el panel administrativo.
        </p>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando bitácora...</div>
        ) : !data || data.logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Sin registros de auditoría aún.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Entidad</th>
                <th className="px-4 py-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString('es-CR')}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {log.entityType} ({log.entityId})
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {log.actor ? `${log.actor.name} (${log.actor.email})` : 'Sistema'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && (cursorHistory.length > 0 || data.hasMore) ? (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            Página {cursorHistory.length + 1} · {data.logs.length} registros
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cursorHistory.length === 0 || isFetching}
              onClick={() => {
                const prev = cursorHistory[cursorHistory.length - 1] ?? null;
                setCursorHistory((hist) => hist.slice(0, -1));
                setCurrentCursor(prev);
              }}
              className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              type="button"
              disabled={!data.hasMore || !data.nextCursor || isFetching}
              onClick={() => {
                if (!data.nextCursor) return;
                setCursorHistory((hist) => [...hist, currentCursor]);
                setCurrentCursor(data.nextCursor);
              }}
              className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
