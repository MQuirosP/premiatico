'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  LogOut,
  Megaphone,
  Receipt,
  ShieldAlert,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
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

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50">
      <aside className="hidden md:flex w-64 h-full shrink-0 flex-col border-r bg-white overflow-y-auto">
        <div className="flex items-center gap-2 border-b px-5 py-4 font-bold text-lg text-blue-600">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <span>Premiático</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname === `${item.href}/`;
            return (
              <Link
                key={item.href}
                href={item.href}
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
          })}
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

      <main className="flex-1 h-full overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
