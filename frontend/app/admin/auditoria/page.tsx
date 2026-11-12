'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

export default function AdminAuditoriaPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => apiRequest<{ logs: AuditRow[] }>('/admin/audit'),
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
    </div>
  );
}
