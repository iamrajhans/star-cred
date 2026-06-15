// Per-user legitimacy scoring and category bucketing. Pure functions.

import { SCORING_CONFIG as C } from "./scoringConfig";
import type { ScoredUser, Stargazer, UserCategory } from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Account age in days. */
export function accountAgeDays(createdAt: string, now: number = Date.now()): number {
  return Math.max(0, (now - new Date(createdAt).getTime()) / MS_PER_DAY);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function hasDefaultAvatar(avatarUrl: string): boolean {
  return avatarUrl.includes("/identicons/") || avatarUrl.includes("gravatar.com/avatar/");
}

/** Days since last public push; Infinity if never. */
export function daysSinceActive(
  lastActiveAt: string | null,
  now: number = Date.now()
): number {
  if (!lastActiveAt) return Infinity;
  const t = new Date(lastActiveAt).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.max(0, (now - t) / MS_PER_DAY);
}

/** Components from pre-parsed day values (avoids re-parsing dates). */
function componentsFromDays(s: Stargazer, ageDays: number, idleDays: number) {
  const age = clamp01(
    (ageDays - C.age.newAccountDays) /
      (C.age.matureAccountDays - C.age.newAccountDays)
  );

  // Decays from recent push (1) to stale/never (0).
  const activity = Number.isFinite(idleDays)
    ? clamp01(
        (C.activity.zeroCreditDays - idleDays) /
          (C.activity.zeroCreditDays - C.activity.fullCreditDays)
      )
    : 0;

  const oss = clamp01(s.publicRepos / C.oss.fullCreditRepos);

  // Log-scaled: a few followers already counts.
  const social = clamp01(
    Math.log10(s.followers + 1) / Math.log10(C.social.fullCreditFollowers + 1)
  );

  let profilePoints = 0;
  if (s.publicRepos > 0) profilePoints += 0.4;
  if (s.bio && s.bio.trim().length > 0) profilePoints += 0.3;
  if (!hasDefaultAvatar(s.avatarUrl)) profilePoints += 0.3;
  const profile = clamp01(profilePoints);

  return { age, activity, oss, social, profile };
}

/** Category from pre-parsed day values; rules in priority order. */
function categoryFromDays(
  s: Stargazer,
  ageDays: number,
  idleDays: number
): UserCategory {
  const fake = C.suspectedFake;

  if (
    ageDays <= fake.maxAgeDays &&
    s.publicRepos <= fake.maxRepos &&
    s.followers <= fake.maxFollowers
  ) {
    return "suspectedFake";
  }

  if (ageDays <= C.recentlyJoinedDays) {
    return "recentlyJoined";
  }

  const recentlyActive = idleDays <= C.activity.activeWithinDays;

  if (
    recentlyActive &&
    s.publicRepos >= C.oss.contributorRepos &&
    s.followers >= C.oss.contributorFollowers
  ) {
    return "ossContributor";
  }

  if (recentlyActive) {
    return "active";
  }

  return "inactive";
}

/** Normalized (0-1) component scores. */
export function userComponents(s: Stargazer, now: number = Date.now()) {
  return componentsFromDays(
    s,
    accountAgeDays(s.createdAt, now),
    daysSinceActive(s.lastActiveAt, now)
  );
}

/** Category bucket for a stargazer. */
export function categorize(s: Stargazer, now: number = Date.now()): UserCategory {
  return categoryFromDays(
    s,
    accountAgeDays(s.createdAt, now),
    daysSinceActive(s.lastActiveAt, now)
  );
}

/** Weighted 0-100 legitimacy score + category. */
export function scoreUser(s: Stargazer, now: number = Date.now()): ScoredUser {
  // Parse timestamps once, share across both computations.
  const ageDays = accountAgeDays(s.createdAt, now);
  const idleDays = daysSinceActive(s.lastActiveAt, now);

  const components = componentsFromDays(s, ageDays, idleDays);
  const w = C.userWeights;
  const weighted =
    components.age * w.age +
    components.activity * w.activity +
    components.oss * w.oss +
    components.social * w.social +
    components.profile * w.profile;

  return {
    stargazer: s,
    score: Math.round(weighted * 100),
    category: categoryFromDays(s, ageDays, idleDays),
    components,
  };
}
