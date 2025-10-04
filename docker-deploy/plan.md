# Mining Pool Plan

## Agent Bootstrap (READ FIRST)
- Always open this file first and read “Master Rules”.
- Treat this file as source of truth for goals, config paths, and next steps.
- On any change (compose, configs, images, ports, policies), immediately update this file.
- If a session is restarted or chat resets, re‑read this section before acting.
- Quick status checklist on start: `docker ps`, Miningcore logs (last 200 lines), `GET http://192.168.2.100:4000/api/pools`.

## Goals
- Enable OCTA mining through Miningcore with stable, accepted shares.
- Keep Jasminer miners in Getwork/Ethproxy mode (preferred), while Miningcore speaks Ethereum Stratum v1 upstream.
- Maintain BCH pool as-is; do not resync nodes; keep data directories intact.
- Keep setup organized under `CascadeProjects/data` with clear ownership per service.
- Maintain per-miner attribution by keeping one upstream Miningcore session per miner.

## Master Rules
- On every new session: read this plan’s “Agent Bootstrap” and “Master Rules” before any action.
- Do not touch or resync coin node data under `data/coins/*`.
- All config is source-of-truth under service folders (e.g., `data/miningcore/config/`).
- Back up before structural changes to compose or configs (use `data/backup/TS`).
- Keep logs persistent under `data/logs/*`; avoid writing inside containers.
- Prefer minimal, observable changes; verify with logs and API after each step.
- Record all changes directly in this file (plan.md) so it remains the single source of truth.
- Coin data layout: Always store every coin’s node data (datadir, chain DB, wallets/keys, DAGs, and any on-disk logs) under `./coins/<coin>/...` and mount only those folders into containers. No absolute paths; use workspace‑relative paths in compose.
  - Examples: BTC `./coins/btc`, BCH `./coins/bch`, OCTA `./coins/octa` (DAG at `./coins/octa/ethash`), ETC `./coins/etc`, ALPH `./coins/alph/...`.
  - If node supports file logging, direct logs to its coin folder; otherwise keep stdout logging (Dozzle) as default.

## Current State (Sep 15)
- Miningcore: BCH live; OCTA pool configured; Stratum v1 on 5008/5108; jobs broadcasting.
- OCTA node: synced; `eth_getWork` enabled and serving templates to Miningcore.
- Ethproxy bridge: running on 4444 with per‑miner upstream sessions; enforces upstream `eth_submitLogin` before `eth_getWork/eth_submitWork`; queues getWork until login confirmed; reconnect-safe.
- Compose: bridge upstream points to OCTA low‑diff port 5108 to force early share acceptance during validation.
- Validation: pending field test with Jasminer pointed to 4444.

## Status Summary (Today)
- miningcore: Switched to getwork-enabled fork (blackmennewstyle) built locally; API http://192.168.2.100:4000; OCTA stratum 5008/5108 accept getwork (eth_getWork) when enabled in config.
- nginx: Up; serves plan auto-index only (decision tree UI retired).
- dozzle: Up at http://192.168.2.100:8080/ for logs.
- Proxies removed: ethproxy-bridge and eth-stratum-proxy removed to simplify path; miners connect directly to miningcore 5108.
- octa-node: Updated NAT and UDP mapping (38000/udp) to improve peer discovery; advertising extip 192.168.2.100.
- octa-node: Tuned gas controls: `--gpo.maxprice=1000000000` (1 gwei cap for GPO) and `--rpc.gascap=21000000000` (RPC gas cap) for stability.
- etc-node: Removed from the compose stack for now; existing chain data left intact in case we revisit ETC later.
- decisions UI: removed; static pages and helper API dropped — record decisions here in plan.md.
- monitoring: Grafana now provisions a "Miningcore Overview" dashboard (Prometheus-backed) for pool, RPC, and database health.
- miningcore: metrics /metrics whitelist expanded to host + docker bridge addresses so Prometheus can scrape without 403s.
 - octa push updates: Enabled WebSocket on octa-node (8546) and configured Miningcore to subscribe to newHeads. Goal: reduce stale/unaccepted shares by pushing jobs instead of pure polling.
- api: CORS allowedOrigins expanded to include `http://192.168.2.100` and `:5000`; endpoint `/api/pools` verified OK on port 4000. webui2 now points to `http://192.168.2.100:4000`.
- webui2: Pool detail page reworked to match SmartPoolMining layout (hero summary with coin logos, single-row nav/external shortcuts, stat cards focused on pool metrics incl. fee/effort/avg block time, network info card in metrics column); removed legacy revenue calculator, quick actions card, pool information card, network hashrate card, inline pool address, added crosshair hover tracking, rebuilt container, moved the pool wallet + explorer link into the hero action row (no more Start Mining CTA), dropped the in-page Performance/Blocks/Payments/Servers chips from the hero bar, replaced the block explorer link with blockchain.com’s BCH explorer, removed the duplicate wallet capsule under the hero links, collapsed the hero links into the main BCH panel (no nested border), made the Blocks Found / Total Rewards cards clickable (pending-block + payments shortcuts, last block text), stripped the “Updated HH:MM” timestamp from the header, and redirected `/pools` straight to the default pool (BCH) instead of rendering the old list view.
- webui2: Pool hero card now features an enlarged coin logo, slimmer typography, hero miner lookup, and compact external-link pills, with carousel badges showing coin logos and relocated search for quicker switching; mining mode badge removed to avoid layout regressions.
- webui2: Connection endpoints consolidated into one latency-ranked table with interactive server + per-port radios, latency badges, and inline copy actions; network card lists price & 24h change badges at the bottom; hero external links pinned right; pool carousel search prompt explicitly targets pools/coins; homepage hero highlights combined pool totals for first-time visitors.
- miningcore: SHA256 pools expose three VarDiff tiers (0.25M-1M, 1M-10M, 10M-50M) with clearer port labels matching SoloPool-style guidance; kept NerdMiner micro-tier unaffected.
- miningcore: SHA256 pools updated with industry-aligned VarDiff tiers (BTC/BCH PPLNS + SOLO) — low 16K/8K, mid 256K/128K, high 2M/1M bands — preserving NerdMiner tier; old OCTA tuning + DGB/ETC snapshot notes retained.
- digibyte: Switched to `theretromike/nodes:digibyte` image for richer peer defaults; reusing existing datadir with prune=550 and hash algo overrides.
- miningcore: restored valid `coins.json`, re-enabled Octa pool using `octaspace` coin profile, and confirmed the service stays online (stratum ports 8008/8018 reporting jobs).
- miningcore: restored valid `coins.json`, re-enabled Octa pool using `octaspace` coin profile, and confirmed the service stays online (stratum ports 8008/8018 reporting jobs).
- nginx: cleaned up compose volumes and configs after removing the decisions UI; restarted stack to apply changes.

- SHA-256 pools: Introduced 3-tier variable-difficulty ports (solopool-style) with clear labels. BTC PPLNS: `3333` (Low), `3355` (Medium), `3377` (High). BTC SOLO: `3433` (Low), `3455` (Medium), `3477` (High). BCH PPLNS: `5005` (Low), `5205` (Medium), `5305` (High). BCH SOLO: `5004` (Low), `5204` (Medium), `5304` (High). NerdMiner low-diff ports kept (`5104`, `5105`). No new docker-compose port mappings added yet; awaiting selection of which tiers to expose externally.

## Decision: Why/When to use Ultimate Proxy
- Ultimate Proxy is NOT a protocol translator from Ethproxy (getwork) to Ethereum Stratum v1 upstream (as used by Miningcore). It excels at farm features (bandwidth reduction, smart/ration switching, wallet switching, SSL), but it won’t solve the getwork→stratum translation on its own.
- For the sole purpose of accepting getwork miners into a Stratum v1 pool, a small dedicated translator (Ethproxy→Stratum v1) is sufficient and simpler.

References:
- Ultimate Proxy: https://github.com/romslf/Ultimate-Proxy
- Ether-Proxy (Getwork→Geth/HTTP or pool HTTP): https://github.com/sammy007/ether-proxy (good for node or HTTP pools; not Stratum v1 upstream)

## Architecture Options
1) Direct Stratum (no translator)
   - Jasminer in Stratum v1 → Miningcore:5008 → Miningcore payouts.
   - Pros: simplest; Cons: some ASICs throttle on Stratum v1.

2) Translator in front of Miningcore (recommended)
   - Jasminer (Ethproxy) → Translator (Ethproxy→Stratum v1) → Miningcore:5008/5108.
   - Pros: miners keep stable getwork; Miningcore payouts stay; can add per‑miner upstream sessions for proper attribution.
   - Cons: one extra component to maintain.

3) Ultimate Proxy (features) + Translator
   - Jasminer (Ethproxy) → Ultimate Proxy (farm features) → Translator → Miningcore.
   - Pros: adds farm features; Cons: extra hop/complexity.

4) Open Ethereum Pool (OEP)
   - Standalone ETC/OCTA pool stack with eth‑proxy compatibility.
   - Pros: mature; Cons: separate payouts/API/UI; diverges from Miningcore; unmaintained.

5) Miningcore native Ethproxy server (custom backend)
   - Implement Ethproxy/Getwork JSON‑RPC server inside Miningcore and wire to Ethereum job manager.
   - Pros: first‑class integration, no external translator; Cons: fork + engineering effort.

## Agreed Path (proposed)
Implement Option 2 first to achieve accepted shares with getwork miners while using Miningcore payouts:
- Add a lightweight Ethproxy→Stratum v1 bridge container listening on 4444. (done)
- Upgrade bridge to keep one upstream session per miner and enforce login gating. (done)
- Point bridge upstream to `miningcore:5108` temporarily (low‑diff) for fast validation; later switch to 5008.
- Point Jasminer to `stratum+tcp://192.168.2.100:4444` (Ethproxy) and validate “Share accepted”.

## Next Actions
1) Field test: point Jasminer directly to 5108; confirm login + “Share accepted”.
2) OCTA peers: monitor octa-node for stable peercount; official bootnodes added; if needed, append more via `OCTA_BOOTNODES`.
3) Harden bridge: add TLS, basic rate‑limits, metrics, and optional work caching.
4) Switch upstream to 5008 after validation; tune varDiff as needed.
5) Decide next branch: continue hardening gateway vs. start Miningcore native Ethproxy implementation (see Decision Log).

Commands (quick)
- Build new miningcore fork: `cd CascadeProjects/data && docker-compose up -d --build miningcore`
- Restart nginx after GUI edits: `cd CascadeProjects/data && docker-compose up -d nginx`

## Validation & Observability
- Miningcore API: `GET /api/pools` (OCTA stats populated).
- Logs: `data/logs/miningcore/octa.log` (connection, authorize, shares).
- Ports: 5008/5108 (Miningcore), 4444 (translator).
- Docs: plan.md (this file) is now the sole decision log; update after every change.
- Grafana dashboard: http://192.168.2.100:3001/d/miningcore-mon/miningcore-overview (default Prometheus datasource).

## Access URLs (192.168.2.100)
- Pool UI: http://192.168.2.100:3000/#octa/stats
- Logs (Dozzle): http://192.168.2.100:8080/
- Plan index: http://192.168.2.100/plan/
- Grafana: http://192.168.2.100:3001/d/miningcore-mon/miningcore-overview
- API (Pools): http://192.168.2.100:4000/api/pools
- Miner target: `stratum+tcp://192.168.2.100:4444`

## Questions / Requests Log
- Q1: Remove stray container 'thirsty_montalcini' → Done (removed).
- Q2: OCTA node cannot connect to peers → NAT fixed, UDP mapped; monitoring. Will add bootnodes if needed.
- Q3: Add ETC node → Done (core-geth on 8547, currently offline while stack focuses on SHA256 pools; data retained).
- Q4: Two trees on same page, center aligned, draggable → Done (Decisions + Q&A trees; pan/zoom + auto-fit).
- Q5: Gas price / RPC gas cap flags → Done (added to octa-node in compose).

## Open Questions
- Evaluate Kudaraidee/miningcore fork for native Alephium support and consider rebasing current fork once SHA256 pools are stable.
- Preferred translator implementation (Node/Go/Python) and feature set?
- Do we want Ultimate Proxy features later? If yes, chain after translator.
- Do we want BCH external ports mapped for remote miners?

## Risks
- Protocol edge cases (extranonce handling, idle timeouts) may need tuning.
- Additional hop adds minimal latency (<2ms on LAN).

## Done Definition
- Jasminer in getwork points to 4444.
- Miningcore logs show regular `Share accepted` for OCTA.
- Payout accounting appears for OCTA in Miningcore.

## Decision Log
- 2025-10-04: Retired decisions UI; consolidated documentation in plan.md.
- 2025-09-15: Choose Option 2 (Translator/Gateway in front of Miningcore) with per‑miner upstream sessions to preserve wallet attribution. Rationale: fastest path to stable getwork, retain Miningcore payouts/UI, minimal replatforming. Alternatives kept open: Option 5 (native Ethproxy in Miningcore) for long‑term cleanliness; Option 4 (OEP) only if we abandon Miningcore stack.
