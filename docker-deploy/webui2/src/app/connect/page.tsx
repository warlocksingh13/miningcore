'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import StratumLatencyPanel from '../components/StratumLatencyPanel';
import { usePoolsData } from '../hooks/usePoolsData';
import type { Pool, PortConfig } from '../types/miningcore';

const SAMPLE_CONFIG = `# Generic stratum configuration\nSTRATUM : stratum+tcp://{HOST}:{PORT}\nWALLET  : YOUR_{COIN}_WALLET.rig01\nPASS    : x\n\n# Example (BOSminer)\n-k stratum+tcp://{HOST}:{PORT}\n-u YOUR_{COIN}_WALLET.rig01\n-p x`;

const GETWORK_NOTES = [
  'Keep a second port configured as failover to avoid idle time during maintenance windows.',
  'For high hashrate fleets, favour the higher-difficulty ports to maintain smooth VarDiff retargeting.',
  'Still seeing spikes? Deploy a local stratum proxy and point it at the closest Miningcore endpoint.',
];

const formatNumber = (value?: number, digits = 0) => {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatDifficulty = (difficulty?: number | null, varDiffMin?: number | null) => {
  if (difficulty && difficulty > 0) return formatNumber(difficulty);
  if (varDiffMin && varDiffMin > 0) return `${formatNumber(varDiffMin)} (VarDiff)`;
  return 'Auto';
};

const describeVarDiff = (config?: PortConfig['varDiff']) => {
  if (!config) return 'Disabled';
  const min = config.minDiff !== undefined ? formatNumber(config.minDiff) : 'auto';
  const max = config.maxDiff !== undefined && config.maxDiff !== null ? formatNumber(config.maxDiff) : '∞';
  const target = config.targetTime ? `${config.targetTime}s` : '—';
  return `${min} → ${max} · target ${target}`;
};

const formatVarRange = (config?: PortConfig['varDiff']) => {
  if (!config) return '—';
  const min = config.minDiff !== undefined ? formatNumber(config.minDiff) : 'auto';
  const max = config.maxDiff !== undefined && config.maxDiff !== null ? formatNumber(config.maxDiff) : '∞';
  return `${min} → ${max}`;
};

const summarizeTargets = (config?: PortConfig['varDiff']) => {
  if (!config) return '—';
  const t = config.targetTime ? `${config.targetTime}s` : '—';
  const r = config.retargetTime ? `${config.retargetTime}s` : '—';
  const v = config.variancePercent !== undefined ? `${config.variancePercent}%` : '—';
  return `${t} / ${r} / ${v}`;
};

const payoutLabel = (pool: Pool | null) => {
  if (!pool?.paymentProcessing) return '—';
  const scheme = pool.paymentProcessing.payoutScheme?.toUpperCase?.() ?? '—';
  const min = pool.paymentProcessing.minimumPayment;
  return `${scheme} · min ${min !== undefined ? formatNumber(min, min < 1 ? 4 : 2) : '—'}`;
};

const sortPools = (pools: Pool[]) =>
  [...pools].sort((a, b) => {
    const nameA = `${a.coin?.symbol ?? a.id}`.toLowerCase();
    const nameB = `${b.coin?.symbol ?? b.id}`.toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

function ConnectContent() {
  const { pools, loading } = usePoolsData();
  const stratumHost = process.env.NEXT_PUBLIC_STRATUM_HOST || '192.168.2.100';
  const searchParams = useSearchParams();

  const orderedPools = useMemo(() => sortPools(pools), [pools]);
  const [activePoolId, setActivePoolId] = useState<string | null>(null);
  const [selectedPort, setSelectedPort] = useState<string | null>(null);

  useEffect(() => {
    if (orderedPools.length === 0) return;
    const requested = searchParams?.get('pool')?.toLowerCase();
    setActivePoolId((prev) => {
      if (requested && orderedPools.some((pool) => pool.id === requested)) {
        return requested;
      }
      if (prev && orderedPools.some((pool) => pool.id === prev)) return prev;
      return orderedPools[0].id;
    });
  }, [orderedPools, searchParams]);

  const activePool = useMemo(
    () => orderedPools.find((pool) => pool.id === activePoolId) ?? null,
    [orderedPools, activePoolId],
  );

  const portEntries = useMemo(() => {
    if (!activePool) return [] as Array<[string, PortConfig]>;
    const entries = Object.entries(activePool.ports ?? {})
      .map(([key, value]) => [key, value as PortConfig] as [string, PortConfig]);
    const getMin = (cfg?: PortConfig['varDiff']) => (cfg?.minDiff ?? Number.MAX_SAFE_INTEGER);
    return entries.sort((a, b) => {
      const da = getMin(a[1]?.varDiff);
      const db = getMin(b[1]?.varDiff);
      if (da !== db) return da - db;
      return Number(a[0]) - Number(b[0]);
    });
  }, [activePool]);

  // Default selected port whenever pool or its ports change
  useEffect(() => {
    setSelectedPort((prev) => {
      if (!portEntries.length) return null;
      if (prev && portEntries.some(([port]) => port === prev)) return prev;
      // Default to Mid-Range (middle item by ascending difficulty)
      const midIndex = Math.floor(portEntries.length / 2);
      return portEntries[Math.min(midIndex, portEntries.length - 1)][0];
    });
  }, [portEntries]);

  const latencyLocations = useMemo(
    () => portEntries.map(([port, config]) => ({
      id: `${activePool?.id}-${port}`,
      label: config.name ? `${config.name} · Port ${port}` : `Port ${port}`,
      host: stratumHost,
      port: Number(port),
      notes: describeVarDiff(config.varDiff),
    })),
    [activePool?.id, portEntries, stratumHost],
  );

  const samplePort = selectedPort ?? portEntries[0]?.[0] ?? '3333';
  const sampleCoin = (activePool?.coin?.symbol ?? activePool?.id ?? 'POOL').toUpperCase();
  const renderedConfig = useMemo(
    () => SAMPLE_CONFIG.replace(/\{HOST\}/g, stratumHost).replace(/\{PORT\}/g, samplePort).replace(/\{COIN\}/g, sampleCoin),
    [sampleCoin, samplePort, stratumHost],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-800/60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_60%)] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.34em] text-neutral-300">Connect miners</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Dial in the fastest lane to the pool</h1>
            <p className="mt-4 text-sm text-slate-200 sm:text-base">
              Choose a coin below to reveal its mining endpoints, difficulty, and sample configuration. Run the latency test
              before pointing your rigs for a smooth ramp-up.
            </p>
          </div>
          {activePool ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <p className="text-xs uppercase tracking-[0.32em]">Current selection</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {activePool.coin?.name ?? activePool.id}
              </p>
              <p className="mt-1 text-xs text-emerald-100/80">{payoutLabel(activePool)}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-5">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-400">Scroll to switch pools</h2>
          <p className="text-xs text-neutral-500">Tap a badge to load ports and configs</p>
        </header>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {orderedPools.map((pool) => {
              const symbol = pool.coin?.symbol ?? pool.id.toUpperCase();
              const isActive = pool.id === activePoolId;
              return (
                <button
                  key={pool.id}
                  type="button"
                  onClick={() => setActivePoolId(pool.id)}
                  className={`rounded-2xl border px-5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isActive
                      ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.2)] text-white'
                      : 'border-neutral-800 bg-neutral-950/80 text-neutral-300 hover:border-neutral-600 hover:text-white'
                  }`}
                >
                  <p className="text-sm font-semibold">{pool.coin?.name ?? pool.id}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-neutral-400">{symbol}</p>
                  <p className="mt-2 text-xs text-neutral-500">{pool.paymentProcessing?.payoutScheme?.toUpperCase?.() ?? '—'} mode</p>
                </button>
              );
            })}
            {orderedPools.length === 0 && !loading ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 px-5 py-3 text-sm text-neutral-500">
                No pools online yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {activePool ? (
        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Mining ports</p>
                <h3 className="text-lg font-semibold text-white">{activePool.coin?.name ?? activePool.id}</h3>
              </div>
              <p className="text-xs text-neutral-500">Host {stratumHost}</p>
            </header>
            <div className="mt-4 overflow-x-auto">
              {selectedPort ? (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <div className="space-x-2">
                    <span className="font-semibold text-white">Selected endpoint:</span>
                    <span className="text-emerald-200">{stratumHost}:{selectedPort}</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(`stratum+tcp://${stratumHost}:${selectedPort}`)}
                    className="rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-3 py-1 text-xs hover:bg-emerald-600/20"
                  >
                    Copy URL
                  </button>
                </div>
              ) : null}
              <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
                <thead className="text-xs uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Select</th>
                    <th className="px-4 py-2 text-left">Label</th>
                    <th className="px-4 py-2 text-left">Protocol</th>
                    <th className="px-4 py-2 text-left">Port</th>
                    <th className="px-4 py-2 text-left">Range</th>
                    <th className="px-4 py-2 text-left">Target/Retarget/Var</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {portEntries.map(([port, config]) => (
                    <tr
                      key={port}
                      className="hover:bg-slate-900/60 cursor-pointer"
                      onClick={() => setSelectedPort(port)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="radio"
                          name="portSelect"
                          aria-label={`Select port ${port}`}
                          checked={selectedPort === port}
                          onChange={() => setSelectedPort(port)}
                          className="h-4 w-4 cursor-pointer accent-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{config.name ?? `Port ${port}`}</td>
                      <td className="px-4 py-3 text-slate-300">{config.protocol?.toUpperCase?.() ?? 'STRATUM'}</td>
                      <td className="px-4 py-3 text-slate-300">{stratumHost}:{port}</td>
                      <td className="px-4 py-3 text-slate-300">{formatVarRange(config.varDiff)}</td>
                      <td className="px-4 py-3 text-slate-400">{summarizeTargets(config.varDiff)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigator.clipboard?.writeText(`stratum+tcp://${stratumHost}:${port}`)}
                          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 hover:border-emerald-500/60 hover:text-white"
                        >
                          Copy URL
                        </button>
                      </td>
                    </tr>
                  ))}
                  {portEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                        No exposed ports in the Miningcore config.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Minimum payout: {formatNumber(activePool.paymentProcessing?.minimumPayment)} · Payment interval every 4 hours.
            </p>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
              <h3 className="text-sm font-semibold text-white">Sample configuration</h3>
              <p className="mt-2 text-xs text-slate-400">
                Replace the placeholders with your wallet and selected port. Append <code className="rounded bg-slate-800/80 px-1">.worker</code> to track rigs.
              </p>
              <pre className="mt-4 max-h-56 overflow-auto rounded-xl border border-slate-800/60 bg-slate-950/80 p-4 text-xs text-slate-200">
{renderedConfig}
              </pre>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
              <h3 className="text-sm font-semibold text-white">Before you repoint</h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">
                {GETWORK_NOTES.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <StratumLatencyPanel pools={pools} defaultHost={stratumHost} locations={latencyLocations} />
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12 text-sm text-neutral-400">Loading connection details…</div>}>
      <ConnectContent />
    </Suspense>
  );
}
