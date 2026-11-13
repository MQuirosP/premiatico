'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, Sparkles, Upload } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ApiError } from '@/lib/api';
import { formatCRC } from '@/lib/utils';
import {
  createOrderRequest,
  createReservationRequest,
  regenerateNumbersRequest,
  uploadProofRequest,
  type CreatedOrderData,
  type ReservationSessionData,
} from '@/services/checkout';

const customerSchema = z.object({
  fullName: z.string().trim().min(3, 'Ingresá tu nombre completo'),
  email: z.string().trim().email('Ingresá un correo válido'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{8,20}$/, 'Ingresá un número de teléfono válido (8 dígitos)'),
});

type CustomerForm = z.infer<typeof customerSchema>;

function CheckoutContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId') ?? '';
  const comboId = searchParams.get('comboId') ?? '';

  const [session, setSession] = useState<ReservationSessionData | null>(null);
  const [order, setOrder] = useState<CreatedOrderData | null>(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const storageKey = `premiatico_res_${campaignId}_${comboId}`;

  const reserveMutation = useMutation({
    mutationFn: createReservationRequest,
    onSuccess: (data) => {
      setSession(data);
      setErrorMsg(null);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // ignore storage errors
      }
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No pudimos reservar tus chances');
    },
  });

  useEffect(() => {
    if (!campaignId || !comboId) return;
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ReservationSessionData;
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setSession(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    reserveMutation.mutate({ campaignId, comboId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, comboId]);

  const regenMutation = useMutation({
    mutationFn: regenerateNumbersRequest,
    onSuccess: (data) => {
      if (!session) return;
      const updated: ReservationSessionData = {
        ...session,
        numbers: data.numbers,
        regenerationCount: data.regenerationCount,
        remainingChanges: data.remainingChanges,
        expiresAt: data.expiresAt,
      };
      setSession(updated);
      setErrorMsg(null);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No pudimos cambiar tus números');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  });

  const orderMutation = useMutation({
    mutationFn: createOrderRequest,
    onSuccess: (data) => {
      setOrder(data);
      setErrorMsg(null);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo crear el pedido');
    },
  });

  const proofMutation = useMutation({
    mutationFn: uploadProofRequest,
    onSuccess: () => {
      setProofUploaded(true);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'Error al subir el comprobante');
    },
  });

  if (!campaignId || !comboId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <p className="text-slate-600">Seleccioná un combo desde una campaña activa primero.</p>
        <Link href="/" className="text-blue-600 font-semibold hover:underline">
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {!order ? (
          <>
            <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Descubrí tus chances</h1>
                  {session ? (
                    <p className="text-sm text-slate-500">
                      {session.comboName} · {formatCRC(session.price)}
                    </p>
                  ) : null}
                </div>
                {session ? (
                  <button
                    type="button"
                    disabled={session.remainingChanges <= 0 || regenMutation.isPending}
                    onClick={() =>
                      regenMutation.mutate({
                        sessionId: session.sessionId,
                        sessionToken: session.sessionToken,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Cambiá tus números ({session.remainingChanges} restantes)
                  </button>
                ) : null}
              </div>

              {reserveMutation.isPending || !session ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  Generando tus números aleatorios...
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {session.numbers.map((num) => (
                    <div
                      key={num}
                      className="rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-center font-mono text-base font-extrabold text-slate-900"
                    >
                      {num}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {session ? (
              <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Tus datos para reservar</h2>
                <form
                  onSubmit={handleSubmit((values) =>
                    orderMutation.mutate({
                      sessionId: session.sessionId,
                      sessionToken: session.sessionToken,
                      ...values,
                    }),
                  )}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre completo
                    </label>
                    <input
                      {...register('fullName')}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="Ej. María Quirós"
                    />
                    {errors.fullName ? (
                      <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>
                    ) : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        {...register('email')}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        placeholder="maria@correo.com"
                      />
                      {errors.email ? (
                        <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Teléfono (SINPE / WhatsApp)
                      </label>
                      <input
                        {...register('phone')}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        placeholder="88887777"
                      />
                      {errors.phone ? (
                        <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={orderMutation.isPending}
                    className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {orderMutation.isPending
                      ? 'Confirmando reserva...'
                      : `Reservar chances y pagar ${formatCRC(session.price)}`}
                  </button>
                </form>
              </section>
            ) : null}
          </>
        ) : !proofUploaded ? (
          <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-5">
            <div className="space-y-1">
              <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ¡Tus chances están listos!
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Pedido {order.publicReference}
              </h1>
              <p className="text-sm text-slate-600">
                {order.sinpeInstructions.instructions}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Monto exacto SINPE Móvil:</span>
                <span className="font-bold text-slate-900">{formatCRC(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Referencia / Detalle:</span>
                <span className="font-mono font-bold text-blue-700">{order.publicReference}</span>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <h2 className="font-bold text-slate-900">Adjuntá tu comprobante</h2>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              <button
                type="button"
                disabled={!proofFile || proofMutation.isPending}
                onClick={() => {
                  if (!proofFile) return;
                  proofMutation.mutate({
                    publicReference: order.publicReference,
                    accessToken: order.accessToken,
                    file: proofFile,
                  });
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {proofMutation.isPending ? 'Subiendo comprobante...' : 'Enviar comprobante SINPE'}
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border bg-white p-8 shadow-sm text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
            <h1 className="text-2xl font-extrabold text-slate-900">
              Estamos verificando tu pago
            </h1>
            <p className="text-sm text-slate-600">
              Recibimos tu comprobante para el pedido <strong>{order.publicReference}</strong>. Tus chances quedan protegidos mientras nuestro equipo confirma el ingreso bancario.
            </p>
            <Link
              href={`/pedido?ref=${encodeURIComponent(order.publicReference)}&token=${encodeURIComponent(order.accessToken)}`}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Consultar estado del pedido
            </Link>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
          Cargando checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
