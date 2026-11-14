'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Copy, Save, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
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

export default function AdminConfiguracionPage() {
  const queryClient = useQueryClient();
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
    return <div className="text-sm text-slate-500">Cargando configuración de pagos...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Configuración de pagos SINPE</h1>
        <p className="text-sm text-slate-500">
          Administrá la cuenta receptora de SINPE Móvil que verán los compradores al finalizar su
          compra. Cada cambio queda registrado en auditoría.
        </p>
      </div>

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
              placeholder="Ej. Monterrosa Producciones Costa Rica"
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
