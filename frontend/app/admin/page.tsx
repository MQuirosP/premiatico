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
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import { formatCRC } from '@/lib/utils';

interface DashboardStats {
  activeCampaigns: number;
  todayOrders: number;
  confirmedSalesTotal: number;
  pendingPayments: number;
  confirmedFichas: number;
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiRequest<DashboardStats>('/admin/dashboard'),
  });

  const hasPendingPayments = Boolean(data && data.pendingPayments > 0);

  const cards = [
    {
      label: 'Campañas activas',
      value: data ? String(data.activeCampaigns) : '—',
      href: '/admin/campanas',
      action: 'Ver campañas',
      icon: Megaphone,
      surfaceClass:
        'border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 hover:border-blue-400 hover:ring-blue-500/20 focus-visible:ring-blue-500 dark:border-blue-900/60 dark:from-blue-950/50 dark:via-slate-900 dark:to-slate-900 dark:hover:border-blue-500/70',
      iconWrapClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
      actionClass: 'text-blue-700 dark:text-blue-400',
    },
    {
      label: 'Pedidos del día',
      value: data ? String(data.todayOrders) : '—',
      href: '/admin/pedidos?status=ALL',
      action: 'Ver pedidos',
      icon: Receipt,
      surfaceClass:
        'border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40 hover:border-indigo-400 hover:ring-indigo-500/20 focus-visible:ring-indigo-500 dark:border-indigo-900/60 dark:from-indigo-950/50 dark:via-slate-900 dark:to-slate-900 dark:hover:border-indigo-500/70',
      iconWrapClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
      actionClass: 'text-indigo-700 dark:text-indigo-400',
    },
    {
      label: 'Ventas confirmadas',
      value: data ? formatCRC(data.confirmedSalesTotal) : '—',
      href: '/admin/pedidos?status=APPROVED',
      action: 'Ver aprobados',
      icon: Banknote,
      surfaceClass:
        'border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 hover:border-emerald-400 hover:ring-emerald-500/20 focus-visible:ring-emerald-500 dark:border-emerald-900/60 dark:from-emerald-950/50 dark:via-slate-900 dark:to-slate-900 dark:hover:border-emerald-500/70',
      iconWrapClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
      actionClass: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Pagos pendientes',
      value: data ? String(data.pendingPayments) : '—',
      href: '/admin/pedidos?status=UNDER_REVIEW',
      action: 'Revisar SINPE',
      icon: Clock,
      surfaceClass: hasPendingPayments
        ? 'border-amber-300 bg-gradient-to-br from-amber-50 via-amber-50/60 to-white ring-1 ring-amber-300/60 hover:border-amber-400 hover:ring-amber-400/50 focus-visible:ring-amber-500 dark:border-amber-700/70 dark:from-amber-950/60 dark:via-slate-900 dark:to-slate-900 dark:ring-amber-700/40'
        : 'border-amber-200/70 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 hover:border-amber-400 hover:ring-amber-500/20 focus-visible:ring-amber-500 dark:border-amber-900/50 dark:from-amber-950/35 dark:via-slate-900 dark:to-slate-900 dark:hover:border-amber-600/70',
      iconWrapClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
      actionClass: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: 'Fichas confirmadas',
      value: data ? data.confirmedFichas.toLocaleString('es-CR') : '—',
      href: '/admin/campanas',
      action: 'Ver progreso',
      icon: Sparkles,
      surfaceClass:
        'border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-violet-50/40 hover:border-violet-400 hover:ring-violet-500/20 focus-visible:ring-violet-500 dark:border-violet-900/60 dark:from-violet-950/50 dark:via-slate-900 dark:to-slate-900 dark:hover:border-violet-500/70',
      iconWrapClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
      actionClass: 'text-violet-700 dark:text-violet-400',
    },
  ];

  const quickActions = [
    {
      label: 'Nueva campaña',
      description: 'Creá una campaña, portada y combos.',
      href: '/admin/campanas',
      icon: Plus,
      surfaceClass:
        'border-blue-200/70 bg-gradient-to-br from-blue-50/70 via-white to-white hover:border-blue-400 hover:ring-blue-500/20 focus-visible:ring-blue-500 dark:border-blue-900/50 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 dark:hover:border-blue-500/70',
      iconWrapClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
    },
    {
      label: 'Revisar pagos SINPE',
      description: 'Aprobá o rechazá comprobantes.',
      href: '/admin/pedidos?status=UNDER_REVIEW',
      icon: Receipt,
      surfaceClass:
        'border-emerald-200/70 bg-gradient-to-br from-emerald-50/70 via-white to-white hover:border-emerald-400 hover:ring-emerald-500/20 focus-visible:ring-emerald-500 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 dark:hover:border-emerald-500/70',
      iconWrapClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
    },
    {
      label: 'Pases y Fichas',
      description: 'Subí o administrá pases del catálogo.',
      href: '/admin/pases',
      icon: Ticket,
      surfaceClass:
        'border-violet-200/70 bg-gradient-to-br from-violet-50/70 via-white to-white hover:border-violet-400 hover:ring-violet-500/20 focus-visible:ring-violet-500 dark:border-violet-900/50 dark:from-violet-950/40 dark:via-slate-900 dark:to-slate-900 dark:hover:border-violet-500/70',
      iconWrapClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
    },
    {
      label: 'Auditoría',
      description: 'Consultá la bitácora de movimientos.',
      href: '/admin/auditoria',
      icon: ShieldAlert,
      surfaceClass:
        'border-amber-200/70 bg-gradient-to-br from-amber-50/70 via-white to-white hover:border-amber-400 hover:ring-amber-500/20 focus-visible:ring-amber-500 dark:border-amber-900/50 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 dark:hover:border-amber-500/70',
      iconWrapClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Panel Administrativo</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Resumen operativo en tiempo real de campañas activas, pedidos del día, pagos SINPE y fichas en juego.
        </p>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className={`group flex flex-col justify-between rounded-xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 focus-visible:outline-none focus-visible:ring-2 ${card.surfaceClass}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {card.label}
                      </p>
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${card.iconWrapClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {card.value}
                    </p>
                  </div>
                  <span
                    className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${card.actionClass}`}
                  >
                    {card.action}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Acciones rápidas
            </h2>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`group flex items-start gap-3 rounded-xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 focus-visible:outline-none focus-visible:ring-2 ${item.surfaceClass}`}
                  >
                    <div
                      className={`rounded-lg p-2 shrink-0 transition-transform duration-200 group-hover:scale-105 ${item.iconWrapClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
