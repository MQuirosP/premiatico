'use client';

import { useQuery } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { listAdminPasses } from '@/services/campaigns';

export default function AdminPassesPage() {
  const { data: passes, isLoading } = useQuery({
    queryKey: ['admin-passes'],
    queryFn: listAdminPasses,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pases digitales</h1>
        <p className="text-sm text-slate-500">
          Catálogo de pases digitales privados alojados en Cloudflare R2 y asignables a combos.
        </p>
      </div>

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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
