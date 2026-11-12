import type { CampaignProgress } from '@/types/campaign';

export function CampaignProgressBar({ progress }: { progress: CampaignProgress }) {
  const clamped = Math.max(0, Math.min(100, progress.soldPercentage));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-blue-700">{Math.round(clamped)} % vendido</span>
        <span className="text-slate-500">
          {progress.availableChances.toLocaleString('es-CR')} disponibles
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-amber-500 transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
