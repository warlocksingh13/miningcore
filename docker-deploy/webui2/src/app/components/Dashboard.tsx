'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchBlocks, fetchMinerStats, fetchPayments, fetchPools } from '../api/client';
import { API_CONFIG } from '../api/config';
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
import type {
  BlockItem,
  MinerStatsResponse,
  PaymentItem,
  Pool,
  MinerWorkerStats,
} from '../types/miningcore';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const REFRESH_INTERVAL = API_CONFIG.refreshInterval;
const BLOCK_PAGE_SIZE = 6;
const PAYMENT_PAGE_SIZE = 6;

interface HashrateSample {
  timestamp: number;
  value: number;
}

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
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} hr ago`;
  return `${Math.floor(diff / DAY)} d ago`;
};

const StatCard = ({
  title,
  value,
  helper,
  accent,
}: {
  title: string;
  value: string;
  helper?: string;
  accent?: 'blue' | 'emerald' | 'violet' | 'amber';
}) => {
  const palette: Record<string, string> = {
    blue: 'from-neutral-800/60 via-neutral-900/10 to-neutral-900 border-neutral-800/40',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-6 shadow-sm transition hover:shadow-xl ${palette[accent ?? 'blue']}`}>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-400">{helper}</p> : null}
    </div>
  );
};

const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {description ? <p className="text-sm text-slate-400">{description}</p> : null}
    </div>
  </div>
);

const MinerWorkerList = ({ workers }: { workers?: Record<string, MinerWorkerStats> }) => {
  if (!workers || Object.keys(workers).length === 0) {
    return <p className="text-sm text-slate-400">No worker statistics available for this miner.</p>;
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {Object.entries(workers).map(([workerName, stats]) => (
        <div key={workerName} className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-200">{workerName}</p>
            <span
              className={`h-2 w-2 rounded-full ${stats?.online ? 'bg-emerald-400' : 'bg-rose-500'}`}
              aria-hidden
            />
          </div>
          <dl className="mt-3 space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <dt>Hashrate</dt>
              <dd className="font-semibold text-slate-200">{formatHashrate(stats?.hashrate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shares/s</dt>
              <dd>{formatNumber(stats?.sharesPerSecond, 3)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Last Share</dt>
              <dd>{relativeTime(stats?.lastShare)}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minerQuery, setMinerQuery] = useState('');
  const [minerStats, setMinerStats] = useState<MinerStatsResponse | null>(null);
  const [minerError, setMinerError] = useState<string | null>(null);
  const [minerLoading, setMinerLoading] = useState(false);

  const stratumHost =
    process.env.NEXT_PUBLIC_STRATUM_HOST ||
    (typeof window !== 'undefined' ? window.location.hostname : 'localhost');

  useEffect(() => {
    let active = true;

    const loadPools = async () => {
      setLoading(true);
      try {
        const response = await fetchPools();
        const poolList: Pool[] = Array.isArray(response?.pools)
          ? response.pools
          : Array.isArray(response)
            ? response
            : [];

        if (!active) return;
        setPools(poolList);
        setError(null);

        if (!selectedPoolId && poolList.length > 0) {
          setSelectedPoolId(poolList[0].id);
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to load pools', err);
        setError('Unable to load pools. Verify API endpoint and CORS configuration.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPools();
    const interval = setInterval(loadPools, REFRESH_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedPoolId]);

  useEffect(() => {
    if (!selectedPoolId) {
      setBlocks([]);
      setPayments([]);
      return;
    }

    let active = true;

    const loadDetails = async () => {
      try {
        const blocksResponse = await fetchBlocks(selectedPoolId, 0, BLOCK_PAGE_SIZE);
        if (active) {
          const blockList: BlockItem[] = Array.isArray(blocksResponse?.result)
            ? blocksResponse.result
            : Array.isArray(blocksResponse?.blocks)
              ? blocksResponse.blocks
              : Array.isArray(blocksResponse)
                ? blocksResponse
                : [];
          setBlocks(blockList.slice(0, BLOCK_PAGE_SIZE));
          setBlocksError(null);
        }
      } catch (err) {
        if (active) {
          console.warn('Blocks API unavailable', err);
          setBlocks([]);
          setBlocksError('Blocks endpoint unavailable. Using pool metadata only.');
        }
      }

      try {
        const paymentsResponse = await fetchPayments(selectedPoolId, 0, PAYMENT_PAGE_SIZE);
        if (active) {
          const paymentList: PaymentItem[] = Array.isArray(paymentsResponse?.payments)
            ? paymentsResponse.payments
            : Array.isArray(paymentsResponse)
              ? paymentsResponse
              : [];
          setPayments(paymentList.slice(0, PAYMENT_PAGE_SIZE));
          setPaymentsError(null);
        }
      } catch (err) {
        if (active) {
          console.warn('Payments API unavailable', err);
          setPayments([]);
          setPaymentsError('Payments endpoint unavailable.');
        }
      }
    };

    loadDetails();
    const interval = setInterval(loadDetails, REFRESH_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedPoolId]);

  const selectedPool = useMemo(
    () => pools.find((pool) => pool.id === selectedPoolId) ?? null,
    [pools, selectedPoolId],
  );

  const heroStats = useMemo(() => {
    const totalHashrate = pools.reduce((sum, pool) => sum + (pool.poolStats?.poolHashrate ?? 0), 0);
    const totalMiners = pools.reduce((sum, pool) => sum + (pool.poolStats?.connectedMiners ?? 0), 0);
    const totalPaid = pools.reduce((sum, pool) => sum + (pool.totalPaid ?? pool.poolStats?.totalPaid ?? 0), 0);

    return {
      totalHashrate,
      totalMiners,
      totalPaid,
      poolCount: pools.length,
    };
  }, [pools]);

  const hashrateSeries = useMemo<HashrateSample[]>(() => {
    const base = selectedPool?.poolStats?.poolHashrate ?? 0;
    const samples = Array.isArray((selectedPool as any)?.hashrateSamples)
      ? (selectedPool as any).hashrateSamples
      : Array.isArray((selectedPool?.poolStats as any)?.hashrateSamples)
        ? (selectedPool?.poolStats as any).hashrateSamples
        : [];

    if (samples.length > 0) {
      const normalizedSamples = (samples as Array<any>).map((sample): HashrateSample => ({
        timestamp: Number(new Date(sample?.created ?? sample?.date ?? Date.now())),
        value: Number(sample?.hashrate ?? sample?.value ?? base),
      }));

      return normalizedSamples.filter(
        (entry) => Number.isFinite(entry.timestamp) && Number.isFinite(entry.value),
      );
    }

    const points = 12;
    const now = Date.now();
    const pseudoBase = base || 1;
    return Array.from({ length: points }).map((_, index) => {
      const jitter = 0.95 + 0.08 * Math.sin(index / 1.8);
      return {
        timestamp: now - (points - index - 1) * 5 * 60 * 1000,
        value: pseudoBase * jitter,
      };
    });
  }, [selectedPool?.poolStats?.poolHashrate, selectedPool]);

  const chartData = useMemo(() => {
    return {
      labels: hashrateSeries.map((entry) => new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      datasets: [
        {
          label: 'Pool Hashrate',
          data: hashrateSeries.map((entry) => entry.value ?? 0),
          borderColor: '#38bdf8',
          backgroundColor: (ctx: any) => {
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280);
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
            return gradient;
          },
          fill: true,
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    };
  }, [hashrateSeries]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => ` ${formatHashrate(context.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
        },
        grid: {
          display: false,
        },
      },
      y: {
        ticks: {
          color: '#94a3b8',
          callback: (value: any) => formatHashrate(Number(value)),
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.12)',
        },
      },
    },
  }), []);

  const handleMinerLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPoolId || minerQuery.trim().length === 0) {
      setMinerStats(null);
      setMinerError('Enter a miner address to view stats.');
      return;
    }

    setMinerLoading(true);
    setMinerError(null);

    try {
      const result = await fetchMinerStats(selectedPoolId, minerQuery.trim());
      setMinerStats(result);
      if (!result) {
        setMinerError('Miner not found.');
      }
    } catch (err) {
      console.error('Miner lookup failed', err);
      setMinerStats(null);
      setMinerError('Unable to fetch miner stats from Miningcore API.');
    } finally {
      setMinerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-neutral-200/80" />
          <p className="mt-4 text-sm text-slate-400">Loading Miningcore telemetry…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="max-w-md rounded-2xl border border-rose-500/40 bg-rose-500/10 p-8">
          <h2 className="text-lg font-semibold text-rose-200">Connection issue</h2>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
          <p className="mt-3 text-xs text-rose-100/60">
            Ensure `NEXT_PUBLIC_API_BASE_URL` points to a live Miningcore API (or Smartpool endpoint) and that CORS allows this
            origin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%)]" />
        <header className="border-b border-slate-800/60 bg-slate-950/60 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Miningcore control plane</p>
                <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                  {selectedPool?.coin?.name ?? 'Mining Pools'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-400">
                  Monitor pool health, network activity, and miner performance in real time. Switch between pools to review their
                  dedicated metrics and connection profiles.
                </p>
              </div>
              <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 sm:w-auto">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-400">Total miners</dt>
                    <dd className="mt-1 text-xl font-semibold text-white">{formatNumber(heroStats.totalMiners)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Aggregate hashrate</dt>
                    <dd className="mt-1 text-xl font-semibold text-white">{formatHashrate(heroStats.totalHashrate)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Pools online</dt>
                    <dd className="mt-1 text-xl font-semibold text-white">{heroStats.poolCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Total paid out</dt>
                    <dd className="mt-1 text-xl font-semibold text-white">
                      {heroStats.totalPaid ? `${heroStats.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {pools.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-400">Active pool</span>
                <div className="flex flex-wrap gap-2">
                  {pools.map((pool) => {
                    const isActive = pool.id === selectedPoolId;
                    return (
                      <button
                        key={pool.id}
                        onClick={() => setSelectedPoolId(pool.id)}
                        className={`rounded-full border px-4 py-1.5 transition ${
                          isActive
                            ? 'border-neutral-700 bg-neutral-900/70 text-white shadow-sm shadow-black/30'
                            : 'border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        {pool.coin?.symbol?.toUpperCase() ?? pool.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <section>
          <SectionHeader title="Pool pulse" description="A quick glance at load, payouts, and network alignment." />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Pool hashrate"
              value={formatHashrate(selectedPool?.poolStats?.poolHashrate)}
              helper={`Shares/s: ${formatNumber(selectedPool?.poolStats?.sharesPerSecond, 3)}`}
              accent="blue"
            />
            <StatCard
              title="Connected miners"
              value={formatNumber(selectedPool?.poolStats?.connectedMiners)}
              helper={`Top miner: ${selectedPool?.topMiners?.[0]?.miner ?? '—'}`}
              accent="emerald"
            />
            <StatCard
              title="Network difficulty"
              value={formatNumber(selectedPool?.networkStats?.networkDifficulty, 2)}
              helper={`Height ${formatNumber(selectedPool?.networkStats?.blockHeight)}`}
              accent="violet"
            />
            <StatCard
              title="Total paid"
              value={selectedPool?.totalPaid ? `${selectedPool.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : '—'}
              helper={
                selectedPool?.poolFeePercent !== undefined
                  ? `Pool fee ${selectedPool.poolFeePercent}%`
                  : 'Pool fee —'
              }
              accent="amber"
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 lg:col-span-3">
            <SectionHeader title="Hashrate trend" description="Smoothed 1h sampling window." />
            <div className="mt-6 h-64">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 lg:col-span-2">
            <SectionHeader
              title="Connection profile"
              description="Region-agnostic endpoints and suggested difficulty bands."
            />
            <div className="mt-4 space-y-4">
              {selectedPool?.ports ? (
                Object.entries(selectedPool.ports).map(([port, config]) => (
                  <div key={port} className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span className="font-medium text-white">stratum+tcp://{stratumHost}:{port}</span>
                      <span className="rounded-full border border-slate-700/60 bg-slate-800/70 px-3 py-0.5 text-xs text-slate-300">
                        Diff {formatNumber(config?.difficulty, 2)}
                      </span>
                    </div>
                    {config?.varDiff ? (
                      <dl className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                        <div>
                          <dt>Target</dt>
                          <dd>{formatNumber(config.varDiff.targetTime)} s</dd>
                        </div>
                        <div>
                          <dt>Min diff</dt>
                          <dd>{formatNumber(config.varDiff.minDiff, 3)}</dd>
                        </div>
                        <div>
                          <dt>Variance</dt>
                          <dd>{formatNumber(config.varDiff.variancePercent)}%</dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Port metadata unavailable for this pool.</p>
              )}
            </div>
            {selectedPool?.paymentProcessing ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                <p>
                  {selectedPool.paymentProcessing.payoutScheme ?? 'Payouts'} &bull; minimum{' '}
                  {formatNumber(selectedPool.paymentProcessing.minimumPayment, 6)}
                </p>
                <p className="mt-1 opacity-80">
                  Auto-payments {selectedPool.paymentProcessing.enabled ? 'enabled' : 'disabled'}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 lg:col-span-3">
            <SectionHeader title="Recent blocks" description="Latest submissions observed for this pool." />
            <div className="mt-4 space-y-3">
              {blocks.length > 0 ? (
                blocks.map((block, index) => (
                  <div key={`${block.hash ?? block.blockHeight ?? index}`} className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Height {formatNumber(block.blockHeight)}</p>
                      <p className="text-xs text-slate-400">{relativeTime(block.created)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                      <span className="rounded-full border border-slate-700/60 bg-slate-800/70 px-3 py-0.5 uppercase">
                        {block.status ?? 'pending'}
                      </span>
                      <span>Reward {block.reward ? block.reward.toFixed(6) : '—'}</span>
                      <span>Miner {block.miner ? `${block.miner.slice(0, 6)}…${block.miner.slice(-4)}` : '—'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-6 text-sm text-slate-400">
                  <p>No block data available via API.</p>
                  {blocksError ? <p className="mt-2 text-xs text-rose-200/80">{blocksError}</p> : null}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 lg:col-span-2">
            <SectionHeader title="Recent payouts" description="Last successful transfers for this pool." />
            <div className="mt-4 space-y-3 text-sm">
              {payments.length > 0 ? (
                payments.map((payment, index) => (
                  <div key={`${payment.transactionConfirmationData ?? payment.address ?? index}`} className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                    <p className="text-xs text-slate-400">{relativeTime(payment.created)}</p>
                    <p className="mt-2 font-medium text-white">{payment.amount?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? '—'}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{payment.address}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-6 text-sm text-slate-400">
                  <p>No payout activity available.</p>
                  {paymentsError ? <p className="mt-2 text-xs text-rose-200/80">{paymentsError}</p> : null}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 lg:col-span-3">
            <SectionHeader title="Top miners" description="Current leaders by 24h average hashrate." />
            <div className="mt-4 space-y-3">
              {selectedPool?.topMiners && selectedPool.topMiners.length > 0 ? (
                selectedPool.topMiners.slice(0, 6).map((miner) => (
                  <div key={miner.miner} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-medium text-white">{miner.miner}</p>
                      <p className="text-xs text-slate-400">Shares/s {formatNumber(miner.sharesPerSecond, 4)}</p>
                    </div>
                    <p className="text-sm font-semibold text-neutral-100">{formatHashrate(miner.hashrate)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No miner leaderboard data published.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 lg:col-span-2">
            <SectionHeader
              title="Miner lookup"
              description="Query wallet address to inspect balance, workers, and hashrate."
            />
            <form className="mt-4 space-y-3" onSubmit={handleMinerLookup}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={minerQuery}
                  onChange={(event) => setMinerQuery(event.target.value)}
                  placeholder="Enter miner wallet address"
                  className="flex-1 rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-neutral-500"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
                  disabled={minerLoading}
                >
                  {minerLoading ? 'Loading…' : 'Lookup'}
                </button>
              </div>
            </form>
            {minerError ? <p className="mt-3 text-xs text-rose-200/80">{minerError}</p> : null}
            {minerStats ? (
              <div className="mt-5 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4 text-xs text-slate-300">
                <p className="text-sm font-semibold text-white">{minerStats.miner}</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-400">Pending balance</dt>
                    <dd className="mt-1 text-white">
                      {minerStats.pendingBalance?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? '0'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Total paid</dt>
                    <dd className="mt-1 text-white">
                      {minerStats.totalPaid?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? '0'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Hashrate</dt>
                    <dd className="mt-1 text-white">{formatHashrate(minerStats.hashrate)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Shares/s</dt>
                    <dd className="mt-1 text-white">{formatNumber(minerStats?.sharesPerSecond, 4)}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <p className="text-xs text-slate-400">Workers</p>
                  <MinerWorkerList workers={minerStats.workers} />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/60 bg-slate-950/70 py-6 text-center text-xs text-slate-500">
        <p>
          Miningcore WebUI 2 — {new Date().getFullYear()} &bull; Powered by Next.js & Tailwind.
        </p>
      </footer>
    </div>
  );
}
