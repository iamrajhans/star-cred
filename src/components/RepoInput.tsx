import { useMemo, useState } from "react";
import type { RunOptions } from "../hooks/useAnalysis";
import { parseRepo } from "../lib/github";

interface Props {
  running: boolean;
  onRun: (repo: string, opts: RunOptions) => void;
  onCancel: () => void;
}

/** Repo entry (URL or owner/name) + Sample/All toggle + sample-size slider. */
export function RepoInput({ running, onRun, onCancel }: Props) {
  const [repo, setRepo] = useState("");
  const [mode, setMode] = useState<"sample" | "all">("sample");
  const [sampleSize, setSampleSize] = useState(300);

  const parsed = useMemo(() => parseRepo(repo), [repo]);

  // Each GraphQL page covers ~50 stargazers = 1 request.
  const estRequests =
    mode === "sample" ? Math.ceil(sampleSize / 50) : "all pages";

  return (
    <div className="glass p-5">
      <p className="kicker mb-3">// target repository</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed) onRun(repo, { mode, sampleSize });
        }}
        className="space-y-4"
      >
        <div>
          <div className="flex items-center rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-sm focus-within:border-cyan-500/60">
            <span className="select-none text-slate-600">$</span>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/facebook/react"
              spellCheck={false}
              autoCapitalize="off"
              className="w-full bg-transparent px-2 py-2.5 text-slate-100 outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="mt-1.5 h-4 text-xs">
            {repo.trim() === "" ? (
              <span className="text-slate-600">
                Paste a GitHub URL or type owner/name
              </span>
            ) : parsed ? (
              <span className="font-mono text-emerald-400">
                ✓ {parsed.owner}/{parsed.name}
              </span>
            ) : (
              <span className="font-mono text-rose-400">
                ✗ couldn&apos;t parse owner/name
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
          <ModeButton active={mode === "sample"} onClick={() => setMode("sample")}>
            Sample
          </ModeButton>
          <ModeButton active={mode === "all"} onClick={() => setMode("all")}>
            Analyze all
          </ModeButton>
        </div>

        {mode === "sample" ? (
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Sample size</span>
              <span className="font-mono tabular-nums text-cyan-300">
                {sampleSize}
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              className="mt-2 w-full accent-cyan-400"
            />
          </div>
        ) : (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            ⚠️ Analyzing all stargazers can use many API requests on large repos
            and may hit the 5,000/hour limit. Best for repos under ~3k stars.
          </p>
        )}

        <p className="font-mono text-xs text-slate-600">
          est. requests: {estRequests}
        </p>

        {running ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 font-medium text-rose-300 transition hover:bg-rose-500/20"
          >
            ■ Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!parsed}
            className="group w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2.5 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:shadow-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            ▸ Analyze stars
          </button>
        )}
      </form>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-white/10 text-white shadow-sm"
          : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
