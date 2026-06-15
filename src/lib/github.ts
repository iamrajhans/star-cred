// GitHub GraphQL client: fetches stargazers (page 1 sequentially for the total +
// cursor format, then the rest in parallel via offset cursors).
// Query is kept lean — cross-repo fields (contributionsCollection,
// repositoriesContributedTo) hit resource limits / 502 across many nodes.

import type { FetchProgress, RateLimit, Stargazer } from "./types";

const GRAPHQL_URL = "https://api.github.com/graphql";
const DEFAULT_PAGE_SIZE = 50;
const MIN_PAGE_SIZE = 5; // shrink floor on retry
const MAX_RETRIES = 4;

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "auth"
      | "notFound"
      | "rateLimit"
      | "secondary"
      | "network"
      | "server"
      | "graphql" = "graphql",
    /** From a Retry-After header, in ms. */
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STARGAZER_QUERY = `
query Stargazers($owner: String!, $name: String!, $cursor: String, $first: Int!) {
  repository(owner: $owner, name: $name) {
    stargazerCount
    stargazers(first: $first, after: $cursor, orderBy: { field: STARRED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      edges {
        starredAt
        node {
          login
          createdAt
          bio
          avatarUrl(size: 80)
          isHireable
          followers { totalCount }
          following { totalCount }
          repositories(first: 1, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
            totalCount
            nodes { pushedAt }
          }
        }
      }
    }
  }
  rateLimit { remaining limit resetAt cost }
}`;

interface RawNode {
  login: string;
  createdAt: string;
  bio: string | null;
  avatarUrl: string;
  isHireable: boolean;
  followers: { totalCount: number };
  following: { totalCount: number };
  repositories: { totalCount: number; nodes: { pushedAt: string | null }[] };
}

interface RawResponse {
  data?: {
    repository: {
      stargazerCount: number;
      stargazers: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: { starredAt: string; node: RawNode | null }[];
      };
    } | null;
    rateLimit: RateLimit | null;
  };
  errors?: { type?: string; message: string }[];
}

function toStargazer(starredAt: string, n: RawNode): Stargazer {
  return {
    login: n.login,
    starredAt,
    createdAt: n.createdAt,
    bio: n.bio,
    avatarUrl: n.avatarUrl,
    isHireable: n.isHireable,
    followers: n.followers.totalCount,
    following: n.following.totalCount,
    publicRepos: n.repositories.totalCount,
    lastActiveAt: n.repositories.nodes[0]?.pushedAt ?? null,
  };
}

/** Validate a token via a `viewer` query; returns the login. */
export async function validateToken(token: string): Promise<string> {
  const res = await rawRequest(token, "query { viewer { login } }", {});
  const login = (res.data as { viewer?: { login: string } } | undefined)?.viewer
    ?.login;
  if (!login) throw new GitHubError("Token did not return a user.", "auth");
  return login;
}

async function rawRequest(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ data?: unknown; errors?: { type?: string; message: string }[] }> {
  let res: Response;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new GitHubError(
      "Network error reaching GitHub. Check your connection.",
      "network"
    );
  }

  if (res.status === 401) {
    throw new GitHubError(
      "Invalid or expired token. Generate a new Personal Access Token.",
      "auth"
    );
  }
  if (res.status === 403 || res.status === 429) {
    // Secondary rate limit (burst/concurrency, retryable) vs primary/scope (not).
    const body = await res.text().catch(() => "");
    const retryAfter = res.headers.get("retry-after");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
    if (res.status === 429 || /secondary rate limit|abuse/i.test(body)) {
      throw new GitHubError(
        "Hit GitHub's secondary rate limit; backing off.",
        "secondary",
        retryAfterMs
      );
    }
    throw new GitHubError(
      "Forbidden — you may have hit the rate limit or lack required scopes.",
      "rateLimit"
    );
  }
  // 5xx (often 502 = query timeout): retryable.
  if (res.status >= 500) {
    throw new GitHubError(
      `GitHub returned ${res.status}. The query may be too large; retrying with a smaller page.`,
      "server"
    );
  }

  let json: { data?: unknown; errors?: { type?: string; message: string }[] };
  try {
    json = await res.json();
  } catch {
    throw new GitHubError("GitHub returned an unreadable response.", "network");
  }

  if (json.errors && json.errors.length > 0) {
    const first = json.errors[0];
    if (first.type === "NOT_FOUND") {
      throw new GitHubError("Repository not found.", "notFound");
    }
    if (first.type === "RATE_LIMITED") {
      throw new GitHubError("GitHub API rate limit exceeded.", "rateLimit");
    }
    // Timeouts sometimes come as a 200 with an error message.
    if (/timeout|something went wrong while executing/i.test(first.message)) {
      throw new GitHubError(first.message, "server");
    }
    throw new GitHubError(first.message, "graphql");
  }

  return json;
}

export const DEFAULT_CONCURRENCY = 6;

export interface FetchOptions {
  /** Max stargazers to fetch; Infinity for "all". */
  limit: number;
  onProgress?: (p: FetchProgress) => void;
  signal?: AbortSignal;
  concurrency?: number;
}

type FetchResult = {
  stargazers: Stargazer[];
  totalStargazers: number;
  rateLimit: RateLimit | null;
};

/** Offset → GitHub's `cursor:<n>` format. */
export function encodeOffsetCursor(offset: number): string {
  return btoa(`cursor:${offset}`);
}

/** `cursor:<n>` → offset, or null if not offset-based (forces sequential). */
export function decodeCursorOffset(cursor: string): number | null {
  try {
    const m = /^cursor:(\d+)$/.exec(atob(cursor));
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

interface Page {
  stargazers: Stargazer[];
  totalStargazers: number;
  rateLimit: RateLimit | null;
  hasNextPage: boolean;
  endCursor: string | null;
}

/** Fetch + normalize one page of stargazers (with retry). */
async function fetchPage(
  token: string,
  owner: string,
  name: string,
  cursor: string | null,
  first: number,
  allowShrink: boolean,
  onSecondary?: () => void
): Promise<Page> {
  const json = await requestPageWithRetry(
    token,
    { owner, name, cursor, first },
    allowShrink,
    onSecondary
  );
  const repo = json.data?.repository;
  if (!repo) throw new GitHubError("Repository not found.", "notFound");

  const stargazers: Stargazer[] = [];
  for (const edge of repo.stargazers.edges) {
    if (!edge.node) continue; // null = suspended/deleted account
    stargazers.push(toStargazer(edge.starredAt, edge.node));
  }
  return {
    stargazers,
    totalStargazers: repo.stargazerCount,
    rateLimit: json.data?.rateLimit ?? null,
    hasNextPage: repo.stargazers.pageInfo.hasNextPage,
    endCursor: repo.stargazers.pageInfo.endCursor,
  };
}

/**
 * Fetch up to `limit` stargazers, newest-starred first. Page 1 is sequential;
 * remaining pages fan out in parallel when cursors are offset-based, else
 * fall back to sequential.
 */
export async function fetchStargazers(
  token: string,
  owner: string,
  name: string,
  opts: FetchOptions
): Promise<FetchResult> {
  const target = Number.isFinite(opts.limit) ? opts.limit : Infinity;

  // --- Page 1 (sequential): total count + cursor format -------------------
  const page1 = await fetchPage(
    token,
    owner,
    name,
    null,
    Math.min(DEFAULT_PAGE_SIZE, target),
    true
  );
  const totalStargazers = page1.totalStargazers;
  const realTarget = Math.min(target, totalStargazers);

  const collected: Stargazer[] = page1.stargazers.slice(0, realTarget);
  let rateLimit = page1.rateLimit;
  const displayTarget = Number.isFinite(target)
    ? Math.min(target, totalStargazers)
    : totalStargazers;
  const emit = () =>
    opts.onProgress?.({ fetched: collected.length, target: displayTarget, rateLimit });
  emit();

  const done = () => finalize(collected, totalStargazers, rateLimit, target);

  if (collected.length >= realTarget || !page1.hasNextPage || !page1.endCursor) {
    return done();
  }

  const firstOffset = decodeCursorOffset(page1.endCursor);

  // --- Sequential fallback (non-offset cursors) ---------------------------
  if (firstOffset === null) {
    let cursor: string | null = page1.endCursor;
    while (cursor && collected.length < realTarget && !opts.signal?.aborted) {
      const first = Math.min(DEFAULT_PAGE_SIZE, realTarget - collected.length);
      const page: Page = await fetchPage(token, owner, name, cursor, first, true);
      collected.push(...page.stargazers);
      if (page.rateLimit) rateLimit = page.rateLimit;
      emit();
      if (!page.hasNextPage) break;
      cursor = page.endCursor;
    }
    return done();
  }

  // --- Parallel path (offset-based cursors) -------------------------------
  const offsets: number[] = [];
  for (let off = firstOffset; off < realTarget; off += DEFAULT_PAGE_SIZE) {
    offsets.push(off);
  }

  let limit = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  await runPool(
    offsets,
    () => limit,
    async (offset) => {
      if (opts.signal?.aborted) return;
      const first = Math.min(DEFAULT_PAGE_SIZE, realTarget - offset);
      if (first <= 0) return;
      const page = await fetchPage(
        token,
        owner,
        name,
        encodeOffsetCursor(offset),
        first,
        false,
        // On a secondary rate limit, halve concurrency for the rest of the run.
        () => {
          limit = Math.max(2, Math.floor(limit / 2));
        }
      );
      collected.push(...page.stargazers);
      if (page.rateLimit) rateLimit = page.rateLimit;
      emit();
    },
    opts.signal
  );

  return done();
}

/** De-dupe by login, sort newest-star-first, cap to target. */
function finalize(
  collected: Stargazer[],
  totalStargazers: number,
  rateLimit: RateLimit | null,
  target: number
): FetchResult {
  // Schwartzian transform: parse each starredAt once.
  const seen = new Set<string>();
  const decorated: { ts: number; s: Stargazer }[] = [];
  for (const s of collected) {
    if (seen.has(s.login)) continue;
    seen.add(s.login);
    decorated.push({ ts: new Date(s.starredAt).getTime(), s });
  }
  decorated.sort((a, b) => b.ts - a.ts);
  const unique = decorated.map((d) => d.s);
  const capped = Number.isFinite(target) ? unique.slice(0, target) : unique;
  return { stargazers: capped, totalStargazers, rateLimit };
}

/**
 * Run `worker` over `items` with at most `getLimit()` in flight (read live, so
 * concurrency can shrink mid-run). On first error: stop, drain, rethrow.
 */
export async function runPool<T>(
  items: T[],
  getLimit: () => number,
  worker: (item: T) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  let index = 0;
  let firstError: unknown = null;
  const active = new Set<Promise<void>>();

  const launch = (item: T) => {
    const p = (async () => {
      try {
        await worker(item);
      } catch (e) {
        if (firstError === null) firstError = e;
      }
    })().finally(() => {
      active.delete(p);
    });
    active.add(p);
  };

  while (index < items.length && firstError === null && !signal?.aborted) {
    while (
      active.size < getLimit() &&
      index < items.length &&
      firstError === null &&
      !signal?.aborted
    ) {
      launch(items[index++]);
    }
    if (active.size === 0) break;
    await Promise.race(active);
  }
  await Promise.all(active);
  if (firstError !== null) throw firstError;
}

/**
 * Request one page with exponential backoff. On "server" errors, `allowShrink`
 * halves the page (sequential only — would gap the parallel path). On secondary
 * limits, waits Retry-After and calls `onSecondary` to drop concurrency.
 */
async function requestPageWithRetry(
  token: string,
  vars: { owner: string; name: string; cursor: string | null; first: number },
  allowShrink: boolean,
  onSecondary?: () => void
): Promise<RawResponse> {
  let first = vars.first;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await rawRequest(token, STARGAZER_QUERY, {
        ...vars,
        first,
      })) as RawResponse;
    } catch (e) {
      if (!(e instanceof GitHubError) || attempt >= MAX_RETRIES) throw e;
      if (e.kind === "server") {
        if (allowShrink) first = Math.max(MIN_PAGE_SIZE, Math.floor(first / 2));
        await sleep(500 * 2 ** attempt); // 0.5s, 1s, 2s, 4s
      } else if (e.kind === "secondary") {
        onSecondary?.();
        await sleep(e.retryAfterMs ?? 2000 * 2 ** attempt);
      } else {
        throw e;
      }
    }
  }
}

/** Parse "owner/name" (or a full GitHub URL) into its parts. */
export function parseRepo(input: string): { owner: string; name: string } | null {
  const trimmed = input.trim().replace(/^https?:\/\/github\.com\//i, "");
  // Strip trailing slashes first, then a trailing ".git", so "bar.git/" works.
  const cleaned = trimmed.replace(/\/+$/, "").replace(/\.git$/i, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], name: parts[1] };
}
