# Architecture Research

**Domain:** Internal agency operations platform (ad-spend visibility + alerting + reporting for a paid-traffic agency, ~10 clients, small internal team)
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH — the overall shape (sync layer → data store → alerting/reporting consumers) is a well-established pattern for marketing dashboards/BI tools (verified via multiple 2026 sources on marketing ETL and ad-platform API design). Small-scale implementation specifics (cron vs. queue, monolith vs. services) are MEDIUM confidence, reasoned from current background-job tooling articles and the project's stated constraints (small team, ~10 clients, no need for high scale in v1).

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        External Ad Platforms                        │
│  ┌──────────────────────┐        ┌──────────────────────┐          │
│  │  Meta Marketing API   │        │   Google Ads API      │          │
│  └───────────┬───────────┘        └───────────┬───────────┘          │
└──────────────┼────────────────────────────────┼──────────────────────┘
               │  (pull, scheduled)              │
┌──────────────┴────────────────────────────────┴──────────────────────┐
│                     Sync / Ingestion Layer                            │
│  ┌────────────────────┐  ┌────────────────────┐                      │
│  │ Meta connector      │  │ Google Ads connector│                      │
│  │ (auth, fetch,       │  │ (auth, fetch,        │                      │
│  │  normalize)         │  │  normalize)          │                      │
│  └──────────┬──────────┘  └──────────┬───────────┘                      │
│             └────────────┬───────────┘                                  │
│                  Scheduler (cron)                                       │
└──────────────────────────┬───────────────────────────────────────────┘
                            │ upsert (idempotent writes)
┌───────────────────────────┴───────────────────────────────────────────┐
│                          Data Layer (DB, system of record)             │
│  clients | contracts | financials | ad_accounts | campaigns |          │
│  spend_snapshots (time-series) | creative_performance | alert_rules |  │
│  alerts | reports | users                                              │
└───────────┬─────────────────────────────┬──────────────────────────┬──┘
            │ reads                       │ reads                    │ reads
┌───────────┴───────────┐   ┌─────────────┴─────────────┐  ┌─────────┴──────────┐
│   Alerting Engine      │   │      Report Generator      │  │   Web Dashboard    │
│ (threshold checks,     │   │ (weekly, per-client,       │  │ (multi-user,       │
│  contract expiry,      │   │  templated by goal type)   │  │  internal, reads   │
│  writes `alerts` rows) │   │  writes `reports` rows     │  │  everything below) │
└───────────┬────────────┘   └─────────────┬───────────────┘  └─────────┬──────────┘
            │ surfaces as in-app notification │ surfaces as copy/paste text │
            └──────────────────────────────────┴──────────────────────────┘
                                    Dashboard UI (single web app)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Web Dashboard | Auth-gated UI for internal team; renders client overview, ad-account status, alerts, reports; the only component end users touch directly | Server-rendered or SPA web app with session-based auth; reads exclusively from the Data Layer, never calls ad platform APIs directly |
| Data Layer (DB) | Single source of truth for clients, contracts, financials, ad accounts, historical spend/performance snapshots, alert rules/instances, generated reports, users | Relational DB (Postgres is the default choice for this shape of data — relational entities, need for joins across client/contract/campaign, transactional writes) |
| Sync/Ingestion Layer | Periodically authenticates with Meta and Google Ads APIs per connected ad account, pulls accounts/campaigns/spend/creative data, normalizes both platforms into one internal schema, upserts into DB | Scheduled background jobs (cron-triggered), one connector module per platform, credential storage (OAuth tokens) scoped per client/ad account |
| Alerting Engine | Evaluates alert rules (budget thresholds, contract expiry) against current DB state; writes/updates `alerts` records; distinct sub-triggers for ad-data-based alerts (post-sync) and date-based alerts (independent schedule) | Rule evaluation job — either invoked as a step after each sync run (for budget alerts) or on its own daily schedule (for contract/date alerts); writes to DB, dashboard reads and renders |
| Report Generator | Assembles per-client weekly report from synced performance data, selecting a template based on client goal type (e-commerce, local business, info-product); outputs copy/paste-ready text | Scheduled or on-demand job that queries the Data Layer for a date range, applies a template selected by `client.goal_type`, persists the rendered report |

## Recommended Project Structure

```
src/
├── app/ (or pages/)          # Web dashboard routes + internal API endpoints
│   ├── clients/               # Client overview, contract/financial views
│   ├── traffic/                # Per-client ad account status, campaigns, creatives
│   ├── alerts/                  # In-app alert/notification views
│   └── reports/                  # Weekly report views + copy/export UI
├── db/                        # Schema, migrations, query layer (system of record)
│   ├── schema/                 # clients, contracts, financials, ad_accounts,
│   │                            # spend_snapshots, creative_performance,
│   │                            # alert_rules, alerts, reports, users
│   └── migrations/
├── sync/                      # Ingestion layer — isolated from web request path
│   ├── connectors/
│   │   ├── meta.ts              # Meta Marketing API auth + fetch + normalize
│   │   └── google-ads.ts        # Google Ads API auth + fetch + normalize
│   ├── normalize.ts             # Shared mapping to internal schema
│   └── scheduler.ts             # Cron entrypoints, run bookkeeping/logging
├── alerts/                    # Rule evaluation engine
│   ├── rules/                   # Budget threshold rule, contract expiry rule
│   └── evaluate.ts              # Reads DB, writes `alerts`
├── reports/                   # Report generation
│   ├── templates/                # ecommerce.ts, local-business.ts, info-product.ts
│   └── generate.ts               # Query + template selection + persistence
└── auth/                      # Internal multi-user auth (session/role handling)
```

### Structure Rationale

- **`sync/` is isolated from the request/response path:** it never runs inside a user's HTTP request. It only talks to external ad platform APIs and the DB. This keeps rate-limit-sensitive, slow, retry-prone code out of anything user-facing.
- **`alerts/` and `reports/` both read only from the DB, never from the ad platform APIs directly.** This is the single most important boundary in this system (see Anti-Patterns) — it keeps the dashboard, alerts, and reports mathematically consistent with each other, since they all derive from the same synced snapshot.
- **`db/schema` models spend as a time series (`spend_snapshots`), not a single mutable "current state" row.** Weekly reports need trend data ("spend this week vs last week"), and alerts need "has this been low for N consecutive checks" style logic — both require history, not just a live value.
- **One connector per ad platform, one shared normalization step:** Meta and Google Ads have very different response shapes; normalizing early means alerting/reporting/dashboard code never needs to know which platform a given campaign came from.

## Architectural Patterns

### Pattern 1: Sync-then-consume (write-through cache / staging pattern)

**What:** All ad platform data is pulled on a schedule into the DB first. Every other component (dashboard, alerts, reports) reads only from the DB — never live from Meta/Google APIs.
**When to use:** Any time multiple internal consumers need the same external data, and that external data is rate-limited, slow, or requires OAuth credentials that shouldn't be duplicated across call sites.
**Trade-offs:** Data is only as fresh as the last sync (acceptable here — the agency's current process is a daily manual check, so daily-to-hourly sync is a strict improvement, not a regression). In exchange, you get consistency across dashboard/alerts/reports, one place to handle rate limits and auth, and resilience to platform API slowness/outages (stale data beats no data).

**Example:**
```typescript
// sync/scheduler.ts — runs on a cron trigger, not inside a user request
async function runDailySync() {
  for (const account of await db.adAccounts.listActive()) {
    const raw = account.platform === 'meta'
      ? await metaConnector.fetchInsights(account)
      : await googleAdsConnector.fetchInsights(account);
    const normalized = normalize(raw, account.platform);
    await db.spendSnapshots.upsert(normalized); // idempotent
  }
  await alerts.evaluateBudgetRules();   // runs immediately after sync
}
```

### Pattern 2: Idempotent upsert with historical snapshots

**What:** Each sync run writes a new time-stamped snapshot row per campaign/account rather than overwriting a single "latest" row, keyed so re-running a sync for the same period doesn't create duplicates.
**When to use:** Whenever downstream consumers need trend/comparison data (weekly reports comparing week-over-week, alerts that need "N consecutive low-budget days") or need to tolerate partial/retried sync runs without corrupting history.
**Trade-offs:** Slightly more storage and a bit more query complexity (need to select "latest" or "range" rather than just reading one row), but this is cheap at agency scale (~10 clients, 2 platforms) and avoids a rewrite later when reporting/alerting need history that a "current state only" model can't provide.

### Pattern 3: Decoupled rule evaluation (alerting as a consumer, not a gatekeeper)

**What:** The alerting engine is a separate evaluation step that reads the DB (synced ad data + client config + contracts) and writes `alerts` rows. It does not sit in the sync path and does not block ingestion; a sync failure and an alert failure are independent concerns.
**When to use:** Any system where "check thresholds" logic needs to evolve independently of "fetch data" logic — e.g., adding a new alert type (contract expiry) shouldn't require touching the Meta/Google connectors at all, since contract alerts don't depend on ad data.
**Trade-offs:** Requires a place to persist alert *state* (open/resolved, last-triggered) to avoid re-notifying on every evaluation — this is a small but necessary piece of schema design, not just "if spend < threshold, notify."

## Data Flow

### Ad-data flow (sync → alert → report → dashboard)

```
Meta / Google Ads APIs
    ↓ (scheduled pull, per ad account)
Sync connectors → normalize → upsert
    ↓
Data Layer: spend_snapshots, campaigns, creative_performance
    ↓                              ↓                         ↓
Alerting Engine                Report Generator           Dashboard
(budget threshold rules)       (weekly, per client,       (reads current +
writes → alerts table          templated by goal type)     historical state)
                                writes → reports table
    ↓                              ↓                         ↓
                    Dashboard UI (in-app notifications, report copy/paste, traffic views)
```

### Contract/financial flow (independent of ad sync)

```
Data Layer: contracts, financials (entered manually via dashboard, not synced from any API)
    ↓
Alerting Engine (contract expiry / renewal rule — date comparison, no ad data needed)
    ↓
Dashboard (in-app alert)
```

### Key Data Flows

1. **Budget/spend visibility:** Ad platform → Sync layer (normalize) → DB (time-series) → Dashboard renders current state; Alerting Engine evaluates threshold rules right after each sync completes; Report Generator aggregates the week's snapshots into a client-facing summary. All three downstream consumers read the *same* normalized DB rows, so numbers never disagree between the dashboard, an alert, and a report.
2. **Contract/financial visibility:** Entered directly into the DB through the dashboard (no external API), evaluated by the alerting engine on a simple daily date-based schedule, independent of whether the ad sync succeeded that day. This flow has no dependency on the sync layer at all.
3. **Report assembly:** Report Generator queries `spend_snapshots`/`creative_performance` for the client's week, looks up `client.goal_type`, selects the matching template (e-commerce/local business/info-product), and renders copy/paste-ready text. It does not call ad platform APIs — it is a pure read of already-synced data, which keeps report generation fast and independent of live API availability/rate limits.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| ~10 clients, small internal team (current) | Single monolithic app + single Postgres DB + simple cron-triggered sync job is sufficient. No queue, no microservices, no data warehouse needed. |
| ~50-100 clients | Sync job runtime grows linearly with (clients × ad accounts). Still fine as a single scheduled job as long as it stays within Meta/Google Ads rate limits; consider batching/async job endpoints (Meta's Insights Async Jobs, Google's `SearchStream`) before considering infra changes. |
| 100+ clients / multiple internal apps consuming the same data | This is when a queue-backed worker (e.g., a Postgres-backed job queue) or splitting sync into its own service becomes worth the complexity — driven by API rate-limit management and job runtime, not by user count (internal team size won't grow the same way). |

### Scaling Priorities

1. **First bottleneck: ad platform API rate limits, not app/database load.** Meta's Insights endpoint and Google Ads API both rate-limit per ad account/customer ID (Meta: ads_insights capped per-account per-hour with formula based on active ads; Google: token-bucket QPS per customer ID + developer token). At ~10 clients × 2 platforms this is nowhere close to being a problem, but the sync layer should be built to respect per-response rate-limit headers (Meta's `x-fb-ads-insights-throttle`) and use incremental pulls (only changed data, cached static entity fields) from day one so it doesn't need rework later.
2. **Second bottleneck (much further out): sync job runtime exceeding the scheduling window.** If the daily/hourly sync starts taking longer than the interval between runs, split it into a proper job queue with concurrency limits rather than a single sequential cron script.

## Anti-Patterns

### Anti-Pattern 1: Alerting or reporting calling ad platform APIs directly

**What people do:** Have the alerting engine or report generator make live calls to Meta/Google Ads APIs at evaluation/generation time instead of reading from the synced DB.
**Why it's wrong:** Duplicates API call volume against the same rate limits the sync layer is already managing, introduces inconsistency (dashboard shows one number, a live-fetched alert shows a slightly different one because they ran seconds apart), and makes the alert/report generation as slow and fragile as the ad platform APIs themselves (timeouts, auth errors) instead of being fast, deterministic reads of local data.
**Do this instead:** Sync layer is the only component that talks to Meta/Google Ads APIs. Everything else — dashboard, alerts, reports — reads exclusively from the Data Layer.

### Anti-Pattern 2: Overwriting "current state" instead of keeping history

**What people do:** Store only the latest spend/performance numbers per campaign (one row updated in place each sync) because it's simpler.
**Why it's wrong:** Weekly reports need "this week's spend," "trend vs. last week," and creative performance over a date range — none of which are answerable from a single overwritten row. Alerts that need "budget has been low for 3 days" similarly can't be built. Discovering this after the fact means a schema migration and backfilling data you never captured.
**Instead:** Model spend/performance as an append-only, timestamped, idempotently-upserted table from the start — cheap at this scale, and it's the data model every downstream feature in this project (reports segmented by week, budget alerts) actually needs.

### Anti-Pattern 3: Building for scale this project doesn't have yet

**What people do:** Reach for message queues (Kafka/RabbitMQ), microservices, or a full data-warehouse/ELT stack (common advice in general "marketing data pipeline" content aimed at teams syncing dozens of data sources into Snowflake/BigQuery) for a 10-client internal tool.
**Why it's wrong:** Adds operational complexity (multiple services to deploy/monitor, more failure modes) with no corresponding benefit at this scale — the project's own constraints explicitly call out that v1 doesn't need to be designed for high scale.
**Instead:** Single app, single relational DB, cron-triggered sync jobs. Revisit only if client count or API volume grows an order of magnitude (see Scaling Considerations).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Meta Marketing API | OAuth per ad account/business; scheduled pulls via `ads_insights`; use batch requests (up to 50 calls per HTTP request, counts as 1 rate-limit unit) for multiple accounts/campaigns; use the Async Insights Job endpoint for larger pulls (runs in background, doesn't consume rate-limit quota while running) | Watch the `x-fb-ads-insights-throttle` response header to self-throttle; Dev-tier apps have much lower quota (60 points/5 min) than Standard tier — confirm which tier the agency's app will run under before assuming Standard-tier limits apply |
| Google Ads API | OAuth refresh token + developer token per client account; use `SearchStream` over paginated `Search` for report pulls; incremental sync (pull only changed/fast-moving fields frequently, cache static entity fields locally) | Rate limits are a token-bucket QPS per customer ID + developer token (`RESOURCE_TEMPORARILY_EXHAUSTED` on violation) — implement backoff with jitter, not immediate retry, to avoid retry storms; note the 2026 change that performance data older than 37 months becomes inaccessible via the API, irrelevant for weekly reports but relevant if historical analytics are ever added |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|-----------------|-------|
| Sync layer ↔ Data layer | Direct DB writes (upsert) | Sync layer is the only writer of ad-platform-derived tables; dashboard/alerts/reports never write these tables |
| Data layer ↔ Alerting engine | Direct DB reads + writes to `alerts` table | Alerting engine triggered two ways: (a) immediately after each sync run for budget/spend rules, (b) on its own daily schedule for date-based rules (contract expiry) that don't depend on sync — keep these as separate trigger paths so one doesn't block the other |
| Data layer ↔ Report generator | Direct DB reads + writes to `reports` table | Triggered on a weekly schedule (ahead of the agency's Monday report day) and/or on-demand from the dashboard; must never call ad APIs directly |
| Dashboard ↔ everything else | Reads only, via the Data Layer (or thin internal API routes wrapping DB queries) | Dashboard should have no direct dependency on sync/alert/report internals beyond reading their output tables — keeps the UI layer swappable and simple |
| Auth ↔ everything else | Session/role check gating all dashboard routes and any manual-trigger endpoints (e.g., "re-sync now," "regenerate report") | Internal-only in v1 (no client portal), which simplifies this to a single internal role model rather than multi-tenant permission boundaries |

## Sources

- [Google Ads API — Rate limits (official docs)](https://developers.google.com/google-ads/api/docs/productionize/rate-limits) — HIGH confidence, official documentation
- [Google Ads API — Limits and Quotas (official docs)](https://developers.google.com/google-ads/api/docs/best-practices/quotas) — HIGH confidence, official documentation
- [Meta for Developers — Marketing API Rate Limiting (official docs)](https://developers.facebook.com/docs/marketing-api/overview/rate-limiting/) — HIGH confidence, official documentation
- [Meta for Developers — Insights API Limits & Best Practices (official docs)](https://developers.facebook.com/docs/marketing-api/insights/best-practices/) — HIGH confidence, official documentation
- [Railway Guides — Choose Between Cron Jobs, Background Workers, and Queues](https://docs.railway.com/guides/cron-workers-queues) — MEDIUM confidence, current (2026) practitioner guidance on background job architecture for small/mid apps
- [Render — Next.js, Background Jobs & PostgreSQL: Production in 2026](https://render.com/articles/nextjs-background-jobs-postgresql-production) — MEDIUM confidence, corroborates colocated app+DB+worker pattern for small teams
- [Digital Applied — Marketing Data Pipelines in 2026 (ETL-to-Activation Guide)](https://www.digitalapplied.com/blog/marketing-data-pipeline-etl-2026-modern-data-stack-reference) — MEDIUM confidence, used to identify (and explicitly scope out) the warehouse/ELT pattern as over-scaled for this project's size
- General threshold/rule-based alerting pattern sources (Elastic, Confluent, item.com) — LOW-MEDIUM confidence, used only to corroborate the standard "evaluate rules against stored data, write alert records, route to notification channel" shape, which is domain-independent and not specific to ad-tech

---
*Architecture research for: Internal agency operations platform (paid-traffic agency, ad-platform sync + alerting + reporting)*
*Researched: 2026-07-10*
