import { CATEGORY_META, CATEGORY_ORDER } from "../lib/categoryMeta";
import type { RepoScore, UserCategory } from "../lib/types";

interface Props {
  result: RepoScore;
  selected: UserCategory | null;
  onSelect: (cat: UserCategory | null) => void;
}

interface Segment {
  key: UserCategory;
  value: number;
  color: string;
  start: number; // radians
  end: number; // radians
}

const CX = 100;
const CY = 100;
const INNER_R = 64;
const OUTER_R = 90;
const SELECTED_R = 96; // popped-out radius for the selected slice
const GAP = 0.03; // radians of padding between slices
const TWO_PI = Math.PI * 2;

/** SVG path for an annular sector (donut slice). */
function slicePath(start: number, end: number, outerR: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  const pt = (r: number, a: number) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  const [x0, y0] = pt(outerR, start);
  const [x1, y1] = pt(outerR, end);
  const [x2, y2] = pt(INNER_R, end);
  const [x3, y3] = pt(INNER_R, start);
  return [
    `M ${x0} ${y0}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${INNER_R} ${INNER_R} 0 ${large} 0 ${x3} ${y3}`,
    "Z",
  ].join(" ");
}

/** Interactive donut (hand-rolled SVG) + clickable legend driving the user list. */
export function Breakdown({ result, selected, onSelect }: Props) {
  const analyzed = result.analyzed || 1;

  const present = CATEGORY_ORDER.map((key) => ({
    key,
    value: result.distribution[key],
    color: CATEGORY_META[key].color,
  })).filter((d) => d.value > 0);

  const totalValue = present.reduce((sum, d) => sum + d.value, 0) || 1;

  // Lay out slices clockwise from the top (-90°), insetting a small gap.
  let cursor = -Math.PI / 2;
  const multi = present.length > 1;
  const segments: Segment[] = present.map((d) => {
    const span = (d.value / totalValue) * TWO_PI;
    const start = cursor + (multi ? GAP / 2 : 0);
    const end = cursor + span - (multi ? GAP / 2 : 0);
    cursor += span;
    return { ...d, start, end };
  });

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between">
        <p className="kicker">// stargazer breakdown</p>
        {selected && (
          <button
            onClick={() => onSelect(null)}
            className="font-mono text-xs text-slate-400 hover:text-slate-200"
          >
            clear filter ✕
          </button>
        )}
      </div>

      <div className="mt-4 grid items-center gap-6 md:grid-cols-2">
        {/* Donut */}
        <div className="relative mx-auto h-60 w-full max-w-[16rem]">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            {segments.map((seg) => {
              const isSel = selected === seg.key;
              const dim = selected !== null && !isSel;
              const outerR = isSel ? SELECTED_R : OUTER_R;
              const full = seg.end - seg.start >= TWO_PI - 0.001;
              return full ? (
                // Single category at 100% → render a full ring.
                <circle
                  key={seg.key}
                  cx={CX}
                  cy={CY}
                  r={(INNER_R + outerR) / 2}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={outerR - INNER_R}
                  className="cursor-pointer"
                  onClick={() => onSelect(isSel ? null : seg.key)}
                />
              ) : (
                <path
                  key={seg.key}
                  d={slicePath(seg.start, seg.end, outerR)}
                  fill={seg.color}
                  fillOpacity={dim ? 0.35 : 1}
                  className="cursor-pointer transition-[fill-opacity,d] duration-200"
                  onClick={() => onSelect(isSel ? null : seg.key)}
                >
                  <title>
                    {CATEGORY_META[seg.key].label}: {seg.value}
                  </title>
                </path>
              );
            })}
          </svg>

          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl tabular-nums text-slate-100">
              {result.analyzed.toLocaleString()}
            </span>
            <span className="kicker mt-0.5">analyzed</span>
          </div>
        </div>

        {/* Clickable legend */}
        <ul className="space-y-1.5">
          {CATEGORY_ORDER.map((key) => {
            const meta = CATEGORY_META[key];
            const count = result.distribution[key];
            const pct = Math.round((count / analyzed) * 100);
            const isSel = selected === key;
            const dim = selected && !isSel;
            return (
              <li key={key}>
                <button
                  onClick={() => onSelect(isSel ? null : key)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    isSel
                      ? "border-white/20 bg-white/[0.06]"
                      : "border-transparent hover:bg-white/[0.04]"
                  } ${dim ? "opacity-50" : ""}`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: meta.color }}
                  />
                  <span className="flex-1 text-sm text-slate-200">
                    {meta.label}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-slate-100">
                    {count}
                  </span>
                  <span className="w-10 text-right font-mono text-xs tabular-nums text-slate-500">
                    {pct}%
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-4 text-center font-mono text-xs text-slate-600">
        click a slice or row to inspect those users ↓
      </p>
    </div>
  );
}
