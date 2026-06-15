import type { RateLimit } from "../lib/types";

/** Compact GitHub API rate-limit indicator. */
export function RateLimitMeter({ rateLimit }: { rateLimit: RateLimit | null }) {
  if (!rateLimit) return null;
  const { remaining, limit, resetAt } = rateLimit;
  const ratio = limit > 0 ? remaining / limit : 0;
  const color =
    ratio > 0.5 ? "bg-emerald-500" : ratio > 0.2 ? "bg-amber-500" : "bg-red-500";
  const resetIn = Math.max(
    0,
    Math.round((new Date(resetAt).getTime() - Date.now()) / 60000)
  );

  return (
    <div className="glass p-4 text-sm">
      <p className="kicker mb-2">// api rate limit</p>
      <div className="flex justify-between text-slate-300">
        <span className="font-mono text-xs text-slate-500">remaining</span>
        <span className="font-mono tabular-nums text-slate-200">
          {remaining.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-slate-600">
        resets in ~{resetIn} min
      </p>
    </div>
  );
}
