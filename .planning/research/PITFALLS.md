# Pitfalls Research

**Domain:** Internal agency operations platform — Meta Ads / Google Ads API integration, automated reporting, budget/contract alerting, lightweight financial tracking (small team, ~10 clients)
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH (API mechanics verified against official docs; dashboard/alerting/small-team failure patterns verified against multiple independent sources)

## Critical Pitfalls

### Pitfall 1: Treating Meta/Google Ads data as real-time when it isn't (attribution lag)

**What goes wrong:**
The weekly report or "verba baixa" alert is generated from API data that looks final but isn't. Meta explicitly states conversion data can be revised for up to 28 days after the click (most revisions land in the first 72 hours), and Aggregated Event Measurement/modeled conversions carry a ~72-hour reporting delay. A report sent to the client on Monday can show numbers that visibly change by Wednesday when the client (or the agency) checks Ads Manager directly — destroying trust in the tool.

**Why it happens:**
Developers assume "I called the API, I got a number, that number is correct" without realizing Ads Manager UI and the Marketing API read from different pipelines with different refresh cadences and different default attribution windows — Meta itself confirms these will not match exactly.

**How to avoid:**
- Always render a visible "dados de HH:mm, DD/MM — sujeitos a revisão" (data as-of timestamp) on every report and dashboard view, not just on hover.
- For the weekly report, prefer a stable window (e.g., data through end of previous day, excluding the last 24-48h if precision matters) rather than "as of right now."
- Do not build features that promise the report matches Ads Manager exactly — document internally that small discrepancies are expected and normal, so the team doesn't chase phantom bugs.

**Warning signs:** Team member says "the number in the report doesn't match what I see in Ads Manager" — investigate whether it's a real bug or expected attribution lag before "fixing" it.

**Phase to address:** Phase covering weekly report generation and daily dashboard — build the "as-of" timestamp and window logic in from day one, not as a later patch.

---

### Pitfall 2: Auth breaks silently — no one notices until a client complains

**What goes wrong:**
Meta long-lived user tokens (~60 days) only get refreshed by Meta when the user actually uses the app that day — if nobody opens the connected app, the token silently expires and all data pulls for that client start failing. Google Ads refresh tokens issued while the OAuth consent screen is in "Testing" publishing status expire after just 7 days (`invalid_grant`). Page/System User tokens tied to a specific client's Business Manager can also be revoked unilaterally by the client (password change, permission change, employee turnover) with zero warning to the agency.
For an internal tool with ~10 clients, this means one client's ad account silently "goes dark" in the dashboard while everyone assumes "no alerts = all good."

**Why it happens:**
Token refresh is treated as a "set it and forget it" implementation detail rather than a monitored system component. Teams don't distinguish "no budget alert" from "we stopped receiving data for this client 3 days ago."

**How to avoid:**
- Move the Google Cloud OAuth consent screen out of "Testing" status early (or use a Service Account / long-lived flow appropriate to production) so refresh tokens don't silently expire in 7 days.
- Track a `last_successful_sync_at` per client/ad account and treat "sync stale > N hours" as its own alert category, separate from budget/contract alerts — this catches the auth-broke-silently case.
- Surface per-client integration health (connected / token expiring soon / broken) directly on the dashboard, not buried in logs.

**Warning signs:** A client's spend/campaign numbers haven't changed in the dashboard for 24+ hours; no error is visible anywhere because the failure is in a background sync job nobody watches.

**Phase to address:** Integration/sync phase — build sync-health monitoring as a first-class feature alongside the initial Meta/Google connection work, not deferred.

---

### Pitfall 3: Building alerting that trains the team to ignore it (alert fatigue from data-delay false positives)

**What goes wrong:**
A "verba baixa" alert fires because the API pull happened mid-sync, during a delayed/partial data window, or right as the client's ad account crossed midnight in its own timezone — not because the budget is actually low. If this happens even a few times, the team starts treating alerts as "probably noise, I'll check later," which defeats the entire point of the feature (the core value proposition is exactly "no more discovering too late").

**Why it happens:**
Alerts are implemented as a simple threshold check run every sync cycle with no debounce, no confirmation window, and no distinction between "genuinely low budget" and "transient/incomplete data read."

**How to avoid:**
- Require a condition to persist across 2+ consecutive sync cycles (or a minimum time window) before firing, not a single reading.
- Deduplicate: once an alert has fired for a client/condition, don't re-fire it every sync cycle — only re-fire on state change (resolved → triggered again) or after a cool-down period.
- Make thresholds configurable per client (already planned) but also review/tune them after the first few weeks of real usage — static guessed thresholds are a common source of noisy alerts.
- Give alerts explicit states (open/acknowledged/resolved) so the team can see "already seen this" vs. "new."

**Warning signs:** Team starts saying "yeah I saw the alert but I figured it'd sort itself out" or the same client alert fires multiple times per day.

**Phase to address:** Alerting phase — debounce/persistence logic and alert state (not just "send notification") should be part of the initial alert design, not a v2 fix.

---

### Pitfall 4: The dashboard becomes "yet another tool nobody opens" because it doesn't match the real daily workflow

**What goes wrong:**
The team currently checks ad accounts manually every day and assembles the weekly report manually every Monday. If the new system doesn't slot cleanly into that exact cadence — or requires the team to also keep checking ClickUp/spreadsheets/Ads Manager "just in case" — it becomes an extra step rather than a replacement, and gets abandoned within weeks. This is the single most common failure mode for internal dashboards: research on failed internal BI tools consistently shows the gap between what's built and how the team actually works (data trust once lost is very hard to recover, and go-live is the start of adoption, not the finish line).

**Why it happens:**
Requirements come from what leadership/owner wants to see (strategic KPIs) rather than what the person doing the daily grind needs to stop doing manually (checking each account, retyping numbers into a report).

**How to avoid:**
- Anchor the v1 scope tightly to the two concrete daily/weekly rituals already described in PROJECT.md: daily account check and Monday report assembly. Don't add "nice to have" analytics screens until those two are trusted and used.
- Ship with real client data from day one of usage (not a demo/sample dataset) — internal tools that are only validated internally before going live to real daily use tend to reveal fatal usability gaps only once real users are on it live.
- After go-live, actively track usage (did each team member open it today?) for the first few weeks — don't assume silence means adoption.

**Warning signs:** Team members quietly keep using the spreadsheet/manual check "just to be sure"; the tool is opened only right before the Monday report deadline instead of daily.

**Phase to address:** Should shape the entire roadmap — earliest phases should deliver the daily-check replacement and report-assembly replacement end-to-end (even narrow), rather than a broad partial dashboard across many features.

---

### Pitfall 5: Under-scoping API access levels and hitting a wall right before go-live

**What goes wrong:**
Meta's Marketing API defaults new apps to Development Mode / Standard Access, which only works for ad accounts the developer personally owns or manages. To pull data for clients' ad accounts that live in *their* Business Manager, the agency needs those clients to grant System User / partner access into the agency's Business Manager — and if the app needs to operate broadly across many external ad accounts, Advanced Access requires App Review and mandatory Business Verification, which can take days to weeks and is easy to discover "too late," right when the team wants to onboard the next client.
Google Ads API similarly requires an approved developer token (Basic Access is capped at 15,000 operations/day, sufficient for ~10 clients but not unlimited) and correctly structured Manager Account (MCC) access with a `login-customer-id` header — a client account not properly linked under the MCC produces an opaque "user doesn't have permission" error.

**Why it happens:**
Teams prototype against their own/test accounts successfully and assume production access "just works" the same way, not realizing the client-account-access and verification steps are a separate, often slow, business process (client has to grant access; Meta has to review/verify the business).

**How to avoid:**
- Set up the Business Manager (Meta) and Manager/MCC account (Google) structure, request the correct access level (Standard is enough if the agency operates within its own Business Manager holding client accounts as partners; confirm before assuming Advanced Access is needed), and start Business Verification in parallel with early development — don't wait until integration is "done" to discover this.
- Document, per client, the manual access-granting step (client adds agency as partner/System User in Meta Business Manager; client accepts MCC link in Google Ads) as an onboarding checklist item, since this is inherently client-dependent and can't be automated away.
- Test the full auth+access flow against at least 2-3 real client accounts (not just the agency's own) before considering the integration phase done.

**Warning signs:** Integration works perfectly against 1-2 accounts in testing but a new client's account can't be connected without unexpected manual steps or a review delay.

**Phase to address:** Should be validated at the very start of the Meta/Google integration phase — treat "confirm access level and business verification status" as a blocking first task, not an assumption.

---

### Pitfall 6: Naive rate-limit handling breaks at exactly the wrong moment (Monday morning report batch)

**What goes wrong:**
Meta's Marketing API enforces Business Use Case (BUC) rate limits shared per ad account/app tier; Development-tier access allows roughly 60 read calls per 5-minute window. Google Ads API buckets by QPS per customer ID + developer token with a token-bucket algorithm, and also enforces daily operation caps (15,000/day on Basic Access). If the weekly report generation for all ~10 clients (each requiring multiple insight calls, possibly broken down by breakdown dimension/date range/objective) fires as one synchronous burst every Monday morning, it's realistic to hit `Error 17` (user request limit) or Google's rate-limit rejections right when the report is needed most.

**Why it happens:**
Rate limits feel generous in early testing (1-2 clients, ad hoc calls) and only bite once all clients are onboarded and batch report generation runs concurrently.

**How to avoid:**
- Stagger/queue API calls across clients rather than firing all requests in parallel; add retry-with-backoff for rate-limit errors (Error 17, Meta OAuth error 190 for expired tokens, Google's `RESOURCE_EXHAUSTED`/quota errors).
- Cache/reuse data pulled during the daily sync for report generation instead of re-querying everything fresh on report day.
- Request Meta Standard Access tier (higher quota than Development) once past prototyping, since ~10 clients with daily+weekly pulls will exceed Development-tier limits.

**Warning signs:** Report generation works fine with 2-3 test clients but starts failing/timing out as more clients are onboarded, especially all on the same Monday-morning run.

**Phase to address:** Report generation phase — design the sync/report job as a queued, rate-aware batch process from the start, not a per-client synchronous loop.

---

### Pitfall 7: Currency and timezone mismatches silently corrupt cross-client aggregation

**What goes wrong:**
Each Meta ad account has its own fixed currency and timezone, permanently locked once the account has recorded spend (changing it requires creating a new ad account). If the dashboard aggregates "total verba" or "total MRR-adjacent ad spend" across clients without normalizing currency, or interprets "today's spend" using the platform's local timezone instead of each account's own timezone, daily budget figures and day-boundary alerts (e.g., "verba baixa" checked once/day) can be silently wrong for any client whose account timezone/currency differs from the assumed default.

**Why it happens:**
Early development/testing happens against one or two accounts (often the agency's own, same currency/timezone), so the mismatch never surfaces until a client with a different currency or timezone is onboarded.

**How to avoid:**
- Store and display currency per client/ad account explicitly; never assume a single global currency for aggregate views (or clearly label aggregates as "not currency-normalized" if true normalization is out of scope for v1).
- Use each ad account's own timezone (returned by the API) when computing "today's spend" / daily budget pacing for that client, rather than a single server/app timezone.
- Add at least one test client with a different currency/timezone during development if any client fits that profile.

**Warning signs:** A client's daily spend/budget alert fires at an odd time relative to their actual business hours, or totals across clients look implausible when eyeballed against known contract values.

**Phase to address:** Data model/sync phase — capture currency and timezone as first-class fields per client ad account from the initial integration, not retrofitted later.

---

### Pitfall 8: Financial tracking module drifts from reality because it's manually entered and never reconciled

**What goes wrong:**
MRR, payment dates, and revenue are described as manually tracked/visibility features (not automated billing). Without any reconciliation mechanic, this data quietly drifts from what actually happened (client cancels mid-cycle, contract value changes, a payment slips) and the "financial layer" becomes exactly the kind of stale spreadsheet-replacement the tool was meant to eliminate — but now inside a tool the team trusts more, so errors are less likely to be caught.

**Why it happens:**
Financial data has no external API to validate against (unlike ad spend, which can be cross-checked against Ads Manager), so errors are purely human-entry errors with no automatic detection.

**How to avoid:**
- Require an explicit "last reviewed/updated" date per client's financial record, and treat records older than the client's billing cycle as needing review (soft prompt, not blocking).
- Keep the MRR calculation logic simple and explicit (e.g., sum of active contracts' monthly value) rather than trying to auto-derive proration/edge cases in v1 — complex financial logic with no reconciliation source is a common over-engineering trap for a 2-3 field manual dataset.
- Log changes to contract value/status (simple audit trail) so "why did MRR change this month" is answerable without asking around.

**Warning signs:** MRR total in the tool doesn't match what's in the accounting/invoicing process; nobody can explain a discrepancy without manually re-deriving it from contracts.

**Phase to address:** Financial module phase — build the "last updated" / lightweight audit trail alongside the core CRUD, not as a later addition.

---

### Pitfall 9: Scope creep from "visibility tool" into "operations tool" erodes the core value prop

**What goes wrong:**
PROJECT.md explicitly scopes this as visibility-only (no pausing campaigns, no adjusting budgets, no automated report sending). The most natural next request once the dashboard shows "this client's budget is critically low" is "just let me pause the campaign from here" or "just send the report automatically." Each of these individually seems small, but they multiply integration complexity enormously: write-scope API access (ads_management vs ads_read) has stricter review requirements, more failure modes (a bad pause = real client money/performance impact, not just a wrong dashboard number), and turns a low-stakes internal reporting tool into a system where bugs directly affect live client campaigns.

**Why it happens:**
Once the team sees live budget/campaign data, the perceived "last mile" to acting on it feels small — but it crosses from read-only to write access, which is a fundamentally different risk and complexity tier (different permission scopes, different Meta App Review requirements, different blast radius when something goes wrong).

**How to avoid:**
- Keep the out-of-scope boundary (already defined in PROJECT.md) visible in the roadmap itself — any phase or feature proposing write access to ad platforms should be flagged as a deliberate scope decision requiring re-evaluation, not a natural extension.
- If/when campaign control is genuinely wanted later, treat it as a distinct milestone with its own risk review, not a bolt-on to the reporting/alerting phases.

**Warning signs:** A roadmap phase description starts including verbs like "pause," "adjust," "modify" against ad accounts, or "auto-send" against WhatsApp/client channels — both explicitly out of scope today.

**Phase to address:** Applies across all phases — enforce at roadmap-review time, not a single phase.

---

### Pitfall 10: Over-engineering for a scale that will never arrive (10 clients, small internal team)

**What goes wrong:**
Small internal tools for ~10 clients are a classic over-engineering trap: building multi-tenant architecture, complex RBAC, microservices, or a generalized "plugin system" for future ad platforms before there's a second platform to justify it. This burns disproportionate time relative to team size and creates a maintenance burden (more moving parts to keep working, upgrade, and understand) that a 1-2 person team can't sustain alongside actual agency work.

**Why it happens:**
Engineers naturally want to build things "properly" / future-proof, and it's hard to resist generalizing (e.g., "let's make the alert system pluggable for any metric" or "let's abstract the ads API layer for any platform") when the immediate need is just Meta + Google for ~10 clients.

**How to avoid:**
- Build for the current concrete need (10 clients, small team, 2 ad platforms, internal-only auth) and explicitly defer generalization until a third integration or real multi-tenant need actually appears — this is consistent with the project's own "no need to design for high scale in v1" constraint.
- Prefer the simplest data model and auth model that satisfies "multiple internal users with access" (e.g., simple role check) over a generalized permissions engine.
- Revisit the ClickUp replace-vs-complement decision only after core visibility features are validated (already the plan) — resist scope creep into project-management territory in the meantime.

**Warning signs:** Roadmap or design discussions reference "when we have 100 clients" or "in case we add a third ad platform" as justification for added complexity today.

**Phase to address:** Ongoing — should be a standing check applied during roadmap/phase planning, especially early architecture decisions.

---

### Pitfall 11: API version deprecation silently breaks the integration months after launch

**What goes wrong:**
Meta deprecates Marketing API versions roughly 2 years after release (with breaking removals happening on a rolling schedule — e.g., pre-v22.0 versions cut off in Sept 2025, pre-v24.0 cut off June 2026), and Google Ads API similarly retires old versions on a schedule. A small team that "sets and forgets" the integration after initial build will eventually have it stop working with no code change on their end, at a time uncorrelated with any other project activity — which is confusing to debug ("nothing changed, why is it broken?").

**Why it happens:**
Small teams without a dedicated platform/DevOps role don't track third-party API changelogs proactively; the integration is written once during the integration phase and not revisited until it breaks.

**How to avoid:**
- Always pin an explicit API version in every call (never rely on default/unversioned behavior).
- Add a recurring (e.g., quarterly) calendar reminder to check Meta and Google Ads API deprecation schedules and upgrade before forced cutoffs.
- Prefer using an official SDK (Meta Business SDK / Google Ads API client library) where available — they tend to surface deprecation warnings and simplify version bumps versus hand-rolled HTTP calls.

**Warning signs:** Sync jobs that worked fine for months suddenly start failing with version-related errors and no recent code changes.

**Phase to address:** Integration phase (pin versions from day one) + should be noted as a recurring maintenance task in project documentation, not a one-time phase concern.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Polling Meta/Google APIs synchronously per-client in a simple loop (no queue) | Fast to build, works fine at 2-3 clients | Breaks/rate-limits as client count grows, especially on report day | Only for early prototyping with <3 clients; must be queued before broader rollout |
| Hardcoding report templates per client niche (ecommerce/local/infoproduct) as separate code paths | Quick to ship first reports | Every new niche or metric tweak requires code changes; brittle | Acceptable for v1 with 3 fixed niches, but isolate template logic from data-fetch logic so it's swappable later |
| No debounce/persistence on alert conditions | Simplest possible alert implementation | Alert fatigue, team learns to ignore alerts, defeats core value prop | Never acceptable even for v1 — this is core to the product's value proposition |
| Storing financial data (MRR, payment dates) with no audit trail/last-updated tracking | Simpler schema, faster to build | Silent drift from reality, no way to debug "why is this wrong" | Acceptable only if a lightweight audit log is added before the module goes into daily real use |
| Assuming one global timezone/currency for all clients | Simpler aggregation code | Wrong daily budget calculations for clients whose ad account timezone/currency differs | Acceptable only if verified all current 10 clients share the same timezone/currency; must be re-checked before onboarding new clients |
| Using unversioned/default API calls | One less thing to configure | Breaks unexpectedly when Meta/Google roll the default version forward | Never acceptable — pin versions explicitly from the first integration commit |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Meta Marketing API | Assuming Standard/Development access works for arbitrary client ad accounts | Confirm Business Manager partner access + correct access tier (Standard vs. Advanced) per client early; start Business Verification in parallel with development if Advanced Access is needed |
| Meta Marketing API | Treating `ads_read` token expiry as "it'll refresh itself" | Long-lived tokens only refresh on active app usage days; monitor `last_successful_sync_at` and alert on staleness, not just on explicit auth errors |
| Meta Marketing API | Comparing API numbers 1:1 against Ads Manager UI and treating differences as bugs | Document that different pipelines/attribution windows cause expected small discrepancies; show data-as-of timestamps instead of promising exact parity |
| Google Ads API | Leaving the OAuth consent screen in "Testing" publishing status | Move to "In production" (or use an appropriate service-account/production flow) so refresh tokens don't expire every 7 days |
| Google Ads API | Omitting or mis-setting the `login-customer-id` header when calling through a Manager (MCC) account | Always set `login-customer-id` to the manager account ID (no hyphens) when accessing a linked client account; use `ListAccessibleCustomers` to verify what's actually linked |
| Google Ads API | Assuming unlimited daily operations on Basic Access | Confirm the 15,000 operations/day cap is sufficient for ~10 clients' daily+weekly pulls; batch/cache rather than re-querying redundantly |
| Both platforms | Firing all clients' API calls in one synchronous burst (e.g., Monday morning report run) | Queue and stagger calls with retry/backoff on rate-limit errors (Meta Error 17/190, Google quota errors) |
| Both platforms | Hand-rolling raw HTTP calls with no version pinning | Use official SDKs where practical, and always pin an explicit API version per call |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Synchronous per-client report generation loop | Report generation works in testing, slows or fails as clients are added | Queue-based/async job processing for report generation | Roughly beyond 5-8 clients pulling multiple insight breakdowns each, especially concurrently on Monday mornings |
| Re-fetching full historical data on every sync instead of incremental pulls | Sync jobs take longer over time, API quota consumed faster than necessary | Cache last-synced state; fetch only new/changed date ranges (e.g., last 1-3 days) per sync, full backfill only on initial connect | Becomes noticeable once several months of history accumulate per client |
| Alert checks running on every single sync cycle without deduplication | Alert volume grows with sync frequency rather than with real events | Debounce + state-based alerting (fire on transition, not every check) | Immediately at any sync frequency higher than daily |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Meta/Google long-lived tokens and refresh tokens in plaintext (e.g., in a config file or unencrypted DB column) | Token leak grants read (or worse, write) access to real client ad accounts and spend data | Store tokens encrypted at rest; restrict access to the service role that performs syncs only |
| Sharing one internal "admin" login across the whole team instead of per-user accounts | No accountability for who changed a threshold, contract value, or financial record; harder to revoke access when someone leaves | Individual accounts per team member even in an internal-only tool, since financial and client data sensitivity warrants basic accountability |
| Granting the agency's Meta/Google integration broader write scopes (`ads_management`) than actually needed for a read-only visibility tool | Larger blast radius if credentials are compromised or a bug fires an unintended write call | Request only `ads_read`/read-equivalent scopes consistent with the "visibility, not operation" scope defined in PROJECT.md |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No visible "data as of" timestamp on dashboard/report figures | Team disputes numbers that are actually just delayed/lagging, loses trust in the tool | Always show sync/data timestamp prominently next to figures that can lag |
| Alerts with no acknowledge/resolve state | Team can't tell a new alert from one already handled; alerts pile up and get ignored | Explicit alert lifecycle (open/acknowledged/resolved) visible in the UI |
| One-size-fits-all report template ignoring client niche (ecommerce vs local vs infoproduct) | Report feels generic/wrong for the client's actual goals, requiring manual editing anyway (defeats automation purpose) | Segment report content by client objective from day one, since this was already identified as a requirement |
| Dashboard requires many clicks to see "which clients need attention today" | Team reverts to manual account-by-account checking, tool doesn't replace the daily ritual | Lead with a prioritized "needs attention" view (low budget, stale sync, expiring contract) rather than a flat client list |

## "Looks Done But Isn't" Checklist

- [ ] **Meta/Google integration:** Often missing handling for the "client revoked access" / "token expired" case — verify the dashboard clearly shows broken integrations distinct from "all good," not just a silently empty/stale value.
- [ ] **Weekly report generation:** Often missing handling for a client with a paused account, zero spend that week, or a partial API failure for one metric — verify the report renders something sensible (not a crash or blank section) rather than silently omitting the client.
- [ ] **Budget alerts:** Often missing debounce/persistence — verify an alert doesn't fire repeatedly for the same ongoing condition every sync cycle.
- [ ] **Contract renewal alerts:** Often missing handling for contracts with no defined end date, or already-expired contracts entered retroactively — verify these don't produce nonsensical alerts (e.g., "expires in -400 days").
- [ ] **Financial module (MRR):** Often missing any way to see why MRR changed month over month — verify there's at least a simple change log per client's financial record.
- [ ] **Multi-currency/timezone handling:** Often missing entirely — verify daily budget/spend figures use each client's own ad-account timezone and currency, not a single app-wide default.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Team stopped trusting alerts due to false positives | MEDIUM | Pause alert notifications temporarily, audit and retune thresholds/debounce logic with real historical data, re-launch alerts with a clear "these are fixed now" communication to the team |
| Dashboard abandoned in favor of manual checking | HIGH | Identify the specific daily/weekly step it failed to replace (via direct team interview, not assumption), rebuild that one workflow end-to-end tightly before reintroducing the rest |
| API integration broke due to version deprecation | LOW-MEDIUM | Update pinned API version, run against migration guide, re-test against 1-2 real client accounts before redeploying |
| Financial data drifted from reality | MEDIUM | One-time manual reconciliation against actual invoicing/contracts, then add the missing audit-trail/last-updated mechanism to prevent recurrence |
| Hit Advanced Access / Business Verification wall right before onboarding a new client | MEDIUM-HIGH (time, not code) | Start App Review / Business Verification process immediately (can take days-weeks); in the interim, use Standard Access workflow (client grants direct partner access) as a stopgap if compatible with the app's use case |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Attribution lag treated as real-time (#1) | Report generation / dashboard phase | Data-as-of timestamp visible on every figure; team briefed that small discrepancies vs. Ads Manager are expected |
| Silent auth/token failures (#2) | Integration/sync phase | `last_successful_sync_at` tracked and surfaced per client; stale-sync alert exists independently of budget/contract alerts |
| Alert fatigue from false positives (#3) | Alerting phase | Alerts require persistence across cycles before firing; alert has open/acknowledged/resolved state; no duplicate fires for same ongoing condition |
| Dashboard doesn't match real workflow, gets abandoned (#4) | Roadmap-wide, earliest phases | Daily-check and Monday-report rituals are the first two things fully replaced end-to-end; usage tracked post-launch for first weeks |
| API access level / verification underestimated (#5) | Start of integration phase | Access level and Business Verification status confirmed against 2-3 real (non-agency-owned) client accounts before integration phase is marked done |
| Naive rate-limit handling breaks on report day (#6) | Report generation phase | Batch/queue design with backoff verified under load of all ~10 clients simultaneously, not just 1-2 test clients |
| Currency/timezone mismatch corrupts aggregates (#7) | Data model / sync phase | Currency and timezone stored per client ad account; daily budget calculations verified against a non-default-timezone/currency test client if one exists |
| Financial data drifts unreconciled (#8) | Financial module phase | Lightweight audit trail / last-updated field present on financial records from initial build |
| Scope creep into write/operational features (#9) | All phases (governance) | Any phase proposing ad-account write access or auto-send is explicitly flagged and re-evaluated against PROJECT.md's Out of Scope list before inclusion |
| Over-engineering for scale/generality that isn't needed (#10) | Architecture decisions, early phases | Design choices justified by current concrete needs (10 clients, 2 platforms, internal auth), not hypothetical future scale |
| API version deprecation breaks integration later (#11) | Integration phase + ongoing maintenance | API version explicitly pinned in all calls; recurring reminder scheduled to check deprecation notices |

## Sources

- [Meta for Developers — Marketing API Rate Limiting](https://developers.facebook.com/docs/marketing-api/overview/rate-limiting/) — HIGH confidence (official docs)
- [Meta for Developers — Marketing API Versioning](https://developers.facebook.com/docs/marketing-api/overview/versioning/) — HIGH confidence (official docs)
- [Meta for Developers — Authorization](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization) — HIGH confidence (official docs)
- [Google for Developers — Google Ads API Access Levels and Permissible Use](https://developers.google.com/google-ads/api/docs/api-policy/access-levels) — HIGH confidence (official docs)
- [Google for Developers — API Limits and Quotas](https://developers.google.com/google-ads/api/docs/best-practices/quotas) — HIGH confidence (official docs)
- [Google for Developers — Rate Limits](https://developers.google.com/google-ads/api/docs/productionize/rate-limits) — HIGH confidence (official docs)
- [Google for Developers — Authorization and HTTP Headers (login-customer-id)](https://developers.google.com/google-ads/api/rest/auth) — HIGH confidence (official docs)
- [Google for Developers — Understand the Google Ads Access Model](https://developers.google.com/google-ads/api/docs/oauth/access-model) — HIGH confidence (official docs)
- [Google Ads API developer forum — invalid_grant / refresh token expiration in Testing status](https://groups.google.com/g/adwords-api/c/LgBodqQwDKA) — MEDIUM confidence (community reports, consistent with known OAuth behavior)
- [AGrowth.io — Facebook Ad Account Currency guide](https://agrowth.io/blogs/facebook-ads/facebook-ad-account-currency) — MEDIUM confidence (third-party, consistent with Meta's documented per-account currency lock)
- [fiveninestrategy.com — Meta Attribution Lag Explained](https://fiveninestrategy.com/meta-attribution-lag-explained/) — MEDIUM confidence (third-party, aligned with Meta's official 28-day revision window statements)
- [Improvado — Facebook/Meta Ads Data Challenges: Enterprise Playbook](https://improvado.io/blog/facebook-ads-data-challenges) — MEDIUM confidence (third-party, data-pipeline discrepancy pattern corroborated across multiple sources)
- [Infomaze Elite — Why Most BI Projects Fail at Adoption](https://www.infomazeelite.com/blog/why-most-bi-projects-produce-dashboards-nobody-uses/) — MEDIUM confidence (industry analysis, consistent pattern across sources)
- [LinkedIn (Humberto Rendón Ruiz) — The Dashboard Nobody Asked For: A Case Study in Failed Data Projects](https://www.linkedin.com/pulse/dashboard-nobody-askedfor-case-study-failed-humberto-rend%C3%B3n-ruiz) — MEDIUM confidence (case study / practitioner account)
- [Datadog — Alert Fatigue: What It Is and How to Prevent It](https://www.datadoghq.com/blog/best-practices-to-prevent-alert-fatigue/) — MEDIUM-HIGH confidence (established monitoring vendor, widely corroborated practices)
- [IBM — What Is Alert Fatigue?](https://www.ibm.com/think/topics/alert-fatigue) — MEDIUM-HIGH confidence
- [ScopeStack — Top 7 Causes of Scope Creep and How to Prevent It in IT Projects](https://scopestack.io/blog/top-7-causes-of-scope-creep-and-how-to-prevent-it-in-it-projects) — MEDIUM confidence (industry analysis)
- [PMI — Controlling Scope Creep](https://www.pmi.org/learning/library/controlling-scope-creep-4614) — MEDIUM-HIGH confidence (established PM body)
- Cross-referenced against `.planning/PROJECT.md` for project-specific scope boundaries (Out of Scope items, ~10 client scale, small internal team) — primary source for applicability judgments

---
*Pitfalls research for: Internal agency operations platform (paid-traffic agency, ~10 clients, small team)*
*Researched: 2026-07-10*
