'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, Sparkles, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  generateAdminPassPreview,
  listAdminCampaigns,
  saveGeneratedAdminPasses,
  type GeneratePassPreviewResponse,
} from '@/services/campaigns';

const QUICK_THEMES = [
  'Fútbol / Selección (rojo, azul y estadio)',
  'Navidad / Fin de Año (dorado, rojo y destellos)',
  'Verano / Playa Costa Rica (turquesa y sol)',
  'Fiesta Neón / Noche (morado, cian y luces)',
  'Black Friday / Lujo (negro, dorado y blanco)',
];

interface PassAiGeneratorPanelProps {
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function PassAiGeneratorPanel({ onClose, onSaved }: PassAiGeneratorPanelProps) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<'PASS' | 'FICHA' | 'BOTH'>('BOTH');
  const [tematica, setTematica] = useState('');
  const [colores, setColores] = useState('');
  const [estilo, setEstilo] = useState('');
  const [eslogan, setEslogan] = useState('¡Participá por grandes premios!');
  const [preview, setPreview] = useState<GeneratePassPreviewResponse | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [selectedComboId, setSelectedComboId] = useState('');
  const [showStamped, setShowStamped] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: campaigns } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: listAdminCampaigns,
  });

  const editableCombos =
    campaigns
      ?.filter((c) => c.status !== 'CLOSED' && c.status !== 'COMPLETED' && c.status !== 'CANCELLED')
      .flatMap((c) =>
        (c.combos ?? []).map((combo) => ({
          id: combo.id,
          label: `${c.title} — ${combo.name}`,
        })),
      ) ?? [];

  const generateMutation = useMutation({
    mutationFn: generateAdminPassPreview,
    onSuccess: (data) => {
      setErrorMsg(null);
      setPreview(data);
      setCustomName(data.nameSuggested);
      setCustomDescription(data.descriptionSuggested);
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudo generar la vista previa');
    },
  });

  const saveMutation = useMutation({
    mutationFn: saveGeneratedAdminPasses,
    onSuccess: (res) => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['admin-passes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      onSaved(
        res.passes.length > 1
          ? `Se guardaron ${res.passes.length} plantillas (Tu Pase y Tu Ficha) correctamente.`
          : `Plantilla "${res.passes[0]?.name ?? ''}" guardada correctamente.`,
      );
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'No se pudieron guardar las plantillas');
    },
  });

  const handleGenerate = () => {
    if (tematica.trim().length < 2) {
      setErrorMsg('Describí una temática (ej. Fútbol / Selección o Navidad).');
      return;
    }
    setErrorMsg(null);
    generateMutation.mutate({
      tipo,
      tematica: tematica.trim(),
      colores: colores.trim() || undefined,
      estilo: estilo.trim() || undefined,
      eslogan: eslogan.trim() || undefined,
    });
  };

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
            <Wand2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Generador temático con IA</h2>
            <p className="text-xs text-slate-500">
              Creá stickers 1024×1024 con coordenadas exactas sobre la plantilla maestra de Premiático.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar generador"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_THEMES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setTematica(preset)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50"
            >
              {preset.split(' (')[0]}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'PASS' | 'FICHA' | 'BOTH')}
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            >
              <option value="BOTH">Ambos (Tu Pase + Tu Ficha)</option>
              <option value="PASS">Solo Tu Pase</option>
              <option value="FICHA">Solo Tu Ficha</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Temática <span className="text-red-500">*</span>
            </label>
            <input
              value={tematica}
              onChange={(e) => setTematica(e.target.value)}
              placeholder="Ej. Fútbol / Selección, Navidad Dorada, Verano..."
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Colores (opcional)
            </label>
            <input
              value={colores}
              onChange={(e) => setColores(e.target.value)}
              placeholder="Automática según temática"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Estilo visual (opcional)
            </label>
            <input
              value={estilo}
              onChange={(e) => setEstilo(e.target.value)}
              placeholder="Ej. Moderno, brillante y de alto contraste"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Eslogan inferior</label>
            <input
              value={eslogan}
              onChange={(e) => setEslogan(e.target.value)}
              placeholder="¡Participá por grandes premios!"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {preview ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generateMutation.isPending
              ? 'Generando vista previa...'
              : preview
                ? 'Regenerar diseño'
                : 'Generar vista previa'}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="border-t pt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Vista previa</h3>
              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
                {preview.usedAi ? 'Paleta diseñada con Gemini IA' : 'Paleta temática automática'}
              </span>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showStamped}
                onChange={(e) => setShowStamped(e.target.checked)}
                className="rounded border-slate-300"
              />
              Simular número estampado
            </label>
          </div>

          <div
            className={`grid gap-4 ${preview.variants.length > 1 ? 'sm:grid-cols-2' : 'max-w-sm'}`}
          >
            {preview.variants.map((v) => (
              <div
                key={v.kind}
                className="rounded-xl border bg-slate-50/70 p-4 flex flex-col items-center gap-3"
              >
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {v.label} ({Math.round(v.fileSize / 1024)} KB)
                </span>
                <img
                  src={`data:image/png;base64,${showStamped ? v.stampedPreviewBase64 : v.base64}`}
                  alt={`Vista previa ${v.label}`}
                  className="w-60 h-60 object-contain rounded-xl"
                />
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre para el catálogo
              </label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
              <input
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Asociar a combo (opcional)
              </label>
              <select
                value={selectedComboId}
                onChange={(e) => setSelectedComboId(e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              >
                <option value="">Solo guardar en catálogo</option>
                {editableCombos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-xs font-medium text-slate-600"
            >
              Descartar
            </button>
            <button
              type="button"
              disabled={
                saveMutation.isPending ||
                customName.trim().length < 2 ||
                customDescription.trim().length < 5
              }
              onClick={() =>
                saveMutation.mutate({
                  name: customName.trim(),
                  description: customDescription.trim(),
                  comboId: selectedComboId || undefined,
                  variants: preview.variants.map((v) => ({ kind: v.kind, base64: v.base64 })),
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Guardando en R2...' : 'Aprobar y guardar'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
