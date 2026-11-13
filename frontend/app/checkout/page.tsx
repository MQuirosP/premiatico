'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ReservationSummaryCard } from '@/components/checkout/reservation-summary-card';
import { SinpePaymentStep } from '@/components/checkout/sinpe-payment-step';
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
      setErrorMsg(err instanceof ApiError ? err.message : 'No pudimos reservar tus chances');
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
        sessionStorage.setItem(orderStorageKey, JSON.stringify(data));
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
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <p className="text-slate-600">Seleccioná un combo desde una campaña activa primero.</p>
        <Link href="/" className="text-blue-600 font-semibold hover:underline">
          Ir al inicio
        </Link>
      </div>
    );
  }

  const isSessionExpired = Boolean(session && new Date(session.expiresAt).getTime() <= Date.now());

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
            <ReservationSummaryCard
              session={session}
              isReserving={reserveMutation.isPending}
              isRegenerating={regenMutation.isPending}
              onRegenerate={() => {
                if (!session) return;
                regenMutation.mutate({
                  sessionId: session.sessionId,
                  sessionToken: session.sessionToken,
                });
              }}
              onReserveAgain={() => {
                setSession(null);
                reserveMutation.mutate({ campaignId, comboId });
              }}
            />

            {session && !isSessionExpired ? (
              <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
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
        ) : (
          <SinpePaymentStep
            order={order}
            proofUploaded={proofUploaded}
            proofFile={proofFile}
            isUploading={proofMutation.isPending}
            onFileSelect={setProofFile}
            onUploadProof={() => {
              if (!proofFile) return;
              proofMutation.mutate({
                publicReference: order.publicReference,
                accessToken: order.accessToken,
                file: proofFile,
              });
            }}
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
        <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
          Cargando checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
