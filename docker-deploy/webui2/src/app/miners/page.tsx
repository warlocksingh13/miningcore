'use client';

import Link from "next/link";
import { useMemo } from "react";
import MinerLookupPanel from "../components/MinerLookupPanel";
import { usePoolsData } from "../hooks/usePoolsData";
import type { Pool } from "../types/miningcore";

const formatHashrate = (value?: number) => {
  if (!value || value <= 0) return "—";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s"];
  const index = Math.min(Math.floor(Math.log10(value) / 3), units.length - 1);
  const scaled = value / Math.pow(10, index * 3);
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${units[index]}`;
};

const minerSummary = (pools: Pool[]) => {
  const miners = pools.reduce((acc, pool) => acc + (pool.poolStats?.connectedMiners ?? 0), 0);
  const workers = pools.reduce((acc, pool) => acc + (pool.topMiners?.length ?? 0), 0);
  const hashrate = pools.reduce((acc, pool) => acc + (pool.poolStats?.poolHashrate ?? 0), 0);
  return { miners, workers, hashrate };
};

export default function MinersPage() {
  const { pools } = usePoolsData();
  const summary = useMemo(() => minerSummary(pools), [pools]);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-800/60 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.25),_transparent_60%)] p-8">
        <div className="max-w-4xl">
          <p className="text-xs uppercase tracking-[0.34em] text-emerald-200">Miner operations</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Stay ahead of stale shares and payout surprises</h1>
          <p className="mt-4 text-sm text-slate-200 sm:text-base">
            Centralize monitoring for every worker. Instantly inspect wallet balance, worker uptime, share quality, and payout
            history without leaving the browser.
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="text-xs uppercase tracking-widest text-emerald-200">Active miners</p>
            <p className="mt-2 text-2xl font-semibold">{summary.miners}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="text-xs uppercase tracking-widest text-emerald-200">Reported hashrate</p>
            <p className="mt-2 text-2xl font-semibold">{formatHashrate(summary.hashrate)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="text-xs uppercase tracking-widest text-emerald-200">Workers in leaderboard</p>
            <p className="mt-2 text-2xl font-semibold">{summary.workers}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">What you can see</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-400">
            <li>• Wallet-level KPIs: hashrate, shares per second, pending balance, payout totals.</li>
            <li>• Per-worker drilldowns including status, stale rates, last share timestamp, and hashrate trends.</li>
            <li>• Automatic offline alerts (coming soon) plus exportable payout history for bookkeeping.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">Best practices</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-400">
            <li>• Keep worker names consistent; the UI groups stats per worker key for accurate graphs.</li>
            <li>• Use the latency checker on the Connect page to ensure your ASICs hit the lowest RTT endpoint.</li>
            <li>• Bookmark this page with your wallet query appended for one-click status checks.</li>
          </ul>
          <Link
            href="/connect"
            className="mt-5 inline-flex items-center justify-center rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
          >
            Check connection guide
          </Link>
        </div>
      </section>

      <MinerLookupPanel />
    </div>
  );
}
