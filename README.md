# ⭐ Star Credibility

A 100% client-side dashboard that analyzes a GitHub repository's **stargazers** and
produces a **credibility score (0–100)** — answering the question: *how many of these
stars come from real, active developers vs. new, inactive, or bot-like accounts?*

No backend. Your GitHub token stays in your browser and talks directly to the GitHub
API. Deployed as a static site on GitHub Pages.

## What it does

For a repo (`owner/name`) it fetches stargazers (most recently starred first) via the
**GitHub GraphQL API** in lean pages of ~50 detailed users per request, and classifies
each into:

| Category | Meaning |
|---|---|
| **Active developer** | Established account that pushed code recently |
| **Open-source contributor** | Established + recently active + substantial public repos and a following |
| **Recently joined** | Account created in the last 90 days |
| **Inactive / dormant** | Established account with ~no recent activity |
| **Suspected fake / bot** | New account with empty profile (no repos/followers/activity) |

It then computes an aggregate credibility score, detects **suspicious star spikes**
(clusters of stars in a short window dominated by new/fake accounts), and explains the
result in plain language.

## Scoring signals

Per user (weighted): account age, recency of last public push (activity proxy), size of
public repo portfolio, follower count, and profile completeness. All weights and
thresholds live in [`src/lib/scoringConfig.ts`](src/lib/scoringConfig.ts) and are easy to
tune.

> **Why not exact contribution counts?** GitHub's GraphQL API rejects
> `contributionsCollection` (`RESOURCE_LIMITS_EXCEEDED`) and times out on
> `repositoriesContributedTo` (`502`) when requested across many users at once. So we use
> the most recent repository `pushedAt` as a cheap, reliable activity proxy. A future
> "deep mode" could fetch exact contributions one user at a time for a small sample.

## Getting a token

The app needs a GitHub **Personal Access Token** (classic; `read:user` scope is enough,
or no scopes — a token just raises the rate limit to 5,000 requests/hour). Create one at
<https://github.com/settings/tokens/new>. It is stored only in your browser's
`localStorage`.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # run scoring unit tests (Vitest)
npm run build    # production build into dist/
```

## Deploy to GitHub Pages

1. The `base` path in [`vite.config.ts`](vite.config.ts) must match the repo name
   (`/star-cred/` here — change it if you rename the repo).
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main`. The workflow in
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes
   the site to `https://iamrajhans.github.io/star-cred/`.

## Notes & limits

- **Sampling vs. all:** Sampling (default 300, most recent stars first) is statistically
  representative and cheap. "Analyze all" is best for repos under ~3k stars before the
  hourly rate limit becomes a concern; a live rate-limit meter and progress bar are shown.
- **Suspended/deleted accounts** are skipped (GitHub returns them as null nodes).
- **Future upgrade:** a real "Login with GitHub" OAuth flow would require a small CORS
  proxy (GitHub Pages can't safely hold an OAuth secret), so the PAT flow is used instead.
