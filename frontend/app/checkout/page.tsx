'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Check, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SinpePaymentStep } from '@/components/checkout/sinpe-payment-step';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { DetailSkeleton, Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { formatCRC } from '@/lib/utils';
import {
  cancelOrderRequest,
  cancelReservationRequest,
  createOrderRequest,
  createReservationRequest,
  regenerateNumbersRequest,
  uploadProofRequest,
  type CreatedOrderData,
  type ReservationSessionData,
} from '@/services/checkout';

const customerSchema = z.object({
  firstName: z.string().trim().min(2, 'Ingresá tu nombre'),
  lastName: z.string().trim().min(2, 'Ingresá tus apellidos'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{8,20}$/, 'Ingresá un número de teléfono válido (8 dígitos)'),
  email: z.string().trim().email('Ingresá un correo válido'),
});

type CustomerForm = z.infer<typeof customerSchema>;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function CheckoutStepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Datos' },
    { num: 2, label: 'Pago' },
    { num: 3, label: 'Confirmación' },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-6">
      {steps.map((s, idx) => {
        const isDone = step > s.num;
        const isActive = step === s.num;
        return (
          <div key={s.num} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold transition ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.num}
              </span>
              <span
                className={`text-xs sm:text-sm font-semibold ${
                  isActive || isDone ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 ? (
              <div className="hidden sm:block h-px w-8 bg-slate-300" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId') ?? '';
  const comboId = searchParams.get('comboId') ?? '';

  const [session, setSession] = useState<ReservationSessionData | null>(null);
  const [order, setOrder] = useState<CreatedOrderData | null>(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);

  const storageKey = `premiatico_res_${campaignId}_${comboId}`;
  const orderStorageKey = `premiatico_ord_${campaignId}_${comboId}`;

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
      setErrorMsg(err instanceof ApiError ? err.message : 'No pudimos reservar tus fichas');
    },
  });

  useEffect(() => {
    if (!campaignId || !comboId) return;
    try {
      const cachedOrder = sessionStorage.getItem(orderStorageKey);
      if (cachedOrder) {
        const parsedOrder = JSON.parse(cachedOrder) as CreatedOrderData;
        if (new Date(parsedOrder.expiresAt).getTime() > Date.now()) {
          setOrder(parsedOrder);
          return;
        }
        sessionStorage.removeItem(orderStorageKey);
      }
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ReservationSessionData;
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setSession(parsed);
          return;
        }
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // ignore
    }
    reserveMutation.mutate({ campaignId, comboId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, comboId]);

  useEffect(() => {
    if (!session) {
      setRemainingMs(0);
      return;
    }
    const update = () => {
      setRemainingMs(Math.max(0, new Date(session.expiresAt).getTime() - Date.now()));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const regenMutation = useMutation({
    mutationFn: regenerateNumbersRequest,
    onSuccess: (data) => {
      if (!session) return;
      const updated: ReservationSessionData = {
        ...session,
        ...data,
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

  const cancelReservationMutation = useMutation({
    mutationFn: cancelReservationRequest,
    onSuccess: () => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      router.push('/');
    },
    onError: () => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      router.push('/');
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
        sessionStorage.setItem(orderStorageKey, JSON.stringify(data));
      } catch {
        // ignore
      }
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo crear el pedido');
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: cancelOrderRequest,
    onSuccess: () => {
      try {
        sessionStorage.removeItem(orderStorageKey);
      } catch {
        // ignore
      }
      router.push('/');
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo cancelar el pedido');
    },
  });

  const proofMutation = useMutation({
    mutationFn: uploadProofRequest,
    onSuccess: () => {
      setProofUploaded(true);
      setErrorMsg(null);
      try {
        sessionStorage.removeItem(orderStorageKey);
      } catch {
        // ignore
      }
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'Error al subir el comprobante');
    },
  });

  if (!campaignId || !comboId) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader />
        <div className="flex-1 mx-auto max-w-xl px-4 py-16 text-center space-y-4">
          <p className="text-slate-600">Seleccioná un combo desde una campaña activa primero.</p>
          <Link href="/" className="text-blue-600 font-semibold hover:underline">
            Ir al inicio
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const currentStep: 1 | 2 | 3 = proofUploaded ? 3 : order ? 2 : 1;
  const isSessionExpired = Boolean(session && remainingMs <= 0);
  const addedInverseNumbers = new Set(
    (session?.inverseAdditions ?? []).map((item) => item.inverseNumber),
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      {/* Header & Stepper */}
      <div className="border-b border-slate-200/80 bg-gradient-to-b from-blue-50/70 to-slate-50 py-8 px-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-5xl text-center space-y-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">
              Último paso
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Finalizá tu compra
            </h1>
            <p className="text-sm text-slate-600">
              Completá tus datos y confirmá el pago para asegurar tus pases digitales y fichas.
            </p>
          </div>
          <CheckoutStepper step={currentStep} />
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {!order ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
            {/* Step 1 Left: Personal Info Form */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-extrabold text-white">
                  1
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Información personal
                  </p>
                  <h2 className="text-lg font-extrabold text-slate-900">Tus datos</h2>
                </div>
              </div>

              <form
                id="checkout-customer-form"
                onSubmit={handleSubmit((values) => {
                  if (!session || isSessionExpired) return;
                  orderMutation.mutate({
                    sessionId: session.sessionId,
                    sessionToken: session.sessionToken,
                    ...values,
                  });
                })}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('firstName')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Ej. María"
                    />
                    {errors.firstName ? (
                      <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Apellidos <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('lastName')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Ej. Rojas Brenes"
                    />
                    {errors.lastName ? (
                      <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Teléfono (SINPE / WhatsApp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('phone')}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="88887777"
                  />
                  {errors.phone ? (
                    <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Dirección de correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="maria@ejemplo.com"
                  />
                  {errors.email ? (
                    <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                  ) : null}
                </div>
              </form>
            </section>

            {/* Step 1 Right: Order Summary + Continue */}
            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">Resumen del pedido</h2>
                  {session ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isSessionExpired
                          ? 'bg-red-100 text-red-700'
                          : remainingMs <= 120_000
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {isSessionExpired ? 'Expirada' : formatRemaining(remainingMs)}
                    </span>
                  ) : null}
                </div>

                {reserveMutation.isPending || !session ? (
                  <div className="py-6 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-16 rounded-xl" />
                      ))}
                    </div>
                    <Skeleton className="h-4 w-48" />
                  </div>
                ) : isSessionExpired ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center space-y-3">
                    <p className="text-sm font-medium text-red-800">
                      El tiempo de tu reserva expiró y los números fueron liberados.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSession(null);
                        reserveMutation.mutate({ campaignId, comboId });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reservar nuevos números
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 text-sm">
                      {session.campaignTitle ? (
                        <p className="font-extrabold text-slate-900 uppercase tracking-tight">
                          {session.campaignTitle}
                        </p>
                      ) : null}
                      <p className="text-slate-600">
                        Paquete:{' '}
                        <strong className="text-slate-900">
                          {session.packageCount > 1 ? `${session.packageCount} × ` : ''}
                          {session.comboName}
                        </strong>
                      </p>
                      <p className="text-xs text-slate-500">
                        {session.passQuantity}{' '}
                        {session.passQuantity === 1 ? 'pase digital' : 'pases digitales'} ·{' '}
                        {session.fichaQuantity}{' '}
                        {session.fichaQuantity === 1 ? 'ficha' : 'fichas'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Tus fichas
                        </span>
                        {session.remainingChanges > 0 ? (
                          <button
                            type="button"
                            disabled={regenMutation.isPending}
                            onClick={() =>
                              regenMutation.mutate({
                                sessionId: session.sessionId,
                                sessionToken: session.sessionToken,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${regenMutation.isPending ? 'animate-spin' : ''}`}
                            />
                            Cambiar ({session.remainingChanges} rest.)
                          </button>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {session.numbers.map((num) => {
                          const isInv = addedInverseNumbers.has(num);
                          return (
                            <span
                              key={num}
                              className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                                isInv
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}
                            >
                              {num}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t pt-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">Total a pagar</span>
                      <span className="text-xl font-extrabold text-blue-700">
                        {formatCRC(session.price)}
                      </span>
                    </div>

                    <button
                      type="submit"
                      form="checkout-customer-form"
                      disabled={orderMutation.isPending}
                      className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition"
                    >
                      {orderMutation.isPending
                        ? 'Creando pedido...'
                        : `Continuar al pago (${formatCRC(session.price)})`}
                    </button>
                  </>
                )}
              </div>

              {session && !isSessionExpired ? (
                <div className="text-center">
                  <button
                    type="button"
                    disabled={cancelReservationMutation.isPending || orderMutation.isPending}
                    onClick={() =>
                      cancelReservationMutation.mutate({
                        sessionId: session.sessionId,
                        sessionToken: session.sessionToken,
                      })
                    }
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                  >
                    {cancelReservationMutation.isPending
                      ? 'Liberando fichas...'
                      : 'Cancelar compra'}
                  </button>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Libera tus fichas y vuelve al inicio.
                  </p>
                </div>
              ) : null}
            </aside>
          </div>
        ) : (
          <SinpePaymentStep
            order={order}
            proofUploaded={proofUploaded}
            proofFile={proofFile}
            isUploading={proofMutation.isPending}
            isCancelling={cancelOrderMutation.isPending}
            onFileSelect={setProofFile}
            onUploadProof={() => {
              if (!proofFile) return;
              proofMutation.mutate({
                publicReference: order.publicReference,
                accessToken: order.accessToken,
                file: proofFile,
              });
            }}
            onCancelOrder={() =>
              cancelOrderMutation.mutate({
                publicReference: order.publicReference,
                accessToken: order.accessToken,
              })
            }
          />
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
        <div className="mx-auto max-w-5xl px-4 py-10">
          <DetailSkeleton />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
