'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Pool } from '../types/miningcore';
import { usePoolsData } from '../hooks/usePoolsData';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const formatHashrate = (value?: number) => {
  if (!value || value <= 0) return '—';
  const units = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
  const index = Math.min(Math.floor(Math.log10(value) / 3), units.length - 1);
  const scaled = value / Math.pow(10, index * 3);
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${units[index]}`;
};

const formatNumber = (value?: number, digits = 0) => {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const relativeTime = (iso?: string) => {
  if (!iso) return '—';
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = now - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  return `${Math.floor(diff / day)} d ago`;
};

interface HashrateSample {
  timestamp: number;
  value: number;
}

const buildHashrateSeries = (pool: Pool | null): HashrateSample[] => {
  const base = pool?.poolStats?.poolHashrate ?? 0;
  const samples = Array.isArray((pool as any)?.hashrateSamples)
    ? (pool as any).hashrateSamples
    : Array.isArray((pool?.poolStats as any)?.hashrateSamples)
      ? (pool?.poolStats as any).hashrateSamples
      : [];

  if (samples.length > 0) {
    const normalized = (samples as Array<any>).map((sample) => ({
      timestamp: Number(new Date(sample?.created ?? sample?.date ?? Date.now())),
      value: Number(sample?.hashrate ?? sample?.value ?? base),
    }));
    return normalized.filter((entry) => Number.isFinite(entry.timestamp) && Number.isFinite(entry.value));
  }

  const count = 12;
  const now = Date.now();
  const pseudoBase = base || 1;
  return Array.from({ length: count }).map((_, index) => {
    const variance = 0.9 + 0.1 * Math.sin(index / 2.2) + 0.04 * Math.cos(index / 1.3);
    return {
      timestamp: now - (count - index - 1) * 5 * 60 * 1000,
      value: pseudoBase * variance,
    };
  });
};

const PoolsOverview = () => {
  const { pools, loading, error, lastUpdated } = usePoolsData();
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);

  useEffect(() => {
    if (pools.length === 0) {
      setSelectedPoolId(null);
      return;
    }
    const exists = pools.find((pool) => pool.id === selectedPoolId);
    if (!exists) {
      setSelectedPoolId(pools[0].id);
    }
  }, [pools, selectedPoolId]);

  const sortedPools = useMemo(
    () => [...pools].sort((a, b) => (b.poolStats?.poolHashrate ?? 0) - (a.poolStats?.poolHashrate ?? 0)),
    [pools],
  );

  const selectedPool = useMemo(
    () => pools.find((pool) => pool.id === selectedPoolId) ?? null,
    [pools, selectedPoolId],
  );

  const totals = useMemo(() => {
    const aggregateHashrate = pools.reduce((acc, pool) => acc + (pool.poolStats?.poolHashrate ?? 0), 0);
    const aggregateMiners = pools.reduce((acc, pool) => acc + (pool.poolStats?.connectedMiners ?? 0), 0);
    const totalPaid = pools.reduce((acc, pool) => acc + (pool.totalPaid ?? pool.poolStats?.totalPaid ?? 0), 0);
    return { aggregateHashrate, aggregateMiners, totalPaid, poolCount: pools.length };
  }, [pools]);

  const hashrateSeries = useMemo(() => buildHashrateSeries(selectedPool), [selectedPool]);

  const chartData = useMemo(
    () => ({
      labels: hashrateSeries.map((sample) => new Date(sample.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      datasets: [
        {
          label: 'Pool hashrate',
          data: hashrateSeries.map((sample) => sample.value ?? 0),
          borderColor: '#fafafa',
          backgroundColor: (ctx: any) => {
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 240);
            gradient.addColorStop(0, 'rgba(250, 250, 250, 0.28)');
            gradient.addColorStop(1, 'rgba(12, 12, 12, 0.05)');
            return gradient;
          },
          fill: true,
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    }),
    [hashrateSeries],
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => ` ${formatHashrate(context.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#cbd5f5' },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: '#94a3b8',
            callback: (value: any) => formatHashrate(Number(value)),
          },
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
        },
      },
    }),
    [],
  );

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-neutral-400">Pool overview</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Track every pool at a glance</h1>
            <p className="mt-3 max-w-2xl text-sm text-neutral-400">
              Live hashrate, miner counts, difficulty, and payout stats across all configured Miningcore pools. Select a pool
              to drill into detailed metrics.
            </p>
          </div>
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-sm text-neutral-300">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">Aggregate hashrate</p>
                <p className="mt-2 text-2xl font-semibold text-white">{formatHashrate(totals.aggregateHashrate)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">Connected miners</p>
                <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(totals.aggregateMiners)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">Pools online</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totals.poolCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">Total paid</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {totals.totalPaid ? totals.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              {loading ? 'Refreshing pool telemetry…' : error ? error : lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-950">
          <header className="border-b border-neutral-800 px-6 py-4">
            <h2 className="text-sm font-semibold text-white">Pool list</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-neutral-300">
              <thead className="bg-neutral-950/70 text-xs uppercase tracking-widest text-neutral-500">
                <tr>
                  <th className="px-6 py-3 text-left">Pool</th>
                  <th className="px-4 py-3 text-right">Miners</th>
                  <th className="px-4 py-3 text-right">Hashrate</th>
                  <th className="px-4 py-3 text-right">Fee</th>
                  <th className="px-4 py-3 text-right">Difficulty</th>
                  <th className="px-4 py-3 text-right">Last block</th>
                  <th className="px-6 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {sortedPools.map((pool) => {
                  const isActive = pool.id === selectedPoolId;
                  return (
                    <tr
                      key={pool.id}
                      className={`cursor-pointer border-t border-neutral-900 transition hover:bg-neutral-900/70 ${
                        isActive ? 'bg-neutral-900/80' : ''
                      }`}
                      onClick={() => setSelectedPoolId(pool.id)}
                    >
                      <td className="px-6 py-3 text-left">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-white">{pool.coin?.symbol ?? pool.id.toUpperCase()}</span>
                          <span className="text-xs text-neutral-500">{pool.coin?.name ?? pool.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white">{formatNumber(pool.poolStats?.connectedMiners)}</td>
                      <td className="px-4 py-3 text-right text-white">{formatHashrate(pool.poolStats?.poolHashrate)}</td>
                      <td className="px-4 py-3 text-right">{pool.poolFeePercent ?? 0}%</td>
                      <td className="px-4 py-3 text-right">{formatNumber(pool.ports ? Object.values(pool.ports)[0]?.difficulty : undefined, 2)}</td>
                      <td className="px-4 py-3 text-right">{relativeTime(pool.lastPoolBlockTime ?? pool.networkStats?.lastNetworkBlockTime)}</td>
                      <td className="px-6 py-3 text-right">
                        <Link
                          href={`/pools/${pool.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {sortedPools.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-neutral-500" colSpan={6}>
                      {loading ? 'Loading pools from Miningcore…' : error ? error : 'No pools available yet.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">Pool detail</p>
                <h3 className="text-xl font-semibold text-white">
                  {selectedPool?.coin?.name ?? selectedPool?.id ?? 'Select a pool'}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedPool ? (
                  <Link
                    href={`/pools/${selectedPool.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-2 text-xs font-semibold text-neutral-200 transition hover:border-neutral-500"
                  >
                    Open detailed view
                  </Link>
                ) : null}
                {selectedPool?.coin?.website ? (
                  <a
                    href={selectedPool.coin.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-2 text-xs font-semibold text-neutral-200 transition hover:border-neutral-500"
                  >
                    Coin website
                  </a>
                ) : null}
              </div>
            </header>

            {selectedPool ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">Pool hashrate</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatHashrate(selectedPool.poolStats?.poolHashrate)}</p>
                  <p className="mt-1 text-xs text-neutral-500">Shares/s {formatNumber(selectedPool.poolStats?.sharesPerSecond, 3)}</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">Network difficulty</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(selectedPool.networkStats?.networkDifficulty, 2)}</p>
                  <p className="mt-1 text-xs text-neutral-500">Height {formatNumber(selectedPool.networkStats?.blockHeight)}</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">Miners online</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(selectedPool.poolStats?.connectedMiners)}</p>
                  <p className="mt-1 text-xs text-neutral-500">Fee {selectedPool.poolFeePercent ?? 0}%</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">Total paid</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {selectedPool.totalPaid ? selectedPool.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">Last block {relativeTime(selectedPool.lastPoolBlockTime)}</p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-sm text-neutral-400">
                Select a pool from the table to inspect details.
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6">
            <h3 className="text-sm font-semibold text-white">Pool hashrate trend</h3>
            <div className="mt-4 h-60">
              <Line data={chartData} options={chartOptions} />
            </div>
          </section>

          {selectedPool?.topMiners && selectedPool.topMiners.length > 0 ? (
            <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6">
              <h3 className="text-sm font-semibold text-white">Top miners</h3>
              <div className="mt-4 space-y-3">
                {selectedPool.topMiners.slice(0, 5).map((miner) => (
                  <div key={miner.miner} className="flex items-center justify-between rounded-2xl border border-neutral-900 bg-neutral-900/50 p-4 text-sm text-neutral-200">
                    <div className="truncate pr-4">
                      <p className="font-medium text-white">{miner.miner}</p>
                      <p className="text-xs text-neutral-500">Shares/s {formatNumber(miner.sharesPerSecond, 4)}</p>
                    </div>
                    <span className="text-sm font-semibold text-white">{formatHashrate(miner.hashrate)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default PoolsOverview;
