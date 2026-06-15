// Shared domain types.

export interface Stargazer {
  login: string;
  starredAt: string; // ISO
  createdAt: string; // ISO
  bio: string | null;
  avatarUrl: string;
  isHireable: boolean;
  followers: number;
  following: number;
  publicRepos: number;
  /** Most recent public-repo push (ISO); activity proxy, null if no repos. */
  lastActiveAt: string | null;
}

export type UserCategory =
  | "suspectedFake"
  | "recentlyJoined"
  | "ossContributor"
  | "active"
  | "inactive";

export const CATEGORY_LABELS: Record<UserCategory, string> = {
  suspectedFake: "Suspected fake / bot",
  recentlyJoined: "Recently joined",
  ossContributor: "Open-source contributor",
  active: "Active developer",
  inactive: "Inactive / dormant",
};

export interface ScoredUser {
  stargazer: Stargazer;
  score: number; // 0-100
  category: UserCategory;
  /** Sub-scores (0-1, pre-weighting). */
  components: {
    age: number;
    activity: number;
    oss: number;
    social: number;
    profile: number;
  };
}

/** A suspicious cluster of stars in a short window. */
export interface StarSpike {
  start: string;
  end: string;
  count: number;
  /** Share of the window that's new / suspected-fake. */
  suspiciousFraction: number;
}

/** Aggregate result for a repository. */
export interface RepoScore {
  score: number; // 0-100
  label: string;
  analyzed: number;
  totalStargazers: number;
  distribution: Record<UserCategory, number>;
  reasoning: string[];
  spikes: StarSpike[];
  averageUserScore: number;
  /** All analyzed users, for drill-down. */
  users: ScoredUser[];
}

export interface FetchProgress {
  fetched: number;
  target: number; // sample size or total
  rateLimit: RateLimit | null;
}

export interface RateLimit {
  remaining: number;
  limit: number;
  resetAt: string;
  cost: number;
}
