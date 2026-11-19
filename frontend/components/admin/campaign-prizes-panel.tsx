'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Calendar,
  CheckCircle2,
  Dices,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  CAMPAIGN_DRAW_MODE,
  ORDER_CHANNEL,
  PRIZE_AMOUNT_SCOPE,
  PRIZE_CATEGORY,
  PRIZE_DRAW_WEIGHT_MODE,
  isCampaignReadOnly,
  type CampaignDrawMode,
  type OrderChannel,
  type PrizeAmountScope,
  type PrizeDrawWeightMode,
} from '@/lib/domain-constants';
import { formatCRC } from '@/lib/utils';
import {
  createAdminDailyPrizeSeries,
  createAdminPrizes,
  deleteAdminPrize,
  drawRandomAdminPrizeWinner,
  evaluateAdminPrizeWinner,
  getAdminPrizeEligibleSummary,
  notifyAdminPrizeWinnerEmail,
  resetAdminPrizeEvaluation,
  type AdminCampaignPrize,
  type PrizeEligibleSummary,
} from '@/services/campaigns';

const PRIZE_CREATE_MODE = {
  SINGLE: 'SINGLE',
  DAILY_SERIES: 'DAILY_SERIES',
} as const;

type PrizeCreateMode = (typeof PRIZE_CREATE_MODE)[keyof typeof PRIZE_CREATE_MODE];

interface CampaignPrizesPanelProps {
  campaignId: string;
  campaignStatus: string;
  drawMode?: CampaignDrawMode;
  digits: number;
  maxNumberLabel: string;
  prizes: AdminCampaignPrize[];
  combos?: Array<{ id: string; name: string }>;
}

export function CampaignPrizesPanel({
  campaignId,
  campaignStatus,
  drawMode = CAMPAIGN_DRAW_MODE.MULTI_PRIZE,
  digits,
  maxNumberLabel,
  prizes,
  combos = [],
}: CampaignPrizesPanelProps) {
  const isSingleWinnerCampaign = drawMode === CAMPAIGN_DRAW_MODE.SINGLE_WINNER;
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [createMode, setCreateMode] = useState<PrizeCreateMode>(PRIZE_CREATE_MODE.SINGLE);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [amountScope, setAmountScope] = useState<PrizeAmountScope>(PRIZE_AMOUNT_SCOPE.PER_ORDER);
  const [minTickets, setMinTickets] = useState('');
  const [purchaseFrom, setPurchaseFrom] = useState('');
  const [purchaseUntil, setPurchaseUntil] = useState('');
  const [requiredComboId, setRequiredComboId] = useState('');
  const [orderChannel, setOrderChannel] = useState<OrderChannel | ''>('');
  const [drawWeightMode, setDrawWeightMode] = useState<PrizeDrawWeightMode>(
    PRIZE_DRAW_WEIGHT_MODE.PER_TICKET,
  );
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);
  const [drawReference, setDrawReference] = useState('');
  const [drawAt, setDrawAt] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [drawTime, setDrawTime] = useState('19:30');

  const [activePrizeId, setActivePrizeId] = useState<string | null>(null);
  const [winningNumber, setWinningNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [allowDuplicateOrder, setAllowDuplicateOrder] = useState(false);
  const [eligiblePreview, setEligiblePreview] = useState<PrizeEligibleSummary | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-campaign-detail', campaignId] });

  const resetPrizeForm = () => {
    setShowAddForm(false);
    setName('');
    setDescription('');
    setEstimatedValue('');
    setMinOrderAmount('');
    setAmountScope(PRIZE_AMOUNT_SCOPE.PER_ORDER);
    setMinTickets('');
    setPurchaseFrom('');
    setPurchaseUntil('');
    setRequiredComboId('');
    setOrderChannel('');
    setDrawWeightMode(PRIZE_DRAW_WEIGHT_MODE.PER_TICKET);
    setShowAdvancedRules(false);
    setDrawReference('');
    setDrawAt('');
    setQuantity(1);
    setStartDate('');
    setEndDate('');
    setDrawTime('19:30');
    setErrorMsg(null);
  };

  const previewEligibleMutation = useMutation({
    mutationFn: (payload: { prizeId: string; allowDuplicateOrder: boolean }) =>
      getAdminPrizeEligibleSummary(payload.prizeId, payload.allowDuplicateOrder),
    onSuccess: (summary) => {
      setEligiblePreview(summary);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiError ? err.message : 'No se pudo calcular la lista de elegibles',
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: createAdminPrizes,
    onSuccess: () => {
      resetPrizeForm();
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudieron crear los premios');
    },
  });

  const createDailySeriesMutation = useMutation({
    mutationFn: createAdminDailyPrizeSeries,
    onSuccess: (res) => {
      resetPrizeForm();
      setStatusMsg(`Se creó la serie diaria con ${res.count} premios.`);
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo crear la serie diaria');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminPrize,
    onSuccess: () => {
      setErrorMsg(null);
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo eliminar el premio');
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: ({
      prizeId,
      payload,
    }: {
      prizeId: string;
      payload: { winningNumber: string; notes?: string; allowDuplicateOrder?: boolean };
    }) => evaluateAdminPrizeWinner(prizeId, payload),
    onSuccess: () => {
      setActivePrizeId(null);
      setWinningNumber('');
      setNotes('');
      setAllowDuplicateOrder(false);
      setErrorMsg(null);
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo evaluar este sorteo');
    },
  });

  const drawRandomMutation = useMutation({
    mutationFn: ({
      prizeId,
      payload,
    }: {
      prizeId: string;
      payload: { notes?: string; allowDuplicateOrder?: boolean };
    }) => drawRandomAdminPrizeWinner(prizeId, payload),
    onSuccess: () => {
      setActivePrizeId(null);
      setWinningNumber('');
      setNotes('');
      setAllowDuplicateOrder(false);
      setErrorMsg(null);
      void refresh();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo realizar el sorteo al azar');
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetAdminPrizeEvaluation,
    onSuccess: () => {
      setActivePrizeId(null);
      setWinningNumber('');
      setNotes('');
      setErrorMsg(null);
      setStatusMsg('Evaluación revertida. El premio volvió a estado pendiente.');
      void refresh();
    },
    onError: (err) => {
      setStatusMsg(null);
      if (err instanceof ApiError && err.status === 404) {
        setErrorMsg(
          'La opción para revertir evaluación aún se está actualizando en el servidor. Intentá de nuevo en unos minutos.',
        );
        return;
      }
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo revertir la evaluación');
    },
  });

  const [emailFeedbackByPrize, setEmailFeedbackByPrize] = useState<
    Record<
      string,
      { status: 'sent' | 'already_sent' | 'info' | 'error'; message: string }
    >
  >({});

  const notifyEmailMutation = useMutation({
    mutationFn: ({ prizeId, forceResend }: { prizeId: string; forceResend?: boolean }) =>
      notifyAdminPrizeWinnerEmail(prizeId, Boolean(forceResend)),
    onSuccess: (res, variables) => {
      setErrorMsg(null);
      if (res.sent) {
        const msg = `Correo de ganador enviado a ${res.recipientEmail}.`;
        setStatusMsg(msg);
        setEmailFeedbackByPrize((prev) => ({
          ...prev,
          [variables.prizeId]: { status: 'sent', message: msg },
        }));
      } else if (res.skippedReason === 'RESEND_NOT_CONFIGURED') {
        const msg = `El servicio automático de correo aún no está configurado. Podés usar "Abrir en correo" o WhatsApp para notificar a ${res.recipientEmail}.`;
        setStatusMsg(msg);
        setEmailFeedbackByPrize((prev) => ({
          ...prev,
          [variables.prizeId]: { status: 'info', message: msg },
        }));
      } else if (res.skippedReason === 'ALREADY_SENT') {
        const msg = `Ya se había enviado la notificación por correo a ${res.recipientEmail}.`;
        setStatusMsg(msg);
        setEmailFeedbackByPrize((prev) => ({
          ...prev,
          [variables.prizeId]: { status: 'already_sent', message: msg },
        }));
      } else {
        const msg = res.errorMessage || 'No se pudo enviar el correo al ganador';
        setErrorMsg(msg);
        setEmailFeedbackByPrize((prev) => ({
          ...prev,
          [variables.prizeId]: { status: 'error', message: msg },
        }));
      }
    },
    onError: (err, variables) => {
      setStatusMsg(null);
      const msg =
        err instanceof ApiError && err.status === 404
          ? 'El envío automático de correo todavía no está disponible en el servidor.'
          : err instanceof ApiError
            ? err.message
            : 'No se pudo notificar por correo';
      setErrorMsg(msg);
      setEmailFeedbackByPrize((prev) => ({
        ...prev,
        [variables.prizeId]: { status: 'error', message: msg },
      }));
    },
  });

  const normalizeCostaRicaPhone = (phone: string): string => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length === 8) return `506${digitsOnly}`;
    return digitsOnly;
  };

  const buildWinnerMessage = (prize: AdminCampaignPrize): string => {
    const customerName = prize.winningOrder?.customer.fullName ?? 'Ganador/a';
    const orderRef = prize.winningOrder?.publicReference ?? '';
    const prizeDetail = prize.description?.trim() || prize.name;
    const valueText =
      typeof prize.estimatedValue === 'number' && prize.estimatedValue > 0
        ? ` (${formatCRC(prize.estimatedValue)})`
        : '';
    return [
      `¡Felicidades ${customerName}!`,
      `Tu número ${prize.winningNumber} resultó ganador de ${prizeDetail}${valueText} en el sorteo "${prize.name}" de Premiático.`,
      orderRef ? `Referencia de pedido: ${orderRef}.` : '',
      'Pronto coordinaremos la entrega de tu premio.',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleNativeShare = async (prize: AdminCampaignPrize) => {
    const text = buildWinnerMessage(prize);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `¡Ganador de ${prize.name} en Premiático!`,
          text,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setErrorMsg(null);
      setStatusMsg('Mensaje del ganador copiado al portapapeles para compartir.');
    }
  };

  const canDelete = !isCampaignReadOnly(campaignStatus);
  const evaluatedCount = prizes.filter((p) => Boolean(p.winnerEvaluatedAt)).length;

  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              {isSingleWinnerCampaign
                ? `Sorteos Flash / Dinámicas (${prizes.length})`
                : `Premios y sorteos individuales (${prizes.length})`}
            </h2>
            {prizes.length > 0 ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  evaluatedCount === prizes.length
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {evaluatedCount} de {prizes.length} evaluados
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {isSingleWinnerCampaign ? (
              <>
                Agregá sorteos flash o dinámicas paralelas (por monto mínimo, acumulado, ventana de
                compra o combo) sin cerrar ni afectar el sorteo principal de{' '}
                <strong>{digits} dígitos</strong>.
              </>
            ) : (
              <>
                Creá uno o varios sorteos dentro de la campaña (ej. 6 de Nacional + 6 de Tiempos) y
                evaluá cada ganador por separado con números de <strong>{digits} dígitos</strong> (
                <span className="font-mono">{'0'.repeat(digits)}</span> –{' '}
                <span className="font-mono">{maxNumberLabel}</span>). Al evaluar todos, la campaña
                se marca como completada.
              </>
            )}
          </p>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {isSingleWinnerCampaign ? 'Agregar sorteo flash' : 'Agregar premios / sorteos'}
          </button>
        ) : null}
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {statusMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          {statusMsg}
        </div>
      ) : null}

      {showAddForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsedMinOrderAmount = minOrderAmount ? Number(minOrderAmount) : null;
            const parsedEstimatedValue = estimatedValue ? Number(estimatedValue) : null;
            const eligibilityPayload = {
              prizeType: isSingleWinnerCampaign ? PRIZE_CATEGORY.FLASH : PRIZE_CATEGORY.MAIN,
              minOrderAmount: parsedMinOrderAmount,
              amountScope,
              minTickets: minTickets ? Number(minTickets) : null,
              purchaseFrom: purchaseFrom ? new Date(purchaseFrom).toISOString() : null,
              purchaseUntil: purchaseUntil ? new Date(purchaseUntil).toISOString() : null,
              requiredComboId: requiredComboId || null,
              orderChannel: orderChannel || null,
              drawWeightMode,
            };

            if (createMode === PRIZE_CREATE_MODE.DAILY_SERIES) {
              createDailySeriesMutation.mutate({
                campaignId,
                name,
                description,
                estimatedValue: parsedEstimatedValue,
                drawReference: drawReference.trim() || null,
                startDate,
                endDate,
                drawTime,
                ...eligibilityPayload,
              });
              return;
            }

            createMutation.mutate({
              campaignId,
              name,
              description,
              estimatedValue: parsedEstimatedValue,
              drawReference: drawReference.trim() || null,
              drawAt: drawAt ? new Date(drawAt).toISOString() : null,
              quantity,
              ...eligibilityPayload,
            });
          }}
          className="rounded-xl border bg-slate-50 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCreateMode(PRIZE_CREATE_MODE.SINGLE)}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  createMode === PRIZE_CREATE_MODE.SINGLE
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Premio individual / lote
              </button>
              <button
                type="button"
                onClick={() => setCreateMode(PRIZE_CREATE_MODE.DAILY_SERIES)}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  createMode === PRIZE_CREATE_MODE.DAILY_SERIES
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Serie diaria por fechas
              </button>
            </div>
            {createMode === PRIZE_CREATE_MODE.DAILY_SERIES ? (
              <span className="text-[11px] text-slate-500">
                Crea 1 premio por cada día del rango (máx. 60 días), numerado automáticamente.
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre del premio
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Premio Lotería Nacional"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sorteo de referencia
              </label>
              <input
                value={drawReference}
                onChange={(e) => setDrawReference(e.target.value)}
                placeholder="Ej. Tiempos Mediodía / Nacional"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            {createMode === PRIZE_CREATE_MODE.SINGLE ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Fecha / hora del sorteo
                  </label>
                  <input
                    type="datetime-local"
                    value={drawAt}
                    onChange={(e) => setDrawAt(e.target.value)}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Cantidad a crear (lote)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Fecha inicio
                  </label>
                  <input
                    required
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Fecha fin
                  </label>
                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Hora del sorteo (CR)
                  </label>
                  <input
                    required
                    type="time"
                    value={drawTime}
                    onChange={(e) => setDrawTime(e.target.value)}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Monto / valor estimado (CRC)
              </label>
              <input
                type="number"
                min={0}
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="2000000"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Compra mínima para participar (CRC, opcional)
              </label>
              <input
                type="number"
                min={0}
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="Ej. 8000 (vacío = cualquier monto)"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Descripción
              </label>
              <input
                required
                minLength={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. ₡2,000,000 en efectivo con Tica Noche"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="button"
                onClick={() => setShowAdvancedRules((v) => !v)}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                {showAdvancedRules
                  ? '− Ocultar criterios avanzados de elegibilidad'
                  : '+ Configurar criterios avanzados (acumulado, ventana de compra, combo, peso)'}
              </button>
              {showAdvancedRules ? (
                <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Alcance del monto / fichas mínimas
                    </label>
                    <select
                      value={amountScope}
                      onChange={(e) => setAmountScope(e.target.value as PrizeAmountScope)}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                      <option value={PRIZE_AMOUNT_SCOPE.PER_ORDER}>Por pedido individual</option>
                      <option value={PRIZE_AMOUNT_SCOPE.CUSTOMER_TOTAL}>
                        Acumulado por cliente en la campaña
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Mínimo de fichas (opcional)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={minTickets}
                      onChange={(e) => setMinTickets(e.target.value)}
                      placeholder="Ej. 4"
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Peso en tómbola aleatoria
                    </label>
                    <select
                      value={drawWeightMode}
                      onChange={(e) => setDrawWeightMode(e.target.value as PrizeDrawWeightMode)}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                      <option value={PRIZE_DRAW_WEIGHT_MODE.PER_TICKET}>
                        1 oportunidad por ficha
                      </option>
                      <option value={PRIZE_DRAW_WEIGHT_MODE.PER_CUSTOMER}>
                        1 oportunidad por cliente único
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Compras confirmadas desde (opcional)
                    </label>
                    <input
                      type="datetime-local"
                      value={purchaseFrom}
                      onChange={(e) => setPurchaseFrom(e.target.value)}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Compras confirmadas hasta (opcional)
                    </label>
                    <input
                      type="datetime-local"
                      value={purchaseUntil}
                      onChange={(e) => setPurchaseUntil(e.target.value)}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Canal de compra (opcional)
                    </label>
                    <select
                      value={orderChannel}
                      onChange={(e) => setOrderChannel(e.target.value as OrderChannel | '')}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Todos los canales</option>
                      <option value={ORDER_CHANNEL.WEB}>Solo Web</option>
                      <option value={ORDER_CHANNEL.PARTNER}>Solo Vendedores / POS</option>
                    </select>
                  </div>
                  {combos.length > 0 ? (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Combo específico requerido (opcional)
                      </label>
                      <select
                        value={requiredComboId}
                        onChange={(e) => setRequiredComboId(e.target.value)}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Cualquier combo</option>
                        {combos.map((combo) => (
                          <option key={combo.id} value={combo.id}>
                            {combo.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || createDailySeriesMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {createMutation.isPending || createDailySeriesMutation.isPending
                ? 'Creando...'
                : createMode === PRIZE_CREATE_MODE.DAILY_SERIES
                  ? 'Crear serie diaria'
                  : quantity > 1
                    ? `Crear ${quantity} premios`
                    : 'Guardar premio'}
            </button>
          </div>
        </form>
      ) : null}

      {prizes.length === 0 ? (
        <p className="text-xs text-slate-500">
          No hay premios individuales configurados aún. Agregalos aquí para evaluar múltiples
          sorteos en esta campaña.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {prizes.map((prize) => {
            const isEvaluating = activePrizeId === prize.id;
            const isEvaluated = Boolean(prize.winningNumber && prize.winnerEvaluatedAt);
            const isBeforeDrawAt = Boolean(
              prize.drawAt && new Date(prize.drawAt).getTime() > Date.now(),
            );

            return (
              <div
                key={prize.id}
                className="rounded-xl border bg-slate-50/70 p-4 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{prize.name}</h3>
                      <p className="text-xs text-slate-600">{prize.description}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isEvaluated
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isEvaluated ? `Ganador: ${prize.winningNumber}` : 'Pendiente'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    {prize.drawReference ? (
                      <span className="font-semibold text-blue-700">{prize.drawReference}</span>
                    ) : null}
                    {prize.drawAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(prize.drawAt).toLocaleString('es-CR')}
                      </span>
                    ) : null}
                    {prize.estimatedValue ? (
                      <span className="font-semibold text-emerald-700">
                        {formatCRC(prize.estimatedValue)}
                      </span>
                    ) : null}
                    {prize.minOrderAmount && prize.minOrderAmount > 0 ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                        Mín. {formatCRC(prize.minOrderAmount)}
                        {prize.amountScope === PRIZE_AMOUNT_SCOPE.CUSTOMER_TOTAL
                          ? ' (acum.)'
                          : ''}
                      </span>
                    ) : null}
                    {prize.prizeType === PRIZE_CATEGORY.FLASH ? (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">
                        Flash
                      </span>
                    ) : null}
                    {prize.minTickets && prize.minTickets > 0 ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                        Mín. {prize.minTickets} fichas
                      </span>
                    ) : null}
                    {prize.drawWeightMode === PRIZE_DRAW_WEIGHT_MODE.PER_CUSTOMER ? (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 font-semibold text-teal-700">
                        1x cliente
                      </span>
                    ) : null}
                    {prize.purchaseFrom || prize.purchaseUntil ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                        Ventana de compra
                      </span>
                    ) : null}
                  </div>
                </div>

                {isEvaluated ? (
                  <div
                    className={`rounded-lg border p-3 text-xs space-y-1 ${
                      prize.winningOrder
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Número {prize.winningNumber}
                      </span>
                      <span className="text-[11px] opacity-80">
                        {new Date(prize.winnerEvaluatedAt!).toLocaleString('es-CR')}
                      </span>
                    </div>
                    {prize.winningOrder ? (
                      <div className="space-y-1.5">
                        <div className="space-y-0.5">
                          <p className="font-semibold">
                            {prize.winningOrder.customer.fullName} ·{' '}
                            <span className="font-mono">{prize.winningOrder.publicReference}</span>
                          </p>
                          <p className="text-[11px]">
                            {prize.winningOrder.customer.phone} · {prize.winningOrder.customer.email}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <a
                            href={`https://wa.me/${normalizeCostaRicaPhone(
                              prize.winningOrder.customer.phone,
                            )}?text=${encodeURIComponent(buildWinnerMessage(prize))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleNativeShare(prize)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                          >
                            <Share2 className="h-3 w-3" />
                            Compartir
                          </button>
                          {(() => {
                            const isSendingThis =
                              notifyEmailMutation.isPending &&
                              notifyEmailMutation.variables?.prizeId === prize.id;
                            return (
                              <button
                                type="button"
                                disabled={isSendingThis}
                                onClick={() =>
                                  notifyEmailMutation.mutate({ prizeId: prize.id, forceResend: false })
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60 active:scale-95 transition"
                              >
                                {isSendingThis ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Mail className="h-3 w-3" />
                                )}
                                {isSendingThis ? 'Enviando...' : 'Enviar correo'}
                              </button>
                            );
                          })()}
                          <a
                            href={`mailto:${prize.winningOrder.customer.email}?subject=${encodeURIComponent(
                              `¡Felicidades ${prize.winningOrder.customer.fullName}! Ganaste ${prize.description?.trim() || prize.name} (${prize.name}) en Premiático`,
                            )}&body=${encodeURIComponent(buildWinnerMessage(prize))}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Mail className="h-3 w-3" />
                            Abrir en correo
                          </a>
                        </div>
                        {(() => {
                          const fb = emailFeedbackByPrize[prize.id];
                          if (!fb) return null;
                          const isResendingThis =
                            notifyEmailMutation.isPending &&
                            notifyEmailMutation.variables?.prizeId === prize.id;
                          return (
                            <div
                              className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                                fb.status === 'error'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : fb.status === 'sent'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-amber-200 bg-amber-50 text-amber-800'
                              }`}
                            >
                              <span>{fb.message}</span>
                              {fb.status === 'already_sent' ? (
                                <button
                                  type="button"
                                  disabled={isResendingThis}
                                  onClick={() =>
                                    notifyEmailMutation.mutate({
                                      prizeId: prize.id,
                                      forceResend: true,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded border border-blue-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                                >
                                  {isResendingThis ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Mail className="h-3 w-3" />
                                  )}
                                  {isResendingThis ? 'Reenviando...' : 'Reenviar correo'}
                                </button>
                              ) : null}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <p>Número desierto (no vendido/confirmado).</p>
                    )}
                    {prize.winnerNotes ? (
                      <p className="text-[11px] italic">{prize.winnerNotes}</p>
                    ) : null}
                  </div>
                ) : null}

                {isEvaluating ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      evaluateMutation.mutate({
                        prizeId: prize.id,
                        payload: {
                          winningNumber,
                          notes: notes.trim() || undefined,
                          allowDuplicateOrder,
                        },
                      });
                    }}
                    className="rounded-lg border bg-white p-3 space-y-2.5"
                  >
                    <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        minLength={digits}
                        maxLength={digits}
                        value={winningNumber}
                        onChange={(e) =>
                          setWinningNumber(e.target.value.replace(/\D/g, '').slice(0, digits))
                        }
                        placeholder={'0'.repeat(digits)}
                        className="w-full rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold tracking-widest"
                      />
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Nota opcional (ej. 1er premio)"
                        className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={allowDuplicateOrder}
                        onChange={(e) => setAllowDuplicateOrder(e.target.checked)}
                      />
                      Permitir si este pedido ya ganó otro premio de la campaña
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePrizeId(null)}
                        className="rounded-lg border px-2.5 py-1 text-xs text-slate-600"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={drawRandomMutation.isPending || evaluateMutation.isPending}
                        onClick={() =>
                          drawRandomMutation.mutate({
                            prizeId: prize.id,
                            payload: {
                              notes: notes.trim() || undefined,
                              allowDuplicateOrder,
                            },
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        <Dices className="h-3.5 w-3.5" />
                        {drawRandomMutation.isPending ? 'Sorteando...' : 'Sortear al azar'}
                      </button>
                      <button
                        type="submit"
                        disabled={
                          evaluateMutation.isPending ||
                          drawRandomMutation.isPending ||
                          winningNumber.length !== digits
                        }
                        className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                      >
                        {evaluateMutation.isPending ? 'Evaluando...' : 'Evaluar número'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isBeforeDrawAt ? (
                        <span className="text-[11px] font-medium text-slate-500">
                          Evaluación habilitada el{' '}
                          {new Date(prize.drawAt!).toLocaleString('es-CR')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActivePrizeId(prize.id);
                            setWinningNumber(prize.winningNumber ?? '');
                            setNotes(prize.winnerNotes ?? '');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                        >
                          <Trophy className="h-3.5 w-3.5" />
                          {isEvaluated ? 'Re-evaluar' : 'Evaluar ganador'}
                        </button>
                      )}

                      {isEvaluated ? (
                        <button
                          type="button"
                          disabled={resetMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Seguro que querés revertir la evaluación de "${prize.name}"? Quedará como pendiente sin ganador.`,
                              )
                            ) {
                              resetMutation.mutate(prize.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {resetMutation.isPending ? 'Revirtiendo...' : 'Revertir evaluación'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            previewEligibleMutation.isPending &&
                            previewEligibleMutation.variables?.prizeId === prize.id
                          }
                          onClick={() =>
                            previewEligibleMutation.mutate({
                              prizeId: prize.id,
                              allowDuplicateOrder,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Users className="h-3.5 w-3.5" />
                          {previewEligibleMutation.isPending &&
                          previewEligibleMutation.variables?.prizeId === prize.id
                            ? 'Calculando...'
                            : 'Ver elegibles'}
                        </button>
                      )}
                    </div>
                    {canDelete && !isEvaluated ? (
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(prize.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                )}

                {eligiblePreview && eligiblePreview.prizeId === prize.id ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800">
                        Elegibles para este sorteo
                      </span>
                      <button
                        type="button"
                        onClick={() => setEligiblePreview(null)}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-slate-50 p-1.5">
                        <span className="block text-[10px] text-slate-500">Fichas elegibles</span>
                        <span className="font-bold text-slate-900">
                          {eligiblePreview.eligibleTicketsCount}
                        </span>
                      </div>
                      <div className="rounded-md bg-slate-50 p-1.5">
                        <span className="block text-[10px] text-slate-500">Clientes únicos</span>
                        <span className="font-bold text-emerald-700">
                          {eligiblePreview.eligibleCustomersCount}
                        </span>
                      </div>
                      <div className="rounded-md bg-slate-50 p-1.5">
                        <span className="block text-[10px] text-slate-500">Excluidas</span>
                        <span className="font-bold text-slate-600">
                          {eligiblePreview.excludedCount}
                        </span>
                      </div>
                    </div>
                    {eligiblePreview.eligibleCustomers.length > 0 ? (
                      <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 rounded border border-slate-100">
                        {eligiblePreview.eligibleCustomers.map((c) => (
                          <div
                            key={c.customerId}
                            className="flex items-center justify-between px-2 py-1 text-[11px]"
                          >
                            <span className="font-medium text-slate-700 truncate">
                              {c.customerName} ({c.phone})
                            </span>
                            <span className="shrink-0 text-slate-500">
                              {c.ticketCount} {c.ticketCount === 1 ? 'ficha' : 'fichas'} ·{' '}
                              {formatCRC(c.totalAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700">
                        Ningún participante cumple los criterios configurados todavía.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
