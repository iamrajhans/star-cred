import type { FetchProgress } from "../lib/types";

interface Props {
  progress: FetchProgress | null;
}

/** Animated loader shown while fetching. */
export function Loader({ progress }: Props) {
  const fetched = progress?.fetched ?? 0;
  const target = progress?.target ?? 0;
  const ratio = target > 0 ? Math.min(1, fetched / target) : 0;
  const pct = Math.round(ratio * 100);

  return (
    <div className="glass relative overflow-hidden p-10">
      {/* moving scan line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/10 to-transparent animate-scan" />

      <div className="relative flex flex-col items-center gap-6">
        {/* radar pulse */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-pulse-ring" />
          <span className="absolute inset-0 rounded-full border border-emerald-400/30 animate-pulse-ring [animation-delay:0.6s]" />
          <span className="relative font-mono text-2xl text-cyan-300">⌖</span>
        </div>

        <div className="text-center">
          <p className="kicker">// scanning stargazers</p>
          <p className="mt-1 font-mono text-3xl tabular-nums text-slate-100">
            {fetched.toLocaleString()}
            <span className="text-slate-600">
              {target > 0 ? ` / ${target.toLocaleString()}` : ""}
            </span>
          </p>
        </div>

        <div className="w-full max-w-md">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.max(3, pct)}%` }}
            />
          </div>
          <p className="mt-2 text-center font-mono text-xs text-slate-500">
            fetching profiles & computing credibility — {pct}%
          </p>
        </div>
      </div>
    </div>
  );
}
