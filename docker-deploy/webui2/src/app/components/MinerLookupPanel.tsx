'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMinerStats } from '../api/client';
import { usePoolsData } from '../hooks/usePoolsData';
import type { MinerStatsResponse, Pool } from '../types/miningcore';

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

const MinerWorkerList = ({
  workers,
}: {
  workers?: MinerStatsResponse['workers'];
}) => {
  if (!workers || Object.keys(workers).length === 0) {
    return <p className="text-sm text-slate-400">No worker statistics found for this wallet.</p>;
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {Object.entries(workers).map(([workerName, worker]) => (
        <div key={workerName} className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-200">{workerName}</p>
            <span
              className={`h-2.5 w-2.5 rounded-full ${worker?.online ? 'bg-emerald-400' : 'bg-rose-500'}`}
              aria-hidden
            />
          </div>
          <dl className="mt-3 space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <dt>Hashrate</dt>
              <dd className="text-slate-200">{formatHashrate(worker?.hashrate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shares/s</dt>
              <dd>{formatNumber(worker?.sharesPerSecond, 4)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Last share</dt>
              <dd>{relativeTime(worker?.lastShare)}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
};

interface MinerLookupPanelProps {
  initialPoolId?: string;
}

export const MinerLookupPanel = ({ initialPoolId }: MinerLookupPanelProps) => {
  const { pools, loading } = usePoolsData();
  const router = useRouter();
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<MinerStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [urlParamsInitialised, setUrlParamsInitialised] = useState(false);

  const performLookup = useCallback(async (poolId: string, wallet: string) => {
    if (!wallet.trim() || !poolId) {
      setError('Enter a miner address and pick a pool.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetchMinerStats(poolId, wallet.trim());
      if (!response) {
        setError('Miner not found in the selected pool.');
      }
      setResult(response ?? null);
    } catch (err) {
      console.error('Miner lookup failed', err);
      setError('Unable to retrieve miner statistics from Miningcore.');
    } finally {
      setSubmitting(false);
    }
  }, []);

  useEffect(() => {
    if (urlParamsInitialised || pools.length === 0) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const walletParam = params.get('wallet') ?? '';
    const poolParam = params.get('pool');

    let resolvedPool = selectedPool;
    if (poolParam && pools.some((pool) => pool.id === poolParam)) {
      resolvedPool = poolParam;
      setSelectedPool(poolParam);
    } else if (!resolvedPool) {
      if (initialPoolId && pools.some((pool) => pool.id === initialPoolId)) {
        resolvedPool = initialPoolId;
        setSelectedPool(initialPoolId);
      } else if (pools.length > 0) {
        resolvedPool = pools[0].id;
        setSelectedPool(pools[0].id);
      }
    }

    if (walletParam) {
      setQuery(walletParam);
      if (resolvedPool) {
        performLookup(resolvedPool, walletParam);
      }
    }

    setUrlParamsInitialised(true);
  }, [initialPoolId, performLookup, pools, selectedPool, urlParamsInitialised]);

  useEffect(() => {
    if (selectedPool) return;
    if (initialPoolId && pools.some((pool) => pool.id === initialPoolId)) {
      setSelectedPool(initialPoolId);
    } else if (pools.length > 0) {
      setSelectedPool(pools[0].id);
    }
  }, [initialPoolId, pools, selectedPool]);

  const selectedPoolMeta: Pool | undefined = useMemo(
    () => pools.find((pool) => pool.id === selectedPool),
    [pools, selectedPool],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || !selectedPool) {
      setError('Enter a miner address and pick a pool.');
      return;
    }

    performLookup(selectedPool, trimmed);
    const params = new URLSearchParams();
    params.set('wallet', trimmed);
    params.set('pool', selectedPool);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <section className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Miner lookup</h2>
          <p className="text-sm text-slate-400">
            Paste a wallet address to review hashrate, shares, payout balance, and per-worker status in real time.
          </p>
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col gap-2 text-sm">
            <label className="text-xs uppercase tracking-widest text-slate-400">Pool</label>
            <select
              className="rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-neutral-500"
              value={selectedPool}
              onChange={(event) => setSelectedPool(event.target.value)}
              disabled={loading || pools.length === 0}
            >
              {pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.coin?.symbol ?? pool.id.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="text-xs uppercase tracking-widest text-slate-400">Miner wallet</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-neutral-500"
                placeholder="Paste wallet address"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                type="submit"
                className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
                disabled={submitting}
              >
                {submitting ? 'Checking…' : 'Lookup'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

      {result ? (
        <div className="mt-6 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Wallet</p>
              <p className="mt-1 break-all text-sm font-semibold text-white">{result.miner}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-300 md:grid-cols-4">
              <div>
                <dt className="text-slate-400">Pending balance</dt>
                <dd className="mt-1 text-sm text-white">
                  {result.pendingBalance?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? '0'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Total paid</dt>
                <dd className="mt-1 text-sm text-white">
                  {result.totalPaid?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? '0'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Hashrate</dt>
                <dd className="mt-1 text-sm text-white">{formatHashrate(result.hashrate)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Shares/s</dt>
                <dd className="mt-1 text-sm text-white">{formatNumber(result.sharesPerSecond, 4)}</dd>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            <p>Last share {relativeTime(result.lastShare)} · Pool {selectedPoolMeta?.coin?.symbol ?? selectedPoolMeta?.id}</p>
          </div>
          <MinerWorkerList workers={result.workers} />
        </div>
      ) : null}
    </section>
  );
};

export default MinerLookupPanel;
