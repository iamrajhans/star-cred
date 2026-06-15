import type { RepoScore } from "../lib/types";

function scoreTone(score: number) {
  if (score >= 80) return { text: "text-emerald-300", from: "#34d399", to: "#22d3ee" };
  if (score >= 60) return { text: "text-cyan-300", from: "#22d3ee", to: "#38bdf8" };
  if (score >= 40) return { text: "text-amber-300", from: "#fbbf24", to: "#f59e0b" };
  return { text: "text-rose-300", from: "#fb7185", to: "#f43f5e" };
}

/** Headline credibility gauge + reasoning. */
export function ScoreCard({ result }: { result: RepoScore }) {
  const { score, label, reasoning, analyzed, totalStargazers, averageUserScore } =
    result;
  const tone = scoreTone(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div className="glass p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={tone.from} />
                <stop offset="100%" stopColor={tone.to} />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="url(#scoreGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 900ms ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-mono text-5xl font-bold ${tone.text} glow`}>
              {score}
            </span>
            <span className="kicker mt-1">/ 100</span>
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <p className="kicker">// star credibility</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-100">
            <span className={tone.text}>{label}</span>
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {analyzed.toLocaleString()} / {totalStargazers.toLocaleString()}{" "}
            stargazers analyzed
            {analyzed < totalStargazers ? " · recent sample" : ""} · avg user{" "}
            {averageUserScore}
          </p>

          <ul className="mt-4 space-y-1.5">
            {reasoning.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="select-none text-slate-600">▹</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
