'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { formatCRC } from '@/lib/utils';
import {
  getPublicOrderRequest,
  lookupPublicOrdersByCustomerRequest,
  type PublicOrderDetail,
} from '@/services/checkout';

function OrderResultCard({ order }: { order: PublicOrderDetail }) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            {order.campaign.title}
          </p>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {order.publicReference}
          </h2>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          {order.status}
        </span>
      </div>

      <div className="text-sm text-slate-600">
        Total: <strong>{formatCRC(order.totalAmount)}</strong>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900">Tus chances</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {order.chances.map((c) => (
            <div
              key={c.number}
              className="rounded-lg border bg-amber-50 py-2 text-center font-mono text-sm font-bold text-slate-900"
            >
              {c.number}
            </div>
          ))}
        </div>
      </div>

      {order.status === 'CONFIRMED' && order.passDownloads.length > 0 ? (
        <div className="border-t pt-4 space-y-2">
          <h3 className="text-sm font-bold text-emerald-700">
            ¡Tu compra fue confirmada! Descargá tus pases:
          </h3>
          <div className="flex flex-wrap gap-2">
            {order.passDownloads.map((pass) => (
              <a
                key={pass.name}
                href={pass.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Download className="h-3.5 w-3.5" />
                {pass.name}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OrderLookupContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get('ref') ?? '';
  const initialToken = searchParams.get('token') ?? '';

  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [customerQuery, setCustomerQuery] = useState<{ email: string; phone: string } | null>(null);

  const directQuery = useQuery({
    queryKey: ['public-order', initialRef, initialToken],
    queryFn: () => getPublicOrderRequest(initialRef, initialToken),
    enabled: Boolean(initialRef && initialToken),
    retry: false,
  });

  const customerOrdersQuery = useQuery({
    queryKey: ['public-orders-customer', customerQuery?.email, customerQuery?.phone],
    queryFn: () => lookupPublicOrdersByCustomerRequest(customerQuery!.email, customerQuery!.phone),
    enabled: Boolean(customerQuery),
    retry: false,
  });

  const isLoading = directQuery.isLoading || customerOrdersQuery.isLoading;
  const isError = directQuery.isError || customerOrdersQuery.isError;
  const orders: PublicOrderDetail[] = customerQuery
    ? (customerOrdersQuery.data ?? [])
    : directQuery.data
      ? [directQuery.data]
      : [];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </Link>
          <span className="font-bold text-blue-600 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Premiático
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (emailInput.trim() && phoneInput.trim()) {
              setCustomerQuery({
                email: emailInput.trim().toLowerCase(),
                phone: phoneInput.trim(),
              });
            }
          }}
          className="rounded-2xl border bg-white p-6 shadow-sm space-y-4"
        >
          <div>
            <h1 className="text-xl font-bold text-slate-900">Consultá tus pedidos</h1>
            <p className="text-sm text-slate-500 mt-1">
              Ingresá el correo electrónico y número de teléfono con los que realizaste tu compra en campañas activas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Correo electrónico registrado"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="tel"
              required
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Teléfono registrado (ej. 88887777)"
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Search className="h-4 w-4" />
            Consultar estado
          </button>
        </form>

        {isLoading ? (
          <div className="text-center text-sm text-slate-500 py-6">Buscando pedidos...</div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No pudimos consultar tus pedidos. Verificá que el correo y teléfono tengan el formato correcto.
          </div>
        ) : customerQuery && orders.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No encontramos pedidos en campañas activas con ese correo y teléfono.
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderResultCard key={order.publicReference} order={order} />
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function PedidoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
          Cargando...
        </div>
      }
    >
      <OrderLookupContent />
    </Suspense>
  );
}
