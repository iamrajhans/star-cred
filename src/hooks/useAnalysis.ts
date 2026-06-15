import { useCallback, useRef, useState } from "react";
import { aggregateRepoScore } from "../lib/aggregate";
import { fetchStargazers, GitHubError, parseRepo } from "../lib/github";
import type { FetchProgress, RateLimit, RepoScore } from "../lib/types";

export type AnalysisStatus = "idle" | "running" | "done" | "error" | "cancelled";

export interface AnalysisState {
  status: AnalysisStatus;
  progress: FetchProgress | null;
  result: RepoScore | null;
  error: string | null;
  rateLimit: RateLimit | null;
}

const INITIAL: AnalysisState = {
  status: "idle",
  progress: null,
  result: null,
  error: null,
  rateLimit: null,
};

export interface RunOptions {
  /** "all" analyzes every stargazer; "sample" caps at `sampleSize`. */
  mode: "sample" | "all";
  sampleSize: number;
}

/** Orchestrates fetch + scoring for a repo, exposing progress and result. */
export function useAnalysis(token: string | null) {
  const [state, setState] = useState<AnalysisState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(
    async (repoInput: string, opts: RunOptions) => {
      if (!token) {
        setState({ ...INITIAL, status: "error", error: "No token set." });
        return;
      }
      const repo = parseRepo(repoInput);
      if (!repo) {
        setState({
          ...INITIAL,
          status: "error",
          error: "Enter a repo as owner/name (e.g. facebook/react).",
        });
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...INITIAL, status: "running" });

      const limit = opts.mode === "all" ? Infinity : opts.sampleSize;

      try {
        const { stargazers, totalStargazers, rateLimit } =
          await fetchStargazers(token, repo.owner, repo.name, {
            limit,
            signal: controller.signal,
            onProgress: (progress) =>
              setState((s) => ({ ...s, progress, rateLimit: progress.rateLimit })),
          });

        if (controller.signal.aborted) {
          // Still score what we managed to fetch, but mark as cancelled.
          const partial = aggregateRepoScore(stargazers, totalStargazers);
          setState((s) => ({
            ...s,
            status: "cancelled",
            result: stargazers.length > 0 ? partial : null,
            rateLimit,
          }));
          return;
        }

        const result = aggregateRepoScore(stargazers, totalStargazers);
        setState((s) => ({ ...s, status: "done", result, rateLimit }));
      } catch (e) {
        const message =
          e instanceof GitHubError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Unknown error.";
        setState((s) => ({ ...s, status: "error", error: message }));
      } finally {
        abortRef.current = null;
      }
    },
    [token]
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, run, cancel, reset };
}
