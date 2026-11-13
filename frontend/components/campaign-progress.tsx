import type { CampaignProgress } from '@/types/campaign';

export function CampaignProgressBar({
  progress,
  showAvailable = false,
}: {
  progress: CampaignProgress;
  showAvailable?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, progress.soldPercentage));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-blue-700">{Math.round(clamped)} % vendido</span>
        {showAvailable ? (
          <span className="text-slate-500">
            {progress.availableChances.toLocaleString('es-CR')} disponibles
          </span>
        ) : null}
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
