'use client';

import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useState } from 'react';
import { ChancesModal, type ChancesModalEntry } from '@/components/chances-modal';
import { apiRequest } from '@/lib/api';

interface CustomerOrderRow {
  id: string;
  publicReference: string;
  status: string;
  campaign: { title: string };
  items: Array<{ comboNameSnapshot: string }>;
  participations: Array<{ number: string; status: string }>;
}

interface CustomerRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  _count: { orders: number };
  orders?: CustomerOrderRow[];
}

export default function AdminClientesPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<{
    title: string;
    subtitle: string;
    entries: ChancesModalEntry[];
  } | null>(null);

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

      <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando clientes...</div>
        ) : !data || data.customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay clientes registrados aún.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 whitespace-nowrap">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Pedidos / Chances</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.customers.map((c) => {
                const orders = c.orders ?? [];
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {c.fullName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.email}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.phone}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {c._count.orders} {c._count.orders === 1 ? 'pedido' : 'pedidos'}
                        </span>
                        {orders.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCustomer({
                                title: c.fullName,
                                subtitle: `${c.phone} · ${c.email}`,
                                entries: orders.map((order) => ({
                                  label: `${order.publicReference} · ${order.campaign.title}`,
                                  sublabel:
                                    order.items.map((i) => i.comboNameSnapshot).join(', ') || 'Combo',
                                  numbers: order.participations ?? [],
                                })),
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ChancesModal
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.title ?? ''}
        subtitle={selectedCustomer?.subtitle}
        entries={selectedCustomer?.entries ?? []}
      />
    </div>
  );
}
