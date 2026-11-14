'use client';

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatCRC } from '@/lib/utils';
import type { CreatedOrderData } from '@/services/checkout';

interface SinpePaymentStepProps {
  order: CreatedOrderData;
  proofUploaded: boolean;
  proofFile: File | null;
  isUploading: boolean;
  isCancelling: boolean;
  onFileSelect: (file: File | null) => void;
  onUploadProof: () => void;
  onCancelOrder: () => void;
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function formatSinpePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return phone;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function SinpePaymentStep({
  order,
  proofUploaded,
  proofFile,
  isUploading,
  isCancelling,
  onFileSelect,
  onUploadProof,
  onCancelOrder,
}: SinpePaymentStepProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [copiedField, setCopiedField] = useState<'phone' | 'amount' | 'ref' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    Math.max(0, new Date(order.expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const update = () => {
      setRemainingMs(Math.max(0, new Date(order.expiresAt).getTime() - Date.now()));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [order.expiresAt]);

  useEffect(() => {
    if (!proofFile || !proofFile.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  const handleCopy = async (field: 'phone' | 'amount' | 'ref', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const validateAndSelectFile = (file: File | null) => {
    if (!file) {
      setFileError(null);
      onFileSelect(null);
      return;
    }
    if (!ALLOWED_MIME.has(file.type)) {
      setFileError('Formato no permitido. Subí una imagen JPG, PNG, WEBP o un archivo PDF.');
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setFileError('El archivo supera el máximo permitido de 5 MB.');
      return;
    }
    setFileError(null);
    onFileSelect(file);
  };

  if (proofUploaded) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <div className="space-y-2">
          <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Comprobante recibido
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900">Estamos verificando tu pago</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Recibimos tu comprobante para el pedido{' '}
            <strong className="font-mono text-slate-900">{order.publicReference}</strong>. Tus
            chances quedan protegidos mientras nuestro equipo confirma el ingreso bancario y envía
            tus pases digitales al correo.
          </p>
        </div>

        <div className="rounded-2xl border bg-slate-50 p-4 flex flex-wrap items-center justify-center gap-2">
          {order.numbers.map((num) => (
            <span
              key={num}
              className="rounded-lg bg-blue-600 px-3 py-1 font-mono text-xs font-bold text-white"
            >
              {num}
            </span>
          ))}
        </div>

        <Link
          href={`/pedido?ref=${encodeURIComponent(order.publicReference)}&token=${encodeURIComponent(order.accessToken)}`}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
        >
          Consultar estado del pedido
        </Link>
      </section>
    );
  }

  const isExpired = remainingMs <= 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
      {/* Left column: SINPE Receiver + Proof Upload */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
              Paso 2 · Transferencia SINPE Móvil
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Realizá tu pago por SINPE Móvil
            </h2>
            <p className="text-sm text-slate-600">{order.sinpeInstructions.instructions}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isExpired
                ? 'bg-red-100 text-red-700'
                : remainingMs <= 300_000
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {isExpired ? 'Ventana expirada' : `Vence en ${formatRemaining(remainingMs)}`}
          </span>
        </div>

        {/* SINPE Receiver Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Titular de la cuenta
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">
                {order.sinpeInstructions.receiverHolder}
              </p>
              {order.sinpeInstructions.receiverBank ? (
                <p className="text-xs text-slate-500">{order.sinpeInstructions.receiverBank}</p>
              ) : null}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                SINPE Móvil receptor
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono text-lg font-extrabold text-slate-900">
                  {formatSinpePhone(order.sinpeInstructions.receiverPhone)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('phone', order.sinpeInstructions.receiverPhone)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  {copiedField === 'phone' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">Monto exacto</p>
                <p className="text-base font-extrabold text-slate-900">
                  {formatCRC(order.totalAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('amount', String(order.totalAmount))}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                {copiedField === 'amount' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">
                  Referencia / Detalle
                </p>
                <p className="font-mono text-sm font-extrabold text-blue-700">
                  {order.publicReference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('ref', order.publicReference)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
              >
                {copiedField === 'ref' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-950">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            <strong>Importante:</strong>{' '}
            {order.sinpeInstructions.detailNotice ||
              'Colocá tu referencia de pedido en el detalle de la transferencia.'}{' '}
            Usá el código <strong className="font-mono">{order.publicReference}</strong>.
          </p>
        </div>

        {/* Proof Upload Dropzone */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Comprobante de pago <span className="text-red-500">*</span>
            </h3>
            <p className="text-xs text-slate-500">
              Subí la captura de tu transferencia SINPE Móvil (JPG, PNG, WEBP o PDF, máx. 5 MB).
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={(e) => validateAndSelectFile(e.target.files?.[0] ?? null)}
          />

          {!proofFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                validateAndSelectFile(e.dataTransfer.files?.[0] ?? null);
              }}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition space-y-3 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/70'
                  : 'border-blue-200 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm">
                  Seleccionar comprobante
                </span>
                <p className="text-xs font-medium text-blue-600">
                  También podés arrastrar tu archivo aquí
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Vista previa del comprobante"
                    className="h-14 w-14 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <FileText className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{proofFile.name}</p>
                  <p className="text-xs text-slate-500">
                    {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => validateAndSelectFile(null)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Quitar
              </button>
            </div>
          )}

          {fileError ? <p className="text-xs font-medium text-red-600">{fileError}</p> : null}
        </div>

        <button
          type="button"
          disabled={!proofFile || isUploading || isExpired}
          onClick={onUploadProof}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? 'Enviando comprobante...' : 'Confirmar y pagar'}
        </button>
      </section>

      {/* Right column: Order summary + Cancel */}
      <aside className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-slate-900">Resumen del pedido</h3>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700">
              {order.publicReference}
            </span>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-bold text-slate-900">{order.campaign.title}</p>
            <p className="text-xs text-slate-500">
              {order.numbers.length}{' '}
              {order.numbers.length === 1 ? 'chance reservado' : 'chances reservados'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tus chances reservados
            </p>
            <div className="flex flex-wrap gap-1.5">
              {order.numbers.map((num) => (
                <span
                  key={num}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 font-mono text-xs font-bold text-white"
                >
                  {num}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t pt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total a transferir</span>
            <span className="text-xl font-extrabold text-blue-700">
              {formatCRC(order.totalAmount)}
            </span>
          </div>
        </div>

        <div className="text-center">
          <button
            type="button"
            disabled={isCancelling || isUploading}
            onClick={onCancelOrder}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
          >
            {isCancelling ? 'Cancelando pedido...' : 'Cancelar compra'}
          </button>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Libera tus chances y vuelve al inicio.
          </p>
        </div>
      </aside>
    </div>
  );
}
