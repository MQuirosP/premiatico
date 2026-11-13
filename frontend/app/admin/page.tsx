'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Banknote,
  Clock,
  Megaphone,
  Plus,
  Receipt,
  ShieldAlert,
  Sparkles,
  Ticket,
} from 'lucide-react';
import Link from 'next/link';
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
    {
      label: 'Campañas activas',
      value: data ? String(data.activeCampaigns) : '—',
      href: '/admin/campanas',
      action: 'Ver campañas',
      icon: Megaphone,
      highlight: false,
    },
    {
      label: 'Pedidos del día',
      value: data ? String(data.todayOrders) : '—',
      href: '/admin/pedidos',
      action: 'Ver pedidos',
      icon: Receipt,
      highlight: false,
    },
    {
      label: 'Ventas confirmadas',
      value: data ? formatCRC(data.confirmedSalesTotal) : '—',
      href: '/admin/pedidos',
      action: 'Ver aprobados',
      icon: Banknote,
      highlight: false,
    },
    {
      label: 'Pagos pendientes',
      value: data ? String(data.pendingPayments) : '—',
      href: '/admin/pedidos',
      action: 'Revisar SINPE',
      icon: Clock,
      highlight: Boolean(data && data.pendingPayments > 0),
    },
    {
      label: 'Chances confirmados',
      value: data ? data.confirmedChances.toLocaleString('es-CR') : '—',
      href: '/admin/campanas',
      action: 'Ver progreso',
      icon: Sparkles,
      highlight: false,
    },
  ];

  const quickActions = [
    {
      label: 'Nueva campaña',
      description: 'Creá una campaña, portada y combos.',
      href: '/admin/campanas',
      icon: Plus,
    },
    {
      label: 'Revisar pagos SINPE',
      description: 'Aprobá o rechazá comprobantes.',
      href: '/admin/pedidos',
      icon: Receipt,
    },
    {
      label: 'Pases digitales',
      description: 'Subí o administrá pases del catálogo.',
      href: '/admin/pases',
      icon: Ticket,
    },
    {
      label: 'Auditoría',
      description: 'Consultá la bitácora de movimientos.',
      href: '/admin/auditoria',
      icon: ShieldAlert,
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
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className={`group flex flex-col justify-between rounded-xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                card.highlight
                  ? 'border-amber-300 bg-amber-50/70 hover:border-amber-400'
                  : 'bg-white hover:border-blue-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    {card.label}
                  </p>
                  <Icon
                    className={`h-4 w-4 ${
                      card.highlight ? 'text-amber-600' : 'text-slate-400 group-hover:text-blue-600'
                    }`}
                  />
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
              </div>
              <span
                className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${
                  card.highlight ? 'text-amber-700' : 'text-blue-600'
                }`}
              >
                {card.action}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Acciones rápidas
        </h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600 shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
