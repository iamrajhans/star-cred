import { useEffect, useState } from "react";
import { Breakdown } from "./components/Breakdown";
import { Loader } from "./components/Loader";
import { RateLimitMeter } from "./components/RateLimitMeter";
import { RepoInput } from "./components/RepoInput";
import { ScoreCard } from "./components/ScoreCard";
import { TokenGate } from "./components/TokenGate";
import { UserList } from "./components/UserList";
import { useAnalysis } from "./hooks/useAnalysis";
import { useToken } from "./hooks/useToken";
import type { UserCategory } from "./lib/types";

export default function App() {
  const { token, login, validating, error: tokenError, saveToken, clearToken } =
    useToken();
  const { state, run, cancel } = useAnalysis(token);
  const [selected, setSelected] = useState<UserCategory | null>(null);

  // Reset the drill-down filter whenever a fresh run starts.
  useEffect(() => {
    if (state.status === "running") setSelected(null);
  }, [state.status]);

  return (
    <div className="app-bg min-h-screen">
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-lg text-cyan-300">
              ★
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                star<span className="text-cyan-400">·</span>cred
              </h1>
              <p className="font-mono text-[11px] text-slate-500">
                are these stars real?
              </p>
            </div>
          </div>
          {token && (
            <div className="flex items-center gap-3 text-sm">
              {login && (
                <span className="font-mono text-slate-400">@{login}</span>
              )}
              <button
                onClick={clearToken}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 transition hover:bg-white/[0.06]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {!token ? (
          <div className="py-10">
            <TokenGate
              validating={validating}
              error={tokenError}
              onSubmit={saveToken}
            />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <RepoInput
                running={state.status === "running"}
                onRun={run}
                onCancel={cancel}
              />
              <RateLimitMeter rateLimit={state.rateLimit} />
            </aside>

            <section className="space-y-6">
              {state.status === "running" && <Loader progress={state.progress} />}

              {state.status === "error" && (
                <div className="glass border-rose-500/30 bg-rose-500/[0.06] p-4 font-mono text-sm text-rose-300">
                  ✗ {state.error}
                </div>
              )}

              {state.status === "cancelled" && !state.result && (
                <div className="glass p-4 font-mono text-sm text-slate-300">
                  analysis cancelled.
                </div>
              )}

              {state.result && state.status !== "running" && (
                <>
                  {state.status === "cancelled" && (
                    <div className="glass border-amber-500/30 bg-amber-500/[0.06] p-3 font-mono text-xs text-amber-300">
                      cancelled — showing partial results from the stargazers
                      fetched so far.
                    </div>
                  )}
                  <ScoreCard result={state.result} />
                  <Breakdown
                    result={state.result}
                    selected={selected}
                    onSelect={setSelected}
                  />
                  <UserList result={state.result} selected={selected} />
                </>
              )}

              {state.status === "idle" && (
                <div className="glass grid place-items-center p-16 text-center">
                  <div>
                    <p className="font-mono text-4xl text-slate-700">{"{ ★ }"}</p>
                    <p className="mt-4 text-slate-400">
                      Paste a GitHub repo URL to analyze its stargazers.
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-600">
                      e.g. https://github.com/facebook/react
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <footer className="mt-12 text-center font-mono text-[11px] text-slate-600">
          runs entirely in your browser · token stays on your device, talks only
          to api.github.com
        </footer>
      </main>
    </div>
  );
}
