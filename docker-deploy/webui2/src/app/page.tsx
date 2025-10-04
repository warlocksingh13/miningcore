"use client";

import Link from "next/link";
import { useMemo } from "react";
import PoolsOverview from "./components/PoolsOverview";
import StratumLatencyPanel from "./components/StratumLatencyPanel";
import MinerLookupPanel from "./components/MinerLookupPanel";
import { usePoolsData } from "./hooks/usePoolsData";
import type { Pool } from "./types/miningcore";

const formatHashrate = (value?: number) => {
  if (!value || value <= 0) return "—";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s"];
  const index = Math.min(Math.floor(Math.log10(value) / 3), units.length - 1);
  const scaled = value / Math.pow(10, index * 3);
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${units[index]}`;
};

const formatNumber = (value?: number, digits = 0) => {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const deriveTotals = (pools: Pool[]) => {
  const aggregateHashrate = pools.reduce((acc, pool) => acc + (pool.poolStats?.poolHashrate ?? 0), 0);
  const aggregateMiners = pools.reduce((acc, pool) => acc + (pool.poolStats?.connectedMiners ?? 0), 0);
  const totalPaid = pools.reduce((acc, pool) => acc + (pool.totalPaid ?? pool.poolStats?.totalPaid ?? 0), 0);

  return {
    aggregateHashrate,
    aggregateMiners,
    totalPaid,
    poolCount: pools.length,
  };
};

export default function HomePage() {
  const { pools, loading, error, lastUpdated } = usePoolsData();
  const totals = useMemo(() => deriveTotals(pools), [pools]);

  return (
    <div className="bg-neutral-950 text-neutral-200">
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-neutral-800 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_60%)] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.34em] text-neutral-400">Mining dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Monitor every pool at a glance.</h1>
              <p className="mt-4 text-sm text-neutral-300 sm:text-base">
                Live hashrate, miners, payouts, and latency across the entire Miningcore stack. Drill into any pool or search
                for a wallet without leaving the page.
              </p>
              <p className="mt-4 text-xs text-neutral-500">
                {loading
                  ? "Refreshing telemetry…"
                  : error
                    ? error
                    : lastUpdated
                      ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
                      : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <p className="text-xs uppercase tracking-[0.32em]">Combined totals</p>
              <div className="mt-3 grid gap-2 text-sm text-neutral-100">
                <p>
                  <span className="text-neutral-400">Pools online:</span> {totals.poolCount}
                </p>
                <p>
                  <span className="text-neutral-400">Aggregate hashrate:</span> {formatHashrate(totals.aggregateHashrate)}
                </p>
                <p>
                  <span className="text-neutral-400">Connected miners:</span> {formatNumber(totals.aggregateMiners)}
                </p>
                <p>
                  <span className="text-neutral-400">Total paid out:</span>{" "}
                  {totals.totalPaid
                    ? totals.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 6 })
                    : "—"}
                </p>
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.32em] text-emerald-200/70">Aggregated across every pool</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/pools/bch"
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-neutral-100 transition hover:border-emerald-500/60 hover:text-white"
            >
              View pool dashboard
            </Link>
            <Link
              href="/connect"
              className="rounded-xl border border-neutral-700 bg-black/60 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-cyan-500/60 hover:text-white"
            >
              Connection guide
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-6">
          <PoolsOverview />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <MinerLookupPanel />
          <StratumLatencyPanel pools={pools} defaultHost={process.env.NEXT_PUBLIC_STRATUM_HOST || '192.168.2.100'} />
        </section>
      </div>
    </div>
  );
}
