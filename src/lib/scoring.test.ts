import { describe, expect, it } from "vitest";
import { aggregateRepoScore, detectSpikes } from "./aggregate";
import { categorize, scoreUser } from "./scoring";
import type { Stargazer } from "./types";

const NOW = new Date("2026-06-15T00:00:00Z").getTime();
const DAY = 1000 * 60 * 60 * 24;

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}

function makeStargazer(overrides: Partial<Stargazer> = {}): Stargazer {
  return {
    login: "user",
    starredAt: daysAgo(10),
    createdAt: daysAgo(1000),
    bio: "Software engineer",
    avatarUrl: "https://avatars.githubusercontent.com/u/123?v=4",
    isHireable: false,
    followers: 50,
    following: 30,
    publicRepos: 20,
    lastActiveAt: daysAgo(10),
    ...overrides,
  };
}

describe("categorize", () => {
  it("flags brand-new empty accounts as suspected fake", () => {
    const s = makeStargazer({
      createdAt: daysAgo(5),
      lastActiveAt: null,
      publicRepos: 0,
      followers: 0,
      bio: null,
      avatarUrl: "https://avatars.githubusercontent.com/u/9/identicons/abc.png",
    });
    expect(categorize(s, NOW)).toBe("suspectedFake");
  });

  it("flags young-but-not-empty accounts as recently joined", () => {
    const s = makeStargazer({
      createdAt: daysAgo(30),
      lastActiveAt: daysAgo(5),
      publicRepos: 2,
      followers: 3,
    });
    expect(categorize(s, NOW)).toBe("recentlyJoined");
  });

  it("identifies open-source contributors", () => {
    const s = makeStargazer({ publicRepos: 15, followers: 30, lastActiveAt: daysAgo(20) });
    expect(categorize(s, NOW)).toBe("ossContributor");
  });

  it("identifies active developers below the OSS bar", () => {
    const s = makeStargazer({ publicRepos: 2, followers: 3, lastActiveAt: daysAgo(20) });
    expect(categorize(s, NOW)).toBe("active");
  });

  it("identifies dormant established accounts as inactive", () => {
    const s = makeStargazer({
      publicRepos: 2,
      followers: 3,
      lastActiveAt: daysAgo(400),
    });
    expect(categorize(s, NOW)).toBe("inactive");
  });
});

describe("scoreUser", () => {
  it("scores an established active contributor high", () => {
    const s = makeStargazer();
    expect(scoreUser(s, NOW).score).toBeGreaterThan(70);
  });

  it("scores an empty new account near zero", () => {
    const s = makeStargazer({
      createdAt: daysAgo(3),
      lastActiveAt: null,
      publicRepos: 0,
      followers: 0,
      bio: null,
      avatarUrl: "https://avatars.githubusercontent.com/u/9/identicons/abc.png",
    });
    expect(scoreUser(s, NOW).score).toBeLessThan(15);
  });
});

describe("aggregateRepoScore", () => {
  it("rates a repo of real active devs as highly credible", () => {
    const stars = Array.from({ length: 50 }, (_, i) =>
      makeStargazer({ login: `dev${i}` })
    );
    const result = aggregateRepoScore(stars, 50, NOW);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.label).toBe("Highly credible");
    expect(result.analyzed).toBe(50);
  });

  it("rates a repo of fake accounts as questionable", () => {
    const stars = Array.from({ length: 50 }, (_, i) =>
      makeStargazer({
        login: `bot${i}`,
        createdAt: daysAgo(4),
        lastActiveAt: null,
        publicRepos: 0,
        followers: 0,
        bio: null,
        avatarUrl: "https://avatars.githubusercontent.com/u/9/identicons/x.png",
      })
    );
    const result = aggregateRepoScore(stars, 50, NOW);
    expect(result.score).toBeLessThan(40);
    expect(result.label).toBe("Questionable");
  });

  it("handles zero stargazers gracefully", () => {
    const result = aggregateRepoScore([], 0, NOW);
    expect(result.score).toBe(0);
    expect(result.analyzed).toBe(0);
  });
});

describe("detectSpikes", () => {
  it("flags a same-day cluster dominated by new/fake accounts", () => {
    // 40 fake accounts all starring on the same day, plus 10 normal earlier.
    const fakes = Array.from({ length: 40 }, (_, i) =>
      scoreUserFake(`bot${i}`)
    );
    const normals = Array.from({ length: 10 }, (_, i) =>
      scoreUser(makeStargazer({ login: `dev${i}`, starredAt: daysAgo(200) }), NOW)
    );
    const spikes = detectSpikes([...fakes, ...normals]);
    expect(spikes.length).toBeGreaterThan(0);
    expect(spikes[0].suspiciousFraction).toBeGreaterThan(0.6);
  });

  it("does not flag organic spread of real users", () => {
    const users = Array.from({ length: 50 }, (_, i) =>
      scoreUser(
        makeStargazer({ login: `dev${i}`, starredAt: daysAgo(i * 3) }),
        NOW
      )
    );
    expect(detectSpikes(users)).toHaveLength(0);
  });
});

function scoreUserFake(login: string) {
  return scoreUser(
    makeStargazer({
      login,
      starredAt: daysAgo(2),
      createdAt: daysAgo(3),
      lastActiveAt: null,
      publicRepos: 0,
      followers: 0,
      bio: null,
      avatarUrl: "https://avatars.githubusercontent.com/u/9/identicons/x.png",
    }),
    NOW
  );
}
