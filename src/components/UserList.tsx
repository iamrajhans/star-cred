import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META } from "../lib/categoryMeta";
import type { RepoScore, ScoredUser, UserCategory } from "../lib/types";

interface Props {
  result: RepoScore;
  selected: UserCategory | null;
}

const ROW_H = 58; // px; must match rendered row height
const VIEWPORT_H = 448; // px; matches h-[28rem]
const OVERSCAN = 6; // rows rendered beyond the window

function scoreColor(score: number): string {
  if (score >= 70) return "#34d399";
  if (score >= 45) return "#22d3ee";
  if (score >= 25) return "#fbbf24";
  return "#fb7185";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Virtualized, searchable, sortable user list. Only windowed rows mount, so
 * only visible avatars are fetched (rest load on scroll).
 */
export function UserList({ result, selected }: Props) {
  const [query, setQuery] = useState("");
  const [asc, setAsc] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const users = useMemo(() => {
    let list: ScoredUser[] = result.users;
    if (selected) list = list.filter((u) => u.category === selected);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((u) => u.stargazer.login.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) =>
      asc ? a.score - b.score : b.score - a.score
    );
  }, [result.users, selected, query, asc]);

  // When the filter/sort changes the list shrinks/reorders — jump back to top.
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [selected, query, asc]);

  const total = users.length * ROW_H;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(
    users.length,
    Math.ceil((scrollTop + VIEWPORT_H) / ROW_H) + OVERSCAN
  );
  const visible = users.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_H;

  return (
    <div className="glass flex flex-col p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="kicker">
          // {selected ? CATEGORY_META[selected].label.toLowerCase() : "all users"}{" "}
          <span className="text-slate-400">({users.length})</span>
        </p>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search login…"
            spellCheck={false}
            className="w-36 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500/60 sm:w-44"
          />
          <button
            onClick={() => setAsc((v) => !v)}
            className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-xs text-slate-300 hover:bg-white/[0.06]"
            title="Toggle sort order"
          >
            score {asc ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="py-10 text-center font-mono text-sm text-slate-600">
          no users match
        </p>
      ) : (
        <div
          ref={containerRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          className="scroll-thin mt-4 overflow-y-auto pr-1"
          style={{ height: Math.min(VIEWPORT_H, total) }}
        >
          {/* Full-height spacer so the scrollbar reflects the entire list. */}
          <div style={{ height: total, position: "relative" }}>
            {/* Only the windowed rows are mounted, shifted into place. */}
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visible.map((u) => (
                <UserRow key={u.stargazer.login} user={u} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({ user }: { user: ScoredUser }) {
  const s = user.stargazer;
  const meta = CATEGORY_META[user.category];
  return (
    <a
      href={`https://github.com/${s.login}`}
      target="_blank"
      rel="noreferrer"
      style={{ height: ROW_H }}
      className="group flex items-center gap-3 overflow-hidden rounded-xl border border-transparent px-2 transition hover:border-white/10 hover:bg-white/[0.04]"
    >
      <img
        src={s.avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-9 w-9 shrink-0 rounded-full bg-white/5 ring-1 ring-white/10"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-100 group-hover:text-cyan-300">
            {s.login}
          </span>
          <span className="opacity-0 transition group-hover:opacity-100 text-cyan-400">
            ↗
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span className={`rounded border px-1.5 py-px ${meta.chip}`}>
            {meta.short}
          </span>
          <span>{s.followers.toLocaleString()} followers</span>
          <span className="text-slate-700">·</span>
          <span>{s.publicRepos} repos</span>
          <span className="text-slate-700">·</span>
          <span>active {timeAgo(s.lastActiveAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span
          className="font-mono text-sm tabular-nums"
          style={{ color: scoreColor(user.score) }}
        >
          {user.score}
        </span>
        <div className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${user.score}%`,
              background: scoreColor(user.score),
            }}
          />
        </div>
      </div>
    </a>
  );
}
