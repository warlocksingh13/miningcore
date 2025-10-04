'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Pool } from '../types/miningcore';

export interface StratumLocation {
  id: string;
  label: string;
  host: string;
  port: number;
  notes?: string;
}

interface Props {
  pools: Pool[];
  defaultHost: string;
  locations?: StratumLocation[];
  ctaText?: string;
}

type LatencyState = {
  latency: number | null;
  status: 'idle' | 'testing' | 'error' | 'success';
  error?: string;
};

const DEFAULT_LATENCY: LatencyState = {
  latency: null,
  status: 'idle',
};

const latencyToBadge = (entry: LatencyState): { label: string; className: string } => {
  if (entry.status === 'testing') {
    return { label: 'testing…', className: 'bg-amber-500/20 text-amber-200 border-amber-500/40' };
  }
  if (entry.status === 'error' || entry.latency === null) {
    return { label: 'unreachable', className: 'bg-rose-500/20 text-rose-200 border-rose-500/40' };
  }
  if (entry.latency <= 120) {
    return { label: `${entry.latency} ms`, className: 'bg-emerald-500/20 text-emerald-100 border-emerald-500/40' };
  }
  if (entry.latency <= 220) {
    return { label: `${entry.latency} ms`, className: 'bg-amber-500/20 text-amber-100 border-amber-500/40' };
  }
  return { label: `${entry.latency} ms`, className: 'bg-rose-500/20 text-rose-100 border-rose-500/40' };
};

const latencyDotClass = (entry: LatencyState) => {
  if (entry.status === 'testing') return 'bg-amber-400';
  if (entry.status === 'error' || entry.latency === null) return 'bg-rose-500';
  if (entry.latency <= 120) return 'bg-emerald-400';
  if (entry.latency <= 220) return 'bg-amber-400';
  return 'bg-rose-500';
};

export const StratumLatencyPanel = ({ pools, defaultHost, locations, ctaText }: Props) => {
  const derivedLocations = useMemo<StratumLocation[]>(() => {
    if (locations && locations.length > 0) {
      return locations;
    }

    const generated: StratumLocation[] = [];
    pools.forEach((pool) => {
      const symbol = pool.coin?.symbol ?? pool.id.toUpperCase();
      const ports = Object.keys(pool.ports ?? {});
      ports.forEach((port, index) => {
        if (!Number(port)) return;
        if (generated.length >= 6) return;
        generated.push({
          id: `${pool.id}-${port}`,
          label: `${symbol} · Port ${port}${index === 0 ? '' : ` (#${index + 1})`}`,
          host: defaultHost,
          port: Number(port),
          notes: `Diff ${pool.ports?.[port]?.difficulty ?? 'auto'}${pool.paymentProcessing?.payoutScheme ? ` · ${pool.paymentProcessing.payoutScheme}` : ''}`,
        });
      });
    });

    if (generated.length === 0) {
      generated.push({
        id: 'default-5108',
        label: 'Primary · Port 5108',
        host: defaultHost,
        port: 5108,
        notes: 'Low-diff stratum for Jasminer getwork bridge',
      });
    }

    return generated;
  }, [defaultHost, locations, pools]);

  const [latencyMap, setLatencyMap] = useState<Record<string, LatencyState>>(() => (
    Object.fromEntries(derivedLocations.map((location) => [location.id, DEFAULT_LATENCY]))
  ));

  useEffect(() => {
    setLatencyMap((prev) => {
      const next: Record<string, LatencyState> = { ...prev };
      derivedLocations.forEach((location) => {
        if (!next[location.id]) {
          next[location.id] = DEFAULT_LATENCY;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!derivedLocations.some((location) => location.id === key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [derivedLocations]);

  const testLatency = async (location: StratumLocation) => {
    setLatencyMap((prev) => ({
      ...prev,
      [location.id]: { latency: null, status: 'testing' },
    }));

    try {
      const response = await fetch('/api/latency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ host: location.host, port: location.port, timeout: 4000 }),
      });

      const body = (await response.json()) as { latency: number | null; error?: string };
      if (!response.ok || body.latency === null) {
        setLatencyMap((prev) => ({
          ...prev,
          [location.id]: { latency: null, status: 'error', error: body.error ?? 'unreachable' },
        }));
        return;
      }

      const measured = Math.round(body.latency ?? 0);
      setLatencyMap((prev) => ({
        ...prev,
        [location.id]: { latency: measured, status: 'success' },
      }));
    } catch (error) {
      console.warn('Latency test failed', error);
      setLatencyMap((prev) => ({
        ...prev,
        [location.id]: { latency: null, status: 'error', error: 'network-error' },
      }));
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Stratum endpoints & latency</h2>
          <p className="text-sm text-slate-400">
            Choose the closest endpoint and run a quick ping test. Green indicators are ideal for ASICs, amber is workable,
            red suggests using a closer region or a relay.
          </p>
        </div>
        {ctaText ? (
          <a
            href="/connect"
            className="inline-flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/70 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-900"
          >
            {ctaText}
          </a>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {derivedLocations.map((location) => {
          const entry = latencyMap[location.id] ?? DEFAULT_LATENCY;
          const badge = latencyToBadge(entry);

          return (
            <div
              key={location.id}
              className="rounded-2xl border border-slate-800/60 bg-slate-950/50 p-5 shadow-sm shadow-slate-900/40"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">{location.label}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {location.host}:{location.port}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              {location.notes ? (
                <p className="mt-2 text-xs text-slate-400">{location.notes}</p>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className={`h-2.5 w-2.5 rounded-full ${latencyDotClass(entry)}`} aria-hidden />
                  <span>
                    {entry.status === 'idle'
                      ? 'No sample yet'
                      : entry.status === 'testing'
                        ? 'Running check…'
                        : entry.status === 'error'
                          ? 'Latency unavailable'
                          : 'Good to mine'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => testLatency(location)}
                  className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-neutral-500 hover:text-white"
                  disabled={entry.status === 'testing'}
                >
                  {entry.status === 'testing' ? 'Measuring…' : 'Test latency'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default StratumLatencyPanel;
