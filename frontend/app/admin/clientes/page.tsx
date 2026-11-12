'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

interface CustomerRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  _count: { orders: number };
}

export default function AdminClientesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: () => apiRequest<{ customers: CustomerRow[] }>('/admin/customers'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-500">Listado de compradores registrados en Premiático.</p>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando clientes...</div>
        ) : !data || data.customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay clientes registrados aún.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Pedidos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                  <td className="px-4 py-3">{c._count.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
