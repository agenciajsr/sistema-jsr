# Feature Research

**Domain:** Agency operations / paid-traffic client reporting platform (internal tool for a Brazilian tráfego pago agency, ~10 clients)
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH (feature patterns verified across multiple category leaders; BR-market specifics and internal-tool sizing are lower confidence, based on fewer sources)

## Context: The Two Product Categories This Project Straddles

Research surfaced two distinct, mature product categories that Sistema JSR combines into one internal tool:

1. **Automated ad reporting tools** (AgencyAnalytics, Swydo, Reportei, Metrifiquei, GT Report) — pull data from ad platform APIs, format it into client-ready reports, and (in the BR/gestor-de-tráfego niche specifically) increasingly optimize for WhatsApp delivery rather than PDF/portal delivery.
2. **Agency PSA / ops platforms** (Productive.io, Scoro, HubSpot+billing stacks) — combine CRM, contracts, time tracking, invoicing, and financial reporting (MRR, margins) for the agency's own business health, not the client-facing ad performance.

Almost no product in the market cleanly does both in one lightweight tool — reporting tools assume you use a separate PSA/CRM for contracts and billing, and PSA tools assume you use a separate reporting tool for ad data. Sistema JSR's core value proposition (per PROJECT.md) is unifying both into one internal dashboard for a small team — this is itself the differentiator, not any single feature.

### What automated ad reporting tools pull and how they deliver it (sub-question 1)

**Data pulled (Meta Ads + Google Ads, consistently across AgencyAnalytics, Swydo, Reportei):**
- Account-level: total spend, remaining/available budget, account status (active/disabled/limited)
- Campaign-level: campaign name, objective, status (active/paused/ended), daily/lifetime budget, spend to date, pacing vs. budget
- Performance metrics: impressions, clicks, CTR, CPC, CPA, conversions, conversion rate, ROAS, frequency
- Creative-level: which ad/creative is driving results vs. underperforming (CTR/CPA by creative)
- Trend/comparison: period-over-period (week vs. previous week, month vs. previous month)

**How they format/deliver (this is where BR market diverges from the global SaaS default):**
- **Global tools (AgencyAnalytics, Swydo, Whatagraph):** branded client portal + scheduled PDF/email delivery, white-labeled with agency logo/domain. Built for agencies that want clients logging into a dashboard.
- **BR "gestor de tráfego" niche tools (Metrifiquei, GT Report):** built specifically around WhatsApp as the delivery channel, since BR client communication defaults to WhatsApp, not portals or email. These generate a formatted message/image ready to send, not a PDF to attach. This directly validates the PROJECT.md decision to generate "copy/paste ready for WhatsApp" content instead of building a portal or PDF exporter.
- Reportei (BR, portal-based) sits in between — customizable templates, calculated metrics, AI-written analysis text layered on top of the auto-pulled numbers, still primarily portal/PDF oriented.
- Segmentation by client objective (e-commerce vs. local business vs. infoproduct) is **not a standard built-in feature** in the tools researched — templates are generic per marketing channel (PPC, SEO, Social), not per business vertical. Sistema JSR's plan to segment report content by client objective is a genuine gap in the market tools, i.e. a real differentiator, not something to expect "for free" from any reference product.

### Agency CRM / contract tracking features (sub-question 2)

Two different maturity levels observed:
- **Full CRM tools (HubSpot, Pipedrive)** used for renewals: sales-pipeline-first, with contract renewal handled as a "deal" re-entering the pipeline near expiry. Heavy for an internal ops tool with 10 known, existing clients — no lead qualification or pipeline stages needed.
- **PSA tools (Productive.io)** treat contracts as directly tied to recurring revenue: a contract record surfaces "renews in 45 days, retainer worth $X/month" as one alert, combining the date and the money in the same notification. This pattern (contract alert carries the MRR-at-risk figure, not just a date) is directly applicable and low-complexity to replicate.
- **Alert timing best practice** across contract-renewal tooling (Zluri, Oneflow, PandaDoc, Productive): tiered reminders at 90/60/30 days before expiry, not a single reminder at the deadline. Reduces the "discover too late" failure mode named explicitly as this project's core value.

### Budget alerting patterns (sub-question 3)

Consistent pattern across Meta's native rules, Google Ads scripts, Revealbot, and monitoring layers (Swydo, Markifact):
- **Threshold-based, not just zero-balance:** alerts fire at a % of budget consumed (e.g., 80-85% of daily/lifetime budget) or at an absolute remaining-balance floor, not only when spend hits literal zero. This is more useful than a single "verba zerada" trigger because it gives the team lead time to act.
- **Per-account configurable thresholds** are standard — Swydo's "custom target thresholds," Meta's rules, and PROJECT.md's own requirement ("limiar configurável por cliente") all converge on the same pattern: one global threshold doesn't fit clients of different budget sizes.
- **Daily scheduled checks** (not real-time polling) is the norm — Swydo explicitly runs daily checks; ad platform APIs don't need sub-hourly polling for this use case, which keeps API rate-limit exposure low for a 10-client scale.
- **Delivery channel for alerts:** email and Slack are the default outputs in reference tools; for this project, in-app alerts (per PROJECT.md's explicit choice) are sufficient at v1 scale and avoid a notification-channel integration.
- **What NOT to build (validated by scope):** rule-based auto-pause or auto-budget-adjustment (Revealbot-style) is explicitly out of scope per PROJECT.md — the tool is visibility-only, optimization stays manual in the native ad managers. This matches a legitimate market pattern (Revealbot/automated-rules tools exist as a separate product category from reporting/monitoring tools) — conflating the two adds significant complexity (write-access to ad accounts, safety guardrails against bad automated actions) for no validated need at this stage.

### Financial / MRR tracking for agencies (sub-question 4)

- Dedicated MRR tools (ChartMogul, Baremetrics, QuantLedger) are built for SaaS companies with usage-based/subscription billing complexity (plan tiers, upgrades/downgrades, churn cohorts, dunning) — this is overkill for a services agency with ~10 flat-fee retainer contracts. The relevant subset is much smaller: active contract value summed = MRR, next billing date per client, simple revenue-over-time view.
- PSA tools (Productive, Scoro) model financial tracking as **derived from the contract/project record**, not a separate ledger — MRR is a rollup of active contract values, not manually re-entered. This is the right pattern for Sistema JSR: the financial layer should read from the same client/contract module rather than be a parallel data-entry surface.
- None of the researched tools attempt real billing/invoicing without a payment processor integration (Stripe, etc.) — they track dates and amounts for visibility, then hand off to accounting/invoicing tools. This matches PROJECT.md's explicit exclusion of automated billing/payment processing.

## Feature Landscape

### Table Stakes (Users Expect These)

Features the internal team will consider baseline — missing these makes the tool feel like a downgrade from what a "real" reporting tool would offer, even at small scale.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-client overview dashboard | Every agency ops/reporting tool leads with a "portfolio view" — status of all clients at a glance is the category's core UX pattern | MEDIUM | Needs to aggregate status from ad accounts, budget alerts, and contract alerts in one screen per PROJECT.md |
| Automated ad data pull (Meta Ads + Google Ads API) | Table stakes for any reporting tool in this category (AgencyAnalytics, Swydo, Reportei all lead with this) | HIGH | Requires OAuth/token management per client account, handling API rate limits and token expiry — flag for deeper research |
| Campaign/account status monitoring (active/paused, budget remaining) | Direct replacement for the daily manual account-check process named in PROJECT.md context | MEDIUM | Depends on ad data pull; needs near-daily refresh cadence, not real-time |
| Budget/spend threshold alerts, per-client configurable | Standard pattern across Swydo, Revealbot, Meta rules, Google Ads scripts — and explicitly required in PROJECT.md | MEDIUM | Depends on ad data pull + per-client config store; threshold as % remaining or absolute floor |
| Scheduled/recurring automated report generation | Core value prop of every reporting tool researched (AgencyAnalytics "Smart Reports," Swydo workflows, Reportei automation) | HIGH | Needs report templating logic, scheduling, and data aggregation across campaigns/creatives |
| Historical/period-over-period comparison in reports | Every reporting tool includes week/month-over-week/month comparisons — a report with only current-period numbers feels incomplete | MEDIUM | Requires storing/snapshotting historical pulled data, not just latest state |
| Campaign & creative performance view (what's winning/losing) | Named explicitly in PROJECT.md active requirements; standard in AgencyAnalytics/Swydo/Reportei | MEDIUM | Creative-level breakdown (CTR/CPA by ad) is more complex than campaign-level only |
| Client/contract record module (dates, values, status) | Baseline for any tool claiming to track contracts — currently dispersed in ClickUp per PROJECT.md context, this is the explicit fix | LOW-MEDIUM | Simple structured record: start date, end date/renewal date, value, status |
| Contract renewal alerts | Explicit PROJECT.md requirement; validated pattern (90/60/30-day tiers) across all contract-management tools researched | LOW-MEDIUM | Depends on contract module; tiered reminders reduce "discovered too late" risk more than single-point alerts |
| Financial layer: billing date, revenue, MRR per client | Explicit PROJECT.md requirement, confirmed as v1-not-later by the user | LOW-MEDIUM | Should derive from contract module (sum of active contract values), not a separate ledger |
| Multi-user internal access | Any tool used by more than one team member needs basic multi-user support | LOW | No client-facing roles needed at v1 (internal only, per Out of Scope) — simplifies permission model significantly |

### Differentiators (Competitive Advantage)

Features that set Sistema JSR apart from both the reporting-tool category and the PSA category — because no single reference product combines them for a small paid-traffic agency.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified ops + financial dashboard (ad health + contracts + MRR in one view) | No researched competitor combines ad performance monitoring with contract/financial tracking in one lightweight tool — agencies typically run a reporting tool AND a separate PSA/spreadsheet. This is the project's core value per PROJECT.md | MEDIUM | Architecturally this is "just" good data modeling (shared client entity) rather than novel tech — the differentiation is integration, not invention |
| Report content segmented by client objective/vertical (e-commerce, negócio local, infoproduto) | Validated as a genuine market gap — researched tools template by marketing channel, not business vertical. Directly reduces manual customization time named in PROJECT.md context | MEDIUM-HIGH | Requires objective/vertical as a client attribute driving template/metric selection logic (e.g., ROAS emphasis for e-commerce vs. lead volume for local business vs. launch-cycle metrics for infoproduto) |
| WhatsApp-optimized copy/paste report format | Matches the BR "gestor de tráfego" niche pattern (Metrifiquei, GT Report) rather than the global portal/PDF default (AgencyAnalytics, Swydo) — fits actual client communication channel used today | LOW-MEDIUM | Simpler than building a portal: format as structured text/markdown-like block ready to paste, no PDF rendering or hosting needed |
| Contract alerts carrying MRR-at-risk context | Productive.io's pattern of surfacing "renews in 45 days, worth $X/month" in the same alert, not just a bare date | LOW | Cheap to add once contract module and financial layer both exist — pure UI/query composition |
| Proactive combined "what needs attention today" view | Reactive daily manual account-checking (current process) replaced by a single triaged list spanning budget, contracts, and performance anomalies | MEDIUM | This is the payoff of unifying the data — becomes possible once budget alerts + contract alerts + performance data share one dashboard |

### Anti-Features (Commonly Requested, Often Problematic)

Features that appear in nearly every reference product researched but are explicitly wrong for this project's stage and scope — several already correctly excluded in PROJECT.md.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Client-facing portal / white-label branding | Every major reporting tool (AgencyAnalytics, Swydo) leads with this; feels like "what a real tool has" | Adds auth/permissions complexity, branding/theming work, and hosting concerns for zero validated demand — PROJECT.md explicitly scopes v1 as internal-only | Keep reports as internally-generated, copy/paste content; revisit portal only if clients ask for self-serve access |
| In-tool campaign optimization (pause campaigns, adjust budget from the dashboard) | Category tools like Revealbot show this is technically possible and "closes the loop" | Requires write-access to ad accounts (higher API privilege, higher risk of costly mistakes), safety guardrails, and undo/audit logic — a different product category (automation) from visibility tools | Keep tool read-only against ad platforms; optimization stays manual in Meta/Google's native managers, exactly as PROJECT.md specifies |
| Automated WhatsApp send integration | Tools like Metrifiquei send reports directly, seems like the "final mile" of automation | WhatsApp Business API integration adds real complexity (approval, templates, session management) for a step that takes the team seconds today (copy/paste); premature before the report-generation core is validated | Generate WhatsApp-ready formatted content; team pastes and sends manually until process is proven, then consider automating |
| Automated billing/invoicing/payment processing | PSA tools (Scoro, Productive) bundle this; "financial tracking" can sound like it implies billing | Payment processing brings compliance, integration (gateway/PIX/boleto), and error-handling scope far beyond "visibility of dates and values" — explicitly excluded in PROJECT.md | Track billing dates and amounts as data; actual invoicing/collection stays in existing tools/manual process |
| Broad multi-channel data integration (SEO, email, organic social, 80+ sources like AgencyAnalytics) | Signals "comprehensive" and future-proof | Massive integration surface for a tool whose validated need is specifically Meta Ads + Google Ads for ~10 clients; each extra source is auth, mapping, and maintenance burden with no current demand | Ship with Meta Ads + Google Ads only; add sources only when a specific client/service line requires it (PROJECT.md already flags other ad platforms as "later") |
| Full sales-pipeline CRM (deal stages, lead scoring, new-business pipeline) | "CRM" in the project's own vocabulary might imply this; HubSpot/Pipedrive-style tools are the default mental model for "CRM" | This project's clients are all already-signed, active accounts — there's no lead qualification or new-business pipeline need described anywhere in PROJECT.md; building pipeline stages solves a problem that doesn't exist yet | Keep the "CRM" scope to what PROJECT.md actually asks for: client + contract records, not a sales pipeline |
| AI-powered anomaly detection / predictive insights (AgencyAnalytics "Ask AI", trend forecasting) | Increasingly standard in 2026-era reporting tools, feels like competitive necessity | At 10-client scale, simple threshold-based alerts (already required) catch the same problems with far less complexity and no model/false-positive tuning burden | Ship deterministic threshold alerts first; reconsider AI-based anomaly detection only after volume/complexity grows enough that manual thresholds stop being sufficient |

## Feature Dependencies

```
Client/Contract Module (client record, objective/vertical, contract dates & value)
    └──requires──> (nothing — foundational data model)

Ad Platform Data Pull (Meta Ads + Google Ads API integration)
    └──requires──> (nothing — foundational, but gated on API access/auth per client)

Campaign/Account Status Monitoring
    └──requires──> Ad Platform Data Pull

Budget-Low Alerts (per-client threshold)
    └──requires──> Ad Platform Data Pull
    └──requires──> Client Module (to store per-client threshold config)

Contract Renewal Alerts
    └──requires──> Client/Contract Module

Financial Layer (MRR, billing dates, revenue)
    └──requires──> Client/Contract Module (derives MRR from active contract values)

Automated Recurring Report Generation
    └──requires──> Ad Platform Data Pull (source metrics)
    └──requires──> Client/Contract Module (client objective drives template/segment selection)

Report Segmentation by Client Objective (differentiator)
    └──requires──> Automated Recurring Report Generation
    └──requires──> Client Module (objective/vertical field)

WhatsApp-Ready Report Formatting (differentiator)
    └──requires──> Automated Recurring Report Generation

Multi-Client Overview Dashboard
    └──requires──> Campaign/Account Status Monitoring
    └──requires──> Budget-Low Alerts
    └──requires──> Contract Renewal Alerts
    └──requires──> Financial Layer

Contract Alerts Carrying MRR-at-Risk Context (differentiator)
    └──requires──> Contract Renewal Alerts
    └──requires──> Financial Layer

Multi-User Access ──enhances──> all of the above (not a hard dependency, but should exist before real team rollout)

In-Tool Campaign Optimization ──conflicts──> "visibility-only" positioning (explicit anti-feature, deliberately excluded)
Client-Facing Portal ──conflicts──> v1 internal-only scope (explicit anti-feature, deliberately excluded)
```

### Dependency Notes

- **Client/Contract Module and Ad Platform Data Pull are both foundational and can be built in parallel** — they don't depend on each other, which is useful for phase sequencing (one phase per data source, converging later).
- **Budget alerts and Contract alerts both depend on the Client Module** for per-client configuration (thresholds; renewal dates) — the Client Module should land before or alongside the first alerting feature, not after.
- **The Multi-Client Overview Dashboard is a rollup, not a standalone feature** — it depends on nearly everything else existing first. It should be one of the last phases, or built incrementally as each underlying feature ships (partial dashboard early, complete later).
- **Report Segmentation by Client Objective depends on basic report generation existing first** — don't build the differentiator (vertical-aware templates) before the table-stakes version (generic automated report) works end-to-end with real data.
- **Financial Layer deriving from Contract Module, not a separate ledger** — this is a deliberate architecture choice validated by research (Productive.io pattern): avoid letting MRR become a manually re-entered number that drifts from the contract records.
- **In-tool optimization and client portal are flagged as conflicts, not just deferred** — they represent a scope expansion beyond "visibility for the internal team," which is the stated core value. Building them would work against the "why" of this project, not just add extra work.

## MVP Definition

### Launch With (v1)

Matches PROJECT.md's Active requirements almost exactly — this alignment is a good sign the requirements are already appropriately scoped.

- [ ] Client/Contract module (client record, objective/vertical, contract dates, values) — foundational data model everything else depends on
- [ ] Meta Ads + Google Ads API data pull (account status, budget, campaigns) — core data source, no reporting or alerting works without it
- [ ] Multi-client overview dashboard — the "one place to see everything" value prop named as core value
- [ ] Per-client paid traffic panel (account status, budget remaining, active/paused campaigns) — direct replacement for daily manual account review
- [ ] Campaign/creative performance view — needed to answer "what's working vs. not" per client
- [ ] Budget-low alerts, per-client configurable threshold — prevents the "descobrir tarde demais" failure mode for spend
- [ ] Contract renewal alerts — prevents the same failure mode for contracts
- [ ] Automated weekly report generation, segmented by client objective, copy/paste/WhatsApp-ready format — the actual differentiator, and the biggest current time sink to eliminate
- [ ] Financial layer: billing dates, revenue, MRR (derived from contract module) — explicitly confirmed as v1, not deferred
- [ ] Multi-user internal access — needed as soon as more than one person uses the tool

### Add After Validation (v1.x)

- [ ] Contract alerts carrying MRR-at-risk context (combine date + revenue in one alert) — trigger: once both contract alerts and financial layer are stable, this is a small addition with outsized clarity gain
- [ ] Tiered alert timing (90/60/30-day contract reminders, % and absolute budget thresholds) — trigger: once basic single-point alerts prove the concept, refine timing/granularity based on real usage
- [ ] Additional ad platforms (TikTok Ads, LinkedIn Ads) — trigger: when a client requires a platform beyond Meta/Google (PROJECT.md already flags this as likely)
- [ ] WhatsApp Business API auto-send — trigger: only after the copy/paste workflow is proven and the team explicitly wants to remove the manual send step
- [ ] Basic anomaly flagging (e.g., "this metric moved more than X% week over week") — trigger: once historical data accumulates enough to make comparisons meaningful

### Future Consideration (v2+)

- [ ] Client-facing portal — defer until there's validated demand from clients wanting self-serve access, not just "competitors have it"
- [ ] Automated billing/invoicing/payment processing — defer until financial visibility alone proves insufficient and the team wants to consolidate billing itself into the tool
- [ ] AI-powered insights/predictive analytics — defer until data volume and team scale justify the complexity over simple threshold rules
- [ ] Decision on ClickUp replacement (project/task management) — explicitly deferred in PROJECT.md pending core validation; would be a significant scope expansion (task management is a different product category)
- [ ] In-tool campaign optimization actions — only reconsider if the team explicitly decides visibility-only is insufficient, and even then treat as a separate, carefully-scoped effort given the write-access risk

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Client/Contract module | HIGH | LOW | P1 |
| Meta Ads + Google Ads data pull | HIGH | HIGH | P1 |
| Multi-client overview dashboard | HIGH | MEDIUM | P1 |
| Per-client traffic panel (status, budget, campaigns) | HIGH | MEDIUM | P1 |
| Budget-low alerts (configurable threshold) | HIGH | MEDIUM | P1 |
| Contract renewal alerts | HIGH | LOW-MEDIUM | P1 |
| Automated weekly report generation (WhatsApp-ready) | HIGH | HIGH | P1 |
| Report segmentation by client objective | HIGH | MEDIUM-HIGH | P1 |
| Financial layer (MRR, billing dates, revenue) | HIGH | LOW-MEDIUM | P1 |
| Multi-user access | MEDIUM | LOW | P1 |
| Campaign/creative performance view | MEDIUM-HIGH | MEDIUM | P1 |
| Contract alerts with MRR-at-risk context | MEDIUM | LOW | P2 |
| Tiered alert timing (90/60/30 days) | MEDIUM | LOW | P2 |
| Additional ad platforms (TikTok, LinkedIn) | LOW-MEDIUM | MEDIUM | P2 |
| Basic anomaly/trend flagging | MEDIUM | MEDIUM | P2 |
| WhatsApp Business API auto-send | LOW-MEDIUM | HIGH | P3 |
| Client-facing portal | LOW (unvalidated) | HIGH | P3 |
| Billing/invoicing automation | LOW (unvalidated) | HIGH | P3 |
| AI-powered insights | LOW (unvalidated at this scale) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | AgencyAnalytics / Swydo (global reporting tools) | Reportei / Metrifiquei / GT Report (BR gestor-de-tráfego tools) | Productive.io / Scoro (PSA/ops platforms) | Sistema JSR Approach |
|---------|--------------------------------------------------|-------------------------------------------------------------------|--------------------------------------------|-----------------------|
| Ad data source coverage | 32-85+ integrations across SEO/PPC/social/email | Meta Ads + Google Ads focused, some multi-channel | None (not their category) | Meta Ads + Google Ads only at v1, matching actual need |
| Report delivery format | Branded client portal + scheduled PDF/email | WhatsApp-ready formatted content (Metrifiquei/GT Report), portal (Reportei) | Not applicable | Copy/paste WhatsApp-ready content, matching current BR workflow |
| Report segmentation logic | By marketing channel (SEO/PPC/Social templates) | By marketing channel; some AI-written narrative overlay | Not applicable | By client business objective/vertical (e-commerce, local, infoproduto) — a gap in the market |
| Budget/spend alerts | Threshold-based (%/absolute), email/Slack delivery | Limited/not a primary feature | Not their category | Threshold-based, per-client configurable, in-app delivery |
| Contract/renewal tracking | Not offered (different category) | Not offered | Native, tied to revenue-at-risk (Productive) | Dedicated module with dates, values, tiered alerts |
| Financial/MRR tracking | Not offered | Not offered | Native, derived from contract/project records | Derived from contract module, not a separate ledger |
| Client-facing access | Core feature (white-label portal) | Portal (Reportei) or direct-send (Metrifiquei/GT Report) | Client portal for approvals/invoices | None at v1 — internal only, explicit anti-feature for now |
| Campaign optimization actions | Not offered (visibility only) | Not offered | Not applicable | Not offered — explicit anti-feature, stays in native ad managers |
| Multi-user/team access | Yes, unlimited on most plans | Varies by tool | Yes, core to PSA category | Yes, basic internal multi-user at v1, no complex roles needed |

## Sources

- [AgencyAnalytics — Features](https://agencyanalytics.com/features) — global reporting tool feature set, data source breadth, portal model
- [AgencyAnalytics — Smart Dashboards](https://agencyanalytics.com/features/smart-dashboards) — automated report/dashboard pattern
- [Agency Reporting Automation: 11 Best Tools & Platforms (2026 Buyers Guide) — Improvado](https://improvado.io/blog/agency-reporting-automation)
- [Swydo — Client Monitoring and Alerting](https://www.swydo.com/features/monitoring/) — threshold-based alert pattern, daily checks
- [Swydo — Best PPC Reporting Tools 2026](https://www.swydo.com/blog/best-ppc-reporting-tools/)
- [Reportei — Relatório para gestão de tráfego pago](https://reportei.com/relatorio-para-gestao-de-trafego-pago/) — BR-market report template/customization patterns
- [Reportei — Como criar relatórios de marketing automatizados](https://reportei.com/como-criar-relatorios-de-marketing-automatizados/)
- [Metrifiquei — Relatórios de tráfego automático pelo WhatsApp](https://metrifiquei.com.br/) — WhatsApp-native delivery pattern validating PROJECT.md approach
- [GT Report — O Relatório Padrão Premium do Gestor de Tráfego Pago](https://eusamuelc.com.br/gtreport/) — BR gestor-de-tráfego automated reporting via Google/Meta Ads
- [US Tech Automations — Renewal Reminder Tools for Agencies 2026](https://ustechautomations.com/resources/blog/automate-best-renewal-reminder-software-for-marketing-agencies-2026) — contract alert timing best practices (90/60/30 day tiers), Productive.io's revenue-at-risk pattern
- [Zluri — Top Contract Renewal Management Software 2026](https://www.zluri.com/blog/contract-renewal-management-software)
- [Oneflow — Contract renewal management software 2026](https://oneflow.com/blog/contract-renewal-management-software/)
- [n8n — Meta Ads Low Balance Alert workflow template](https://n8n.io/workflows/3695-meta-ads-low-balance-alert-auto-notification-via-whatsapp-or-email/) — threshold-based low-balance alert pattern
- [Acuto — Google Ads Daily Budget Overdelivery Alert Script](https://acuto.io/blog/budget-overdelivery-alert-script/)
- [Syntermedia — Meta Ads Automation Software: 7 Tools Compared 2026](https://syntermedia.ai/blog/meta-ads-automation-software) — Revealbot rule-based automation category (pause/scale actions), used to justify anti-feature boundary
- [Markifact — Google & Meta Ads Budget Pacing Monitor](https://www.markifact.com/templates/google-meta-ads-budget-pacing-monitor)
- [Productive.io — Agency Management & PSA Software](https://productive.io/) — financial/MRR-derived-from-contract pattern
- [Scoro — 30 Tools for Agencies Looking to Scale](https://www.scoro.com/blog/agency-tools/) — PSA feature breadth (CRM+finance+project combined)
- [QuantLedger — Best MRR Tracking Software for SaaS Startups](https://www.quantledger.app/blog/best-mrr-tracking-software) — used to establish that dedicated SaaS MRR tools are overkill for this project's scale
- [Reportei — Relatório de tráfego pago: quais métricas analisar?](https://reportei.com/relatorio-de-trafego-pago/) — CPC/CTR/CPA/ROAS metric definitions and use by business goal
- [LAB137 — ROI, ROAS, CPA, CTR: métricas essenciais do tráfego pago](https://lab137.com.br/trafego-pago/roi-roas-cpa-ctr-entenda-as-metricas-essenciais-do-trafego-pago-de-uma-vez/)

---
*Feature research for: Agency operations / paid-traffic client reporting platform (internal tool)*
*Researched: 2026-07-10*
