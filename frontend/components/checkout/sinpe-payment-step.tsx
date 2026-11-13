'use client';

import { CheckCircle2, Upload } from 'lucide-react';
import Link from 'next/link';
import { formatCRC } from '@/lib/utils';
import type { CreatedOrderData } from '@/services/checkout';

interface SinpePaymentStepProps {
  order: CreatedOrderData;
  proofUploaded: boolean;
  proofFile: File | null;
  isUploading: boolean;
  onFileSelect: (file: File | null) => void;
  onUploadProof: () => void;
}

export function SinpePaymentStep({
  order,
  proofUploaded,
  proofFile,
  isUploading,
  onFileSelect,
  onUploadProof,
}: SinpePaymentStepProps) {
  if (proofUploaded) {
    return (
      <section className="rounded-2xl border bg-white p-6 sm:p-8 shadow-sm text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
        <h1 className="text-2xl font-extrabold text-slate-900">Estamos verificando tu pago</h1>
        <p className="text-sm text-slate-600">
          Recibimos tu comprobante para el pedido <strong>{order.publicReference}</strong>. Tus
          chances quedan protegidos mientras nuestro equipo confirma el ingreso bancario.
        </p>
        <Link
          href={`/pedido?ref=${encodeURIComponent(order.publicReference)}&token=${encodeURIComponent(order.accessToken)}`}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Consultar estado del pedido
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-5">
      <div className="space-y-1">
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          ¡Tus chances están listos!
        </span>
        <h1 className="text-2xl font-extrabold text-slate-900">Pedido {order.publicReference}</h1>
        <p className="text-sm text-slate-600">{order.sinpeInstructions.instructions}</p>
      </div>

      <div className="rounded-xl bg-slate-50 border p-4 space-y-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-500">Monto exacto SINPE Móvil:</span>
          <span className="font-bold text-slate-900">{formatCRC(order.totalAmount)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-500">Referencia / Detalle:</span>
          <span className="font-mono font-bold text-blue-700">{order.publicReference}</span>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h2 className="font-bold text-slate-900">Adjuntá tu comprobante</h2>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          type="button"
          disabled={!proofFile || isUploading}
          onClick={onUploadProof}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? 'Subiendo comprobante...' : 'Enviar comprobante SINPE'}
        </button>
      </div>
    </section>
  );
}
