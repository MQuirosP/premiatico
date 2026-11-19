'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Award, Calendar, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
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
import { getPrizeRuleBadges } from '@/lib/prize-helpers';
import { formatCRC } from '@/lib/utils';
import {
  createAdminDailyPrizeSeries,
  createAdminPrizes,
  deleteAdminPrize,
  type AdminCampaignPrize,
} from '@/services/campaigns';

const PRIZE_CREATE_MODE = {
  SINGLE: 'SINGLE',
  DAILY_SERIES: 'DAILY_SERIES',
} as const;

type PrizeCreateMode = (typeof PRIZE_CREATE_MODE)[keyof typeof PRIZE_CREATE_MODE];

interface CampaignPrizesBuilderProps {
  campaignId: string;
  campaignStatus: string;
  drawMode?: CampaignDrawMode;
  digits: number;
  maxNumberLabel: string;
  prizes: AdminCampaignPrize[];
  combos?: Array<{ id: string; name: string }>;
}

export function CampaignPrizesBuilder({
  campaignId,
  campaignStatus,
  drawMode = CAMPAIGN_DRAW_MODE.MULTI_PRIZE,
  digits,
  maxNumberLabel,
  prizes,
  combos = [],
}: CampaignPrizesBuilderProps) {
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

  const createMutation = useMutation({
    mutationFn: createAdminPrizes,
    onSuccess: () => {
      resetPrizeForm();
      setStatusMsg('Sorteo guardado correctamente.');
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

  const canEdit = !isCampaignReadOnly(campaignStatus);
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
                : `Premios y sorteos configurados (${prizes.length})`}
            </h2>
            {prizes.length > 0 ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                {evaluatedCount} evaluados · {prizes.length - evaluatedCount} pendientes
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSingleWinnerCampaign ? (
              <>
                Configurá sorteos flash o dinámicas paralelas (monto mínimo, acumulado, ventana de
                compra o combo) sin afectar el premio mayor de <strong>{digits} dígitos</strong>.
              </>
            ) : (
              <>
                Definí aquí los premios, fechas y criterios de participación ({digits} dígitos:{' '}
                <span className="font-mono">{'0'.repeat(digits)}</span> –{' '}
                <span className="font-mono">{maxNumberLabel}</span>). La evaluación y sorteo se
                realizan en el Centro de Sorteos.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/sorteos?campaignId=${encodeURIComponent(campaignId)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
          >
            Ir a evaluar sorteos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              {isSingleWinnerCampaign ? 'Agregar sorteo flash' : 'Agregar premios / sorteos'}
            </button>
          ) : null}
        </div>
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
                Nombre del premio / sorteo
              </label>
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Premio Tica Noche / Flash 2M"
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
                placeholder="Ej. Tica Noche / Lotería Nacional"
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
        <p className="text-sm text-slate-500">
          {isSingleWinnerCampaign
            ? 'Aún no hay sorteos flash configurados en esta campaña. Podés agregar uno en cualquier momento.'
            : 'Todavía no hay premios configurados. Agregá los premios individuales o series diarias arriba.'}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {prizes.map((prize) => {
            const isEvaluated = Boolean(prize.winnerEvaluatedAt);
            const badges = getPrizeRuleBadges(prize);

            return (
              <div
                key={prize.id}
                className="rounded-xl border bg-slate-50/70 p-4 space-y-2.5 flex flex-col justify-between"
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

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
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
                    {badges.map((badge) => (
                      <span
                        key={badge.label}
                        className={`rounded-full px-2 py-0.5 font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>

                {canEdit && !isEvaluated ? (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(prize.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
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
