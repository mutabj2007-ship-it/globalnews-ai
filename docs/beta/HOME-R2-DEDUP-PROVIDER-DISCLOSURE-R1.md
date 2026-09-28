# Home R2 — Story Deduplication + Provider Disclosure Correction R1

Base: `release/alpha-m08-integrated-r1` @ `6a163fdfa06b69b83df22fd0b33888a604c81c7a`.
Branch: `fix/home-r2-dedup-provider-disclosure-r1`. Not merged, not deployed.

## 1. Root cause

`frontend/src/app/page.tsx` built `homeArticles = featured + inFocus + discovery + latestUpdates`,
sorted it newest first (`newestFirst`) and passed it to `<WorldIn60Seconds items={newestFirst}>`,
while `<WhatsHappeningNow>` rendered `featured + inFocus + discovery`. The newest editorial
stories are exactly the ones the allocator places first, so the 60-second module showed the
same stories as What's happening now (5/5 at desktop, 3/3 on phone, measured).

- Entered: PR #59 (Home Welcome & Discovery R1 Rev A), commit `4843c29`. Carried unchanged
  through PR #60 (`b04c5fc`, merged `6a163fd`).
- Before #59 (`60d4aa9`) the brief read `feed.briefUpdates` (chronological head minus the
  lead, max 3), which already accepted overlap with inFocus/discovery; #59 widened it to the
  whole merged pool.
- Contract drift: `WorldIn60Seconds.tsx` still documented its source as `feed.latestUpdates`.

## 2. Allocation (after)

```
ONE getHomeFeed() → allocateHomeFeed (exclusive)
  ├─ featured + inFocus + discovery ──► What's happening now   (unchanged)
  └─ latestUpdates ──► allocateWorldIn60 ──► Your world in 60 seconds (≤5, never padded)
        minus every What's happening story by article id AND canonical URL,
        deduped internally; empty → one-line truthful note
```

## 3. Provider disclosure

Home's badge uses Home-specific provider-neutral labels through a bounded `labels` prop on
`DataModeLabel`: `LIVE REPORTING` / `RELACJE NA ŻYWO`; cached, demo, unavailable and unknown
keep their own truthful labels. The shared `liveStatusStrip` dictionary is unchanged; the
only live-rendered `DataModeLabel` consumer is What's happening now (GlobalDevelopments,
NewsroomSection, TodaySection, Hero, LiveStatusStrip are unimported retired files). Search
uses its own `RetrievalContextStatus`. Publisher `sourceName` attribution is unchanged.
Provider identity remains disclosed in Source Policy.

## 4. GNews compliance finding

- Current GNews public FAQ/Terms: attribution to GNews is appreciated but not required,
  unless the subscription plan specifically requires it.
- The GNews Free plan is for non-commercial development/testing only.
- The repository's `.env.example` (`GNEWS_PROVIDER_DISPLAY_NAME=GNews Free`) is a template
  default and does not establish which plan Railway Alpha / Public Beta actually uses.
- Railway exposes a `GNEWS_API_KEY` variable but no visible plan/tier variable.
- Therefore the active plan status is **UNVERIFIED** (not "Free").
- No plan-specific mandatory attribution requirement is recorded anywhere in the repository.
- This does not block the Alpha UI correction.

## 5. Release note

> **PUBLIC-BETA GATE:** verify the active GNews subscription permits production/commercial
> use, and whether that specific plan imposes attribution.
