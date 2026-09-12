import { cn } from "@/lib/utils";

interface CapacityBarProps {
  filled: number;
  total: number;
  showLabel?: boolean;
  className?: string;
}

export function CapacityBar({ filled, total, showLabel = true, className }: CapacityBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  const isFull = filled >= total;
  const isNearFull = pct >= 80;

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{filled} / {total} seats</span>
          <span className={cn("font-medium", isFull && "text-red-600", isNearFull && !isFull && "text-amber-600")}>
            {isFull ? "Full" : `${pct}%`}
          </span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isFull ? "bg-red-500" : isNearFull ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={filled}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${filled} of ${total} seats filled`}
        />
      </div>
    </div>
  );
}
