'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Monitor,
  Moon,
  Save,
  Smartphone,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/components/theme-provider';
import { FormSkeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import type { ThemePreference } from '@/lib/theme';
import {
  getAdminPaymentSettingsRequest,
  updateAdminPaymentSettingsRequest,
} from '@/services/settings';

function formatSinpePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return phone || '8888-7777';
}

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: 'light',
    label: 'Claro',
    description: 'Fondo luminoso ideal para ambientes con mucha luz.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Oscuro',
    description: 'Reduce el brillo y descansa la vista en poca luz.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Sistema / Navegador',
    description: 'Sigue automáticamente la preferencia de tu dispositivo.',
    icon: Monitor,
  },
];

export default function AdminConfiguracionPage() {
  const queryClient = useQueryClient();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [sinpePhone, setSinpePhone] = useState('');
  const [sinpeHolderName, setSinpeHolderName] = useState('');
  const [sinpeBankName, setSinpeBankName] = useState('');
  const [sinpeInstructions, setSinpeInstructions] = useState('');
  const [sinpeDetailNotice, setSinpeDetailNotice] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payment-settings'],
    queryFn: getAdminPaymentSettingsRequest,
  });

  useEffect(() => {
    if (!data) return;
    setSinpePhone(data.sinpePhone);
    setSinpeHolderName(data.sinpeHolderName);
    setSinpeBankName(data.sinpeBankName ?? '');
    setSinpeInstructions(data.sinpeInstructions);
    setSinpeDetailNotice(data.sinpeDetailNotice ?? '');
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: updateAdminPaymentSettingsRequest,
    onSuccess: (updated) => {
      setSavedMsg('Configuración de SINPE Móvil guardada correctamente.');
      setErrorMsg(null);
      queryClient.setQueryData(['admin-payment-settings'], updated);
    },
    onError: (err) => {
      setSavedMsg(null);
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración');
    },
  });

  if (isLoading) {
    return <FormSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500">
          Administrá la apariencia del sitio y la cuenta receptora de SINPE Móvil.
        </p>
      </div>

      {/* Apariencia y tema */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Apariencia del sitio</h2>
            <p className="text-xs text-slate-500">
              Elegí el tema visual para todo Premiático (Panel administrativo y portal público) en este navegador.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Activo: {resolvedTheme === 'dark' ? 'Oscuro' : 'Claro'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                aria-pressed={selected}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected
                    ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/50'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-slate-800/60'
                }`}
              >
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    selected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {savedMsg ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {savedMsg}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSavedMsg(null);
            saveMutation.mutate({
              sinpePhone,
              sinpeHolderName,
              sinpeBankName: sinpeBankName.trim() || null,
              sinpeInstructions,
              sinpeDetailNotice: sinpeDetailNotice.trim() || null,
            });
          }}
          className="rounded-2xl border bg-white p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2.5 border-b pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Datos del receptor SINPE Móvil</h2>
              <p className="text-xs text-slate-500">
                Se aplicarán automáticamente a todos los nuevos pedidos.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono SINPE receptor (8 dígitos) *
              </label>
              <input
                required
                value={sinpePhone}
                onChange={(e) => setSinpePhone(e.target.value)}
                placeholder="72896439"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Banco / Entidad (opcional)
              </label>
              <input
                value={sinpeBankName}
                onChange={(e) => setSinpeBankName(e.target.value)}
                placeholder="Ej. BAC Credomatic / BCR"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre del titular *
            </label>
            <input
              required
              value={sinpeHolderName}
              onChange={(e) => setSinpeHolderName(e.target.value)}
              placeholder="Ej. Premiático Costa Rica"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instrucciones generales para el comprador *
            </label>
            <textarea
              required
              rows={3}
              value={sinpeInstructions}
              onChange={(e) => setSinpeInstructions(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nota importante de detalle (alerta destacada)
            </label>
            <input
              value={sinpeDetailNotice}
              onChange={(e) => setSinpeDetailNotice(e.target.value)}
              placeholder="Colocá tu referencia de pedido en el detalle de la transferencia."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              {data?.updatedAt
                ? `Última actualización: ${new Date(data.updatedAt).toLocaleString('es-CR')}`
                : 'Usando valores por defecto'}
            </span>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>

        {/* Live Checkout Preview */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div className="space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Vista previa en checkout
            </p>
            <h2 className="text-base font-bold text-slate-900">Así lo verá el comprador</h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Titular de la cuenta
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {sinpeHolderName || 'Nombre del titular'}
                </p>
                {sinpeBankName ? (
                  <p className="text-xs text-slate-500">{sinpeBankName}</p>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  SINPE Móvil receptor
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-extrabold text-slate-900">
                    {formatSinpePhone(sinpePhone)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    <Copy className="h-3 w-3" />
                    Copiar
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 border-t border-slate-200 pt-2.5">
              {sinpeInstructions || 'Instrucciones de pago...'}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <p>
              <strong>Importante:</strong>{' '}
              {sinpeDetailNotice || 'Colocá tu referencia de pedido en el detalle de la transferencia.'}{' '}
              Usá el código <strong className="font-mono">PRM-A1B2C3D4</strong>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
