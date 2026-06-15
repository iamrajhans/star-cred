import type { UserCategory } from "./types";

export interface CategoryMeta {
  label: string;
  short: string;
  color: string; // hex, for donut/dots
  text: string; // tailwind text class
  chip: string; // tailwind badge classes
  blurb: string;
}

/** Category presentation (labels, colors, badges) shared across the UI. */
export const CATEGORY_META: Record<UserCategory, CategoryMeta> = {
  active: {
    label: "Active developer",
    short: "Active",
    color: "#34d399",
    text: "text-emerald-300",
    chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    blurb: "Established account that pushed code recently.",
  },
  ossContributor: {
    label: "Open-source contributor",
    short: "OSS",
    color: "#22d3ee",
    text: "text-cyan-300",
    chip: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
    blurb: "Substantial public repos, a following, and recent activity.",
  },
  inactive: {
    label: "Inactive / dormant",
    short: "Dormant",
    color: "#a78bfa",
    text: "text-violet-300",
    chip: "bg-violet-500/10 border-violet-500/30 text-violet-300",
    blurb: "Real, established account with no recent public activity.",
  },
  recentlyJoined: {
    label: "Recently joined",
    short: "New",
    color: "#fbbf24",
    text: "text-amber-300",
    chip: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    blurb: "Account created within the last 90 days.",
  },
  suspectedFake: {
    label: "Suspected fake / bot",
    short: "Suspect",
    color: "#fb7185",
    text: "text-rose-300",
    chip: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    blurb: "New account with no repos, followers, or activity.",
  },
};

/** Fixed display order (best → worst). */
export const CATEGORY_ORDER: UserCategory[] = [
  "active",
  "ossContributor",
  "inactive",
  "recentlyJoined",
  "suspectedFake",
];
