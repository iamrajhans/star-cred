// Aggregate scored stargazers into a repo credibility score + spikes + reasoning.

import { scoreUser } from "./scoring";
import { SCORING_CONFIG as C, scoreLabel } from "./scoringConfig";
import {
  type RepoScore,
  type ScoredUser,
  type StarSpike,
  type Stargazer,
  type UserCategory,
} from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const EMPTY_DISTRIBUTION: Record<UserCategory, number> = {
  suspectedFake: 0,
  recentlyJoined: 0,
  ossContributor: 0,
  active: 0,
  inactive: 0,
};

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** Short time windows holding an outsized share of new/fake stars. */
export function detectSpikes(scored: ScoredUser[]): StarSpike[] {
  if (scored.length === 0) return [];

  const windowMs = C.spike.windowDays * MS_PER_DAY;
  const buckets = new Map<number, ScoredUser[]>();
  for (const u of scored) {
    const t = new Date(u.stargazer.starredAt).getTime();
    if (Number.isNaN(t)) continue;
    const key = Math.floor(t / windowMs);
    const arr = buckets.get(key) ?? [];
    arr.push(u);
    buckets.set(key, arr);
  }

  const total = scored.length;
  const spikes: StarSpike[] = [];
  for (const [key, users] of buckets) {
    if (users.length < C.spike.minWindowCount) continue;
    if (users.length / total < C.spike.minWindowShare) continue;

    const suspicious = users.filter(
      (u) => u.category === "suspectedFake" || u.category === "recentlyJoined"
    ).length;
    const suspiciousFraction = suspicious / users.length;
    if (suspiciousFraction < C.spike.suspiciousFraction) continue;

    spikes.push({
      start: new Date(key * windowMs).toISOString(),
      end: new Date((key + 1) * windowMs).toISOString(),
      count: users.length,
      suspiciousFraction,
    });
  }

  return spikes.sort((a, b) => b.count - a.count);
}

/** Repo credibility score from raw stargazers. */
export function aggregateRepoScore(
  stargazers: Stargazer[],
  totalStargazers: number,
  now: number = Date.now()
): RepoScore {
  const scored = stargazers.map((s) => scoreUser(s, now));
  const analyzed = scored.length;

  const distribution: Record<UserCategory, number> = { ...EMPTY_DISTRIBUTION };
  let sumUserScore = 0;
  for (const u of scored) {
    distribution[u.category] += 1;
    sumUserScore += u.score;
  }

  // Category-weighted credibility, blended with avg user score.
  let categoryScore = 0;
  if (analyzed > 0) {
    for (const cat of Object.keys(distribution) as UserCategory[]) {
      categoryScore += distribution[cat] * C.categoryScore[cat];
    }
    categoryScore /= analyzed;
  }
  const averageUserScore = analyzed > 0 ? sumUserScore / analyzed : 0;
  let score = 0.7 * categoryScore + 0.3 * averageUserScore;

  const spikes = detectSpikes(scored);
  const penalty = Math.min(
    C.spike.maxPenalty,
    spikes.length * C.spike.penaltyPerSpike
  );
  score = Math.max(0, score - penalty);
  score = Math.round(score);

  const reasoning = buildReasoning(distribution, analyzed, spikes, penalty);

  return {
    score,
    label: scoreLabel(score),
    analyzed,
    totalStargazers,
    distribution,
    reasoning,
    spikes,
    averageUserScore: Math.round(averageUserScore),
    users: scored,
  };
}

function buildReasoning(
  distribution: Record<UserCategory, number>,
  analyzed: number,
  spikes: StarSpike[],
  penalty: number
): string[] {
  if (analyzed === 0) return ["No stargazers were analyzed."];

  const bullets: string[] = [];
  const activeShare = pct(
    distribution.active + distribution.ossContributor,
    analyzed
  );
  bullets.push(
    `${activeShare}% are active developers or open-source contributors (${
      distribution.active + distribution.ossContributor
    } of ${analyzed}).`
  );
  bullets.push(
    `${pct(distribution.ossContributor, analyzed)}% are notable open-source contributors.`
  );
  bullets.push(
    `${pct(distribution.inactive, analyzed)}% are established but dormant accounts.`
  );
  bullets.push(
    `${pct(distribution.recentlyJoined, analyzed)}% joined GitHub in the last ${C.recentlyJoinedDays} days.`
  );

  const fakeShare = pct(distribution.suspectedFake, analyzed);
  if (fakeShare > 0) {
    bullets.push(
      `${fakeShare}% look like fake or bot accounts (new, empty profiles).`
    );
  } else {
    bullets.push("No accounts matched the suspected fake/bot profile.");
  }

  if (spikes.length > 0) {
    bullets.push(
      `⚠️ ${spikes.length} suspicious star spike${
        spikes.length > 1 ? "s" : ""
      } detected (clusters dominated by new/fake accounts) — score reduced by ${penalty} points.`
    );
  } else {
    bullets.push("No abnormal star-timing spikes detected.");
  }

  return bullets;
}
