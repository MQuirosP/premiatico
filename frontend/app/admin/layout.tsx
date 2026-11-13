'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Receipt,
  ShieldAlert,
  Sparkles,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getAdminMeRequest, logoutAdminRequest } from '@/services/auth';

const navItems = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard },
  { href: '/admin/campanas', label: 'Campañas', icon: Megaphone },
  { href: '/admin/pases', label: 'Pases digitales', icon: Ticket },
  { href: '/admin/pedidos', label: 'Pedidos y pagos', icon: Receipt },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ShieldAlert },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isLoginPage = pathname === '/admin/login' || pathname === '/admin/login/';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-me'],
    queryFn: getAdminMeRequest,
    enabled: !isLoginPage,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutAdminRequest,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/admin/login');
    },
  });

  useEffect(() => {
    if (!isLoginPage && isError) {
      router.replace('/admin/login');
    }
  }, [isLoginPage, isError, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Verificando sesión administrativa...
      </div>
    );
  }

  const currentSection =
    navItems.find((item) => pathname === item.href || pathname === `${item.href}/`)?.label ??
    'Panel';

  const renderNavLinks = (onNavigate?: () => void) =>
    navItems.map((item) => {
      const Icon = item.icon;
      const active =
        pathname === item.href ||
        pathname === `${item.href}/` ||
        (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            active
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <div className="h-screen overflow-hidden flex flex-col md:flex-row bg-slate-50">
      <header className="md:hidden flex items-center justify-between border-b bg-white px-4 py-3 shrink-0 z-30">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-base text-blue-600">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <span>Premiático</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {currentSection}
          </span>
        </Link>

        <button
          type="button"
          aria-label="Abrir menú administrativo"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <aside className="hidden md:flex w-64 h-full shrink-0 flex-col border-r bg-white overflow-y-auto">
        <div className="flex items-center gap-2 border-b px-5 py-4 font-bold text-lg text-blue-600">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <span>Premiático</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">{renderNavLinks()}</nav>

        <div className="border-t p-3">
          <div className="px-3 py-1.5 text-xs text-slate-500 truncate">
            {data.admin.name} ({data.admin.role})
          </div>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[82vw] flex-col bg-white shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b px-4 py-3.5">
              <div className="flex items-center gap-2 font-bold text-base text-blue-600">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span>Premiático Admin</span>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú administrativo"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 p-3">
              {renderNavLinks(() => setDrawerOpen(false))}
            </nav>

            <div className="border-t p-3">
              <div className="px-3 py-1.5 text-xs text-slate-500 truncate">
                {data.admin.name} ({data.admin.role})
              </div>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
