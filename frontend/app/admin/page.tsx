'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { formatCRC } from '@/lib/utils';

interface DashboardStats {
  activeCampaigns: number;
  todayOrders: number;
  confirmedSalesTotal: number;
  pendingPayments: number;
  confirmedChances: number;
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiRequest<DashboardStats>('/admin/dashboard'),
  });

  const cards = [
    { label: 'Campañas activas', value: data ? String(data.activeCampaigns) : '—' },
    { label: 'Pedidos del día', value: data ? String(data.todayOrders) : '—' },
    {
      label: 'Ventas confirmadas',
      value: data ? formatCRC(data.confirmedSalesTotal) : '—',
    },
    { label: 'Pagos pendientes', value: data ? String(data.pendingPayments) : '—' },
    {
      label: 'Chances confirmados',
      value: data ? data.confirmedChances.toLocaleString('es-CR') : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel Administrativo</h1>
        <p className="text-sm text-slate-500">
          Resumen operativo en tiempo real de campañas, pedidos, pagos SINPE y chances confirmados.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Cargando indicadores...</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
