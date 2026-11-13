'use client';

import { Check, X } from 'lucide-react';
import { formatCRC } from '@/lib/utils';

export interface ProofModalPaymentInfo {
  id: string;
  amount: number;
  status: string;
  order: {
    publicReference: string;
    customer: { fullName: string };
    campaign: { title: string };
  };
}

interface ProofReviewModalProps {
  selectedProof: {
    payment: ProofModalPaymentInfo;
    url: string;
    mimeType: string;
  } | null;
  statusLabel: string;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onClose: () => void;
  onApprove: (paymentId: string) => void;
  onReject: (paymentId: string, reason: string) => void;
  isSubmitting: boolean;
}

export function ProofReviewModal({
  selectedProof,
  statusLabel,
  rejectReason,
  onRejectReasonChange,
  onClose,
  onApprove,
  onReject,
  isSubmitting,
}: ProofReviewModalProps) {
  if (!selectedProof) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">
              Comprobante · {selectedProof.payment.order.publicReference}
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {selectedProof.payment.order.campaign.title} ·{' '}
              {selectedProof.payment.order.customer.fullName} ·{' '}
              {formatCRC(selectedProof.payment.amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <X className="h-4 w-4" /> Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
          {selectedProof.mimeType.startsWith('image/') ? (
            <img
              src={selectedProof.url}
              alt={`Comprobante ${selectedProof.payment.order.publicReference}`}
              decoding="async"
              className="max-h-[65vh] w-auto rounded-lg object-contain shadow"
            />
          ) : (
            <iframe
              src={selectedProof.url}
              title={`Comprobante ${selectedProof.payment.order.publicReference}`}
              className="h-[65vh] w-full rounded-lg border bg-white"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-white px-5 py-3">
          {selectedProof.payment.status === 'UNDER_REVIEW' ? (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <input
                value={rejectReason}
                onChange={(e) => onRejectReasonChange(e.target.value)}
                placeholder="Motivo de rechazo (opcional)"
                className="flex-1 min-w-[200px] rounded-lg border px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() =>
                  onReject(
                    selectedProof.payment.id,
                    rejectReason.trim() || 'Comprobante rechazado en revisión manual',
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                <X className="h-3.5 w-3.5" /> Rechazar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onApprove(selectedProof.payment.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Check className="h-3.5 w-3.5" /> Aprobar pago
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500">
              Estado actual: <strong>{statusLabel}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
