# WebUI2 Plan

## Agent Bootstrap (READ FIRST)
- Read this plan and `../plan.md` before taking any action; keep both in sync.
- Confirm the local dev server state: `npm run dev` (port 3000) and Miningcore API (`http://192.168.2.100:4000/api/pools`).
- When this plan changes, mirror the update in `../plan.md` so both stay aligned.

## Goals
- Deliver a modern, responsive Miningcore web UI inspired by SmartPool Mining while retaining Miningcore payouts, multi-coin support, and observability.
- Provide real-time pool, network, and miner analytics for OCTA (first), then expand to BCH/other coins.
- Keep UX friction low for ASIC operators (quick connection info, payout visibility, alerts).

## Status Summary (2025-09-19)
- Navigation rebuilt to mirror SmartPool sections with dedicated pages for Overview, Pools, Miners, Connect, FAQ, and Support; home landing now mimics Kryptex layout with hero stats, atlas of pools, and Gotham-dark styling.
- Pools dashboard redesigned to WoolyPooly/SmartPool style: dedicated list + inline detail plus `/pools/[poolId]` deep-dive with performance, blocks, payments, miners, and external links.
- Pool detail page now includes Kryptex-inspired layout: header summary + three-column stats/start mining/calculator panel, latency tester, profitability badge, and hashrate calculator.
- Global palette shifted to black/neutral base with selective accent colors (emerald/amber/violet/cyan) for status and external chips.
- Data layer currently consumes `/api/pools` and attempts `/api/blocks`, `/api/payments`, `/api/miners/{pool}/{address}` with graceful fallbacks when endpoints are missing (enables SmartPoolMining API for demos).
- Stratum latency tester added via `/api/latency` TCP probe plus UI badges (emerald/amber/rose) and connection guide replicating SmartPool connect page.
- Tailwind-based theming and layout ready for further componentization (shadcn/ui integration still pending).
- Containerized build wired into compose; `webui2` service rebuilt and published on host port 5000 with `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_STRATUM_HOST` env overrides.
- Outstanding: replace synthetic hashrate sparkline with real samples, wire production Miningcore endpoints and WebSockets, add unit/component tests.

## Next Actions
- Backfill Miningcore `/api/blocks` and `/api/payments` responses so `/pools/[poolId]` renders live data instead of fallbacks.
- Add per-pool top-miner history and worker trend charts once hashrate series endpoints land.
- Layer in health badges (API, stratum, node) and incident banner to mirror SmartPool status rail.
- Extract color tokens into a theme config to make accent palette swaps easier.

## Reference UI Audit (SmartPoolMining + next-miningcore-ui)
- **Hero / Global Stats**: aggregate pool hash rate, miners online, workers online, network hash, difficulty, next payout countdown, fee banner.
- **Coin Switcher / Tabs**: per-coin overview with quick stats cards and sparklines (24h hash rate, luck, round progress).
- **Live Activity Rail**: scrolling block notifications (block height, reward, time to find, confirmations), payout events, orphan alerts.
- **Charts & Analytics**: pool hashrate vs. network, shares accepted/rejected, worker uptime heatmap, payout trends, luck distribution.
- **Miner Dashboard**: wallet lookup with summary KPIs, per-worker cards, real-time hashrate chart, stale rate, share submission timeline, payout history, earnings estimator.
- **How-To / Connection Panel**: region selector, stratum endpoints, sample miner configs, monitoring tips, FAQ.
- **Status & Reliability**: service health badges (stratum, API, DB), incident banner, latency probes.
- **Theme & PWA**: light/dark toggle, responsive layout, offline-friendly caching for static assets.

## Data & API Requirements
- Miningcore REST today exposes limited aggregates; we need:
  1. **Expanded Pool Metrics**: 1m/5m/24h averages for hashrate, shares, luck, orphan %, fee revenue.
  2. **Block Stream**: include status, reward breakdown, finder wallet, confirmations, uncle/orphan flag.
  3. **Payout Ledger**: timestamp, wallet, amount, tx hash, fee, payout scheme metadata.
  4. **Miner Snapshot**: total hashes, current payout balance, last share, per-worker stats with timestamps.
  5. **Timeseries**: per-worker and pool hashrate history (bucketed every N seconds) for charts.
  6. **System Health**: stratum connections, Redis backlog, node syncing state.
- Prefer push updates via WebSocket/SSE (new block, payout, worker offline). Fallback: short-poll + `If-None-Match`.
- Introduce an aggregation layer (`webui2-api`) to cache Miningcore data, compute deltas, and expose GraphQL/REST to the Next.js UI.

## Required Miningcore Changes (Proposed)
1. Add/extend API endpoints to expose block + payout metadata, worker timeseries, and pool health.
2. Surface varDiff parameters and round share totals for round-progress UI.
3. Emit WebSocket events (or allow Redis pub/sub hook) when shares, blocks, or payouts change.
4. Ensure CORS + rate limit settings allow `webui2` origin; provide API keys/tokens for miner-authenticated calls.
5. Optionally add synthetic endpoints for profitability calc (reward per GH/s) or deliver raw stats for UI to compute.

## Architecture & Tech Stack
- **Frontend**: Next.js (App Router), TypeScript, React Server Components where helpful.
- **UI Toolkit**: Tailwind CSS + shadcn/ui (SmartPool vibe), Radix UI primitives, Lucide icons.
- **Charts**: Recharts or ECharts (for multi-axis + animations); consider Tremor for quicker dashboards.
- **State/Data**: TanStack Query for client caching; Zustand for lightweight UI state; SWR fallback.
- **Realtime**: Native WebSocket client or SSE via EventSource; offline-friendly progressive updates.
- **Testing**: Vitest/RTL for components, Playwright for critical flows, Lighthouse for perf.
- **Tooling**: ESLint, Prettier, MSW for API mocks, Storybook for component dev (optional but recommended).
- **Dev Infra**: Dockerfile already present; add docker-compose override binding to local Miningcore API.

## Implementation Roadmap
1. **Scaffolding & Design System**
   - Install Tailwind/shadcn, theme tokens, typography.
   - Build base layout: navbar, footer, responsive grid, theming toggle, loading states.
2. **Data Layer Foundation**
   - Statically type Miningcore API responses; create API client SDK.
   - Create mock JSON fixtures + MSW handlers until backend endpoints land.
   - Stand up aggregator service (Next API routes or separate Node service) if direct Miningcore data insufficient.
3. **Pool Overview (MVP)**
   - Hero KPIs, live block ticker (polling), 24h hashrate chart, connection panel.
   - Integrate with actual Miningcore endpoints; handle empty states/failovers.
4. **Miner Lookup & Worker Details**
   - Wallet search + deep link, worker list with status chips, charts, payout ledger.
   - Notifications for stale/offline workers via WebSocket.
5. **Advanced Analytics**
   - Luck chart, efficiency trends, payout projections, incident status integration.
   - Add multi-coin support (tabs) once OCTA stable.
6. **Polish & Deploy**
   - Accessibility pass, SEO metadata, favicon set, error boundaries, skeleton loaders.
   - CI pipeline (lint/test/build) and production Docker image.

## Validation & Observability
- Smoke test checklist: load overview, wallet dashboard, blocks table within <2s on LAN.
- Metrics: capture Core Web Vitals, track API latency, ensure WebSocket reconnect logic.
- Build `npm run test`, `npm run lint`, `npm run typecheck`, `npm run e2e` targets; wire to CI.

## Dependencies & Integration Notes
- Miningcore API base: `http://192.168.2.100:4000`. Ensure reverse proxy (nginx) exposes `/api/*` with CORS for `http://192.168.2.100:3000`.
- Consider Redis or PostgreSQL read replica for analytics if Miningcore queries become heavy.
- Decision history now lives in `../plan.md`; capture UI milestones there after each release.

## Open Questions
- Do we centralize historical metrics in Postgres/Timescale outside Miningcore?
- Should miner auth rely on Miningcore JWT, signed nonce, or read-only wallet lookup?
- Need push notifications (email/Telegram) for offline workers? If yes, define pipeline now.

## Risks
- Miningcore endpoint gaps may block UI features until backend work completes.
- Real-time charts can be expensive; ensure downsampling/caching to avoid API overload.
- Maintaining two UI stacks (legacy + webui2) requires deployment coordination.

## References
- SmartPool Mining UI (Next.js) https://smartpoolmining.com/
- Next Miningcore UI demo https://next-miningcore-ui.vercel.app/
- Video walkthroughs: https://youtu.be/mXp_b68G4NA , https://youtu.be/31SWuMjT97c
- Legacy Miningcore UI (baseline for parity).
