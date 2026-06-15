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

const REPO_URL = "https://github.com/iamrajhans/star-cred";

/** GitHub mark icon. */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

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
          <div className="flex items-center gap-3 text-sm">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              title="Star this project on GitHub"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <GitHubMark />
              <span className="hidden sm:inline">Star</span>
              <span className="text-amber-300">★</span>
            </a>
            {token && (
              <>
                {login && (
                  <span className="hidden font-mono text-slate-400 sm:inline">
                    @{login}
                  </span>
                )}
                <button
                  onClick={clearToken}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 transition hover:bg-white/[0.06]"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
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
          <p>
            runs entirely in your browser · token stays on your device, talks
            only to api.github.com
          </p>
          <p className="mt-1.5">
            find this useful?{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-amber-300/80 underline decoration-amber-400/40 hover:text-amber-200"
            >
              ★ star it on GitHub
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
