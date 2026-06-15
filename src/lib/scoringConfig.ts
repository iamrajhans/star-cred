// Tunable weights and thresholds for the scoring model. Days unless noted.

export const SCORING_CONFIG = {
  /** Per-user score weights (sum to 1). */
  userWeights: {
    age: 0.2,
    activity: 0.35,
    oss: 0.2,
    social: 0.15,
    profile: 0.1,
  },

  // Age component: 0 below newAccountDays, full credit at matureAccountDays.
  age: {
    newAccountDays: 30,
    matureAccountDays: 365,
  },

  // Activity component: full credit if pushed within fullCreditDays,
  // 0 by zeroCreditDays. activeWithinDays = "active developer" cutoff.
  activity: {
    fullCreditDays: 30,
    zeroCreditDays: 365,
    activeWithinDays: 180,
  },

  // OSS: fullCreditRepos = full "public work" credit; contributor* = thresholds
  // to bucket as open-source contributor (proxy — exact contrib counts are too
  // expensive to fetch in bulk).
  oss: {
    fullCreditRepos: 20,
    contributorRepos: 8,
    contributorFollowers: 10,
  },

  // Social: full credit at this follower count (log-scaled).
  social: {
    fullCreditFollowers: 500,
  },

  recentlyJoinedDays: 90,

  // Suspected fake: new account with no footprint.
  suspectedFake: {
    maxAgeDays: 120,
    maxRepos: 0,
    maxFollowers: 1,
  },

  // Per-category contribution to the aggregate score (0-100 anchors).
  categoryScore: {
    active: 100,
    ossContributor: 100,
    inactive: 45,
    recentlyJoined: 35,
    suspectedFake: 0,
  } as Record<string, number>,

  // Spike = a window with >= minWindowShare and >= minWindowCount stars, of
  // which >= suspiciousFraction are new/fake. Each costs penaltyPerSpike (capped).
  spike: {
    windowDays: 1,
    minWindowShare: 0.15,
    minWindowCount: 20,
    suspiciousFraction: 0.6,
    penaltyPerSpike: 8,
    maxPenalty: 25,
  },

  labels: [
    { min: 80, label: "Highly credible" },
    { min: 60, label: "Credible" },
    { min: 40, label: "Mixed" },
    { min: 0, label: "Questionable" },
  ],
} as const;

export function scoreLabel(score: number): string {
  for (const { min, label } of SCORING_CONFIG.labels) {
    if (score >= min) return label;
  }
  return "Questionable";
}
