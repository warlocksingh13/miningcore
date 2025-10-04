'use client';

import Image from "next/image";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { fetchBlocks, fetchPayments } from "../../api/client";
import { usePoolsData } from "../../hooks/usePoolsData";
import type { BlockItem, PaymentItem, Pool, TopMiner } from "../../types/miningcore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import MinerLookupPanel from "../../components/MinerLookupPanel";

const COIN_META: Record<string, { logoUrl?: string; coingeckoId?: string }> = {
  btc: {
    logoUrl: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400',
    coingeckoId: 'bitcoin',
  },
  bch: {
    logoUrl: 'https://assets.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png?1696501992',
    coingeckoId: 'bitcoin-cash',
  },
  octa: {
    logoUrl: 'https://octa.space/img/logo.svg',
    coingeckoId: 'octaspace',
  },
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const hoverLinePlugin = {
  id: 'hoverLine',
  afterDraw: (chart: any) => {
    const { ctx, tooltip, chartArea } = chart ?? {};
    if (!ctx || !tooltip || tooltip.opacity === 0 || !tooltip.dataPoints?.length) return;

    const x = tooltip.dataPoints[0]?.element?.x;
    if (typeof x !== 'number') return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  },
};

ChartJS.register(hoverLinePlugin);

const BLOCK_PAGE_SIZE = 10;
const PAYMENT_PAGE_SIZE = 10;

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

const relativeTime = (iso?: string) => {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = now - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  return `${Math.floor(diff / day)} d ago`;
};

const formatDuration = (seconds?: number | null) => {
  if (seconds === undefined || seconds === null) return '—';
  if (!Number.isFinite(seconds)) return '—';
  const value = Number(seconds);
  if (value <= 0) return '—';
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)} s`;
  if (value < 3600) {
    const minutes = value / 60;
    return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
  }
  const hours = value / 3600;
  if (hours < 24) {
    return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  }
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)} d`;
};

const formatDifficultyValue = (input?: number | null) => {
  if (input === undefined || input === null || !Number.isFinite(input)) return '—';
  const value = Number(input);
  const thresholds = [
    { limit: 1_000_000_000, suffix: 'G' },
    { limit: 1_000_000, suffix: 'M' },
    { limit: 1_000, suffix: 'K' },
  ];
  for (const { limit, suffix } of thresholds) {
    if (value >= limit) {
      const scaled = value / limit;
      return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)}${suffix}`;
    }
  }
  return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2);
};

const formatSecondsCompact = (input?: number | null) => {
  if (input === undefined || input === null || !Number.isFinite(input)) return '—';
  const value = Number(input);
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)}s`;
  if (value < 3600) return `${(value / 60).toFixed(value / 60 < 10 ? 1 : 0)}m`;
  return `${(value / 3600).toFixed(value / 3600 < 10 ? 1 : 0)}h`;
};

const formatVariance = (input?: number | null) => {
  if (input === undefined || input === null || !Number.isFinite(input)) return '—';
  const value = Number(input);
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
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

  const count = 24;
  const now = Date.now();
  const pseudoBase = base || 1;
  return Array.from({ length: count }).map((_, index) => {
    const variance = 0.92 + 0.06 * Math.sin(index / 2.8) + 0.03 * Math.cos(index / 1.7);
    return {
      timestamp: now - (count - index - 1) * 5 * 60 * 1000,
      value: pseudoBase * variance,
    };
  });
};

const deriveExternalLinks = (pool: Pool | null) => {
  if (!pool) return [] as Array<{ label: string; href: string; accent: string }>;
  const links: Array<{ label: string; href: string; accent: string }> = [];
  if (pool.coin?.website) {
    links.push({ label: 'Website', href: pool.coin.website, accent: "emerald" });
  }
  const market = pool.coin?.market || (pool.coin?.name ? `https://coinmarketcap.com/currencies/${pool.coin.name.replace(/\s+/g, '-').toLowerCase()}/` : undefined);
  if (market) {
    links.push({ label: "Market (CMC)", href: market, accent: "amber" });
  }
  const explorer = (pool as any)?.addressInfoLink;
  if (explorer) {
    links.push({ label: "Block explorer", href: explorer, accent: "violet" });
  }
  return links;
};

const accentChip = {
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-100",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-100",
} as const;

const cardAccent = {
  emerald: {
    container: 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.12)]',
    label: 'text-emerald-200',
    hint: 'text-emerald-100',
  },
  violet: {
    container: 'border-violet-500/40 bg-violet-500/10 shadow-[0_0_25px_rgba(139,92,246,0.12)]',
    label: 'text-violet-200',
    hint: 'text-violet-100',
  },
  amber: {
    container: 'border-amber-500/40 bg-amber-500/10 shadow-[0_0_25px_rgba(245,158,11,0.12)]',
    label: 'text-amber-200',
    hint: 'text-amber-100',
  },
  cyan: {
    container: 'border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_25px_rgba(6,182,212,0.12)]',
    label: 'text-cyan-200',
    hint: 'text-cyan-100',
  },
  rose: {
    container: 'border-rose-500/40 bg-rose-500/10 shadow-[0_0_25px_rgba(244,63,94,0.12)]',
    label: 'text-rose-200',
    hint: 'text-rose-100',
  },
  lime: {
    container: 'border-lime-500/40 bg-lime-500/10 shadow-[0_0_25px_rgba(132,204,22,0.12)]',
    label: 'text-lime-200',
    hint: 'text-lime-100',
  },
  neutral: {
    container: 'border-neutral-800 bg-neutral-950/80',
    label: 'text-neutral-400',
    hint: 'text-neutral-500',
  },
} as const;

type HeroAccentKey = keyof typeof cardAccent;

interface HeroLink {
  label: string;
  href: string;
  accent: HeroAccentKey;
  external?: boolean;
}

const friendlyRegion = (host: string) => {
  const normalized = host.toLowerCase();
  if (normalized.includes('eu')) return { label: 'Europe', flag: '🇪🇺' };
  if (normalized.includes('us')) return { label: 'North America', flag: '🇺🇸' };
  if (normalized.includes('sg') || normalized.includes('asia') || normalized.includes('ap')) return { label: 'Asia', flag: '🇸🇬' };
  if (normalized.includes('ru')) return { label: 'Russia', flag: '🇷🇺' };
  if (normalized.includes('br') || normalized.includes('sa')) return { label: 'South America', flag: '🇧🇷' };
  return { label: 'Global', flag: '🌐' };
};

type LatencyState = {
  latency: number | null;
  status: 'idle' | 'testing' | 'success' | 'error';
  error?: string;
};

interface ConnectionRow {
  id: string;
  label: string;
  flag: string;
  host: string;
  port: number;
  endpoint: string;
  profileName?: string | null;
  difficulty?: number | null;
  varDiffMin?: number | null;
  varDiffMax?: number | null;
  varDiffTarget?: number | null;
  varDiffRetarget?: number | null;
  varDiffVariance?: number | null;
}

const tierLabelFor = (profile?: string | null) => {
  const value = profile?.toLowerCase() ?? '';
  if (!value) return null;
  if (value.includes('nerd')) return 'NerdMiner';
  if (value.includes('low')) return 'Low-end hardware';
  if (value.includes('mid') || value.includes('medium')) return 'Mid-range hardware';
  if (value.includes('high')) return 'High-end hardware';
  if (value.includes('solo')) return 'Solo tier';
  return profile ?? null;
};

const friendlyDescriptionFor = (profile?: string | null) => {
  if (!profile) return null;
  const value = profile.toLowerCase();
  if (value.includes('0.25m') || value.includes('250k')) return 'Recommended for < 1 TH/s miners';
  if (value.includes('1m') && value.includes('10m')) return 'Best for 1-10 TH/s miners';
  if (value.includes('10m') && value.includes('50m')) return 'Optimised for > 10 TH/s miners';
  if (value.includes('nerd')) return 'Ultra-low difficulty for NerdMiner devices';
  if (value.includes('solo')) return 'Solo miners only';
  return profile;
};

interface ConnectionGroup {
  id: string;
  label: string;
  flag: string;
  host: string;
  endpoints: ConnectionRow[];
}

export default function PoolDetailPage() {
  const params = useParams<{ poolId: string }>();
  const poolId = (params?.poolId ?? '') as string;
  const router = useRouter();
  const { pools, loading, error, lastUpdated } = usePoolsData();
  const orderedPools = useMemo(
    () => [...pools].sort((a, b) => {
      const symbolA = (a.coin?.symbol ?? a.id).toLowerCase();
      const symbolB = (b.coin?.symbol ?? b.id).toLowerCase();
      if (symbolA < symbolB) return -1;
      if (symbolA > symbolB) return 1;
      return 0;
    }),
    [pools],
  );

  const [poolSearch, setPoolSearch] = useState('');
  const [minerLookupValue, setMinerLookupValue] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const filteredPools = useMemo(() => {
    const term = poolSearch.trim().toLowerCase();
    if (!term) return orderedPools;
    return orderedPools.filter((pool) => {
      const name = pool.coin?.name?.toLowerCase() ?? '';
      const symbol = pool.coin?.symbol?.toLowerCase() ?? '';
      return name.includes(term) || symbol.includes(term) || pool.id.toLowerCase().includes(term);
    });
  }, [orderedPools, poolSearch]);

  const pool = useMemo(() => orderedPools.find((p) => p.id === poolId) ?? null, [orderedPools, poolId]);

  const scrollPools = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!poolId) return;

    let active = true;

    const load = async () => {
      try {
        const blocksResponse = await fetchBlocks(poolId, 0, BLOCK_PAGE_SIZE);
        if (!active) return;
        const result: BlockItem[] = Array.isArray(blocksResponse?.result)
          ? blocksResponse.result
          : Array.isArray(blocksResponse?.blocks)
            ? blocksResponse.blocks
            : Array.isArray(blocksResponse)
              ? blocksResponse
              : [];
        setBlocks(result.slice(0, BLOCK_PAGE_SIZE));
        setBlocksError(null);
      } catch (err) {
        if (active) {
          setBlocks([]);
          setBlocksError('Blocks endpoint unavailable for this pool.');
        }
      }

      try {
        const paymentsResponse = await fetchPayments(poolId, 0, PAYMENT_PAGE_SIZE);
        if (!active) return;
        const result: PaymentItem[] = Array.isArray(paymentsResponse?.payments)
          ? paymentsResponse.payments
          : Array.isArray(paymentsResponse)
            ? paymentsResponse
            : [];
        setPayments(result.slice(0, PAYMENT_PAGE_SIZE));
        setPaymentsError(null);
      } catch (err) {
        if (active) {
          setPayments([]);
          setPaymentsError('Payments endpoint unavailable for this pool.');
        }
      }
    };

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [poolId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const headings = Array.from(document.querySelectorAll('h3'));
    headings
      .filter((heading) => heading.textContent?.toLowerCase().includes('calculate revenue'))
      .forEach((heading) => {
        let target: HTMLElement | null = heading as HTMLElement;
        while (target && (!target.className || !target.className.toString().includes('rounded-3xl'))) {
          target = target.parentElement as HTMLElement | null;
        }
        target?.remove();
      });
  }, []);

  const hashrateSeries = useMemo(() => buildHashrateSeries(pool), [pool]);

  const chartData = useMemo(
    () => ({
      labels: hashrateSeries.map((sample) => new Date(sample.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      datasets: [
        {
          label: 'Pool hashrate',
          data: hashrateSeries.map((sample) => sample.value ?? 0),
          borderColor: '#f4f4f5',
          backgroundColor: (ctx: any) => {
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
            gradient.addColorStop(0, 'rgba(244, 244, 245, 0.3)');
            gradient.addColorStop(1, 'rgba(15, 15, 15, 0.05)');
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
      interaction: {
        mode: 'index' as const,
        intersect: false,
        axis: 'x' as const,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: 'rgba(17, 24, 39, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          padding: 12,
          titleFont: { family: 'Inter, sans-serif', size: 12, weight: 600 },
          bodyFont: { family: 'Inter, sans-serif', size: 12 },
          callbacks: {
            title: (context: any) => context?.[0]?.label ?? '',
            label: (context: any) => ` ${formatHashrate(context.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#a1a1aa' },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: '#a1a1aa',
            callback: (value: any) => formatHashrate(Number(value)),
          },
          grid: { color: 'rgba(82,82,91,0.25)' },
        },
      },
    }),
    [],
  );

  if (!loading && !pool && !error) {
    notFound();
  }

  const stratumHost = process.env.NEXT_PUBLIC_STRATUM_HOST || 'pool.local';
  const portEntries = useMemo(() => (pool?.ports ? Object.entries(pool.ports) : []), [pool?.ports]);
  const primaryPort = portEntries.length > 0 ? portEntries[0][0] : undefined;
  const stratumUri = primaryPort ? `stratum+tcp://${stratumHost}:${primaryPort}` : `stratum+tcp://${stratumHost}`;
  const connectionRows = useMemo<ConnectionRow[]>(() => {
    if (portEntries.length === 0) {
      return [
        {
          id: 'default',
          label: friendlyRegion(`${stratumHost}`).label,
          flag: friendlyRegion(`${stratumHost}`).flag,
          host: stratumHost,
          port: Number(primaryPort ?? 3333),
          endpoint: stratumUri,
          difficulty: undefined,
          varDiffMin: undefined,
          varDiffMax: undefined,
          varDiffTarget: undefined,
        },
      ];
    }

    return portEntries.map(([port, config]) => {
      const endpointHost = `${stratumHost}:${port}`;
      const region = friendlyRegion(endpointHost);
      return {
        id: `${stratumHost}-${port}`,
        label: region.label,
        flag: region.flag,
        host: stratumHost,
        port: Number(port),
        endpoint: `stratum+tcp://${stratumHost}:${port}`,
        profileName: (config as any)?.name ?? null,
        difficulty: config?.difficulty ?? null,
        varDiffMin: config?.varDiff?.minDiff ?? null,
        varDiffMax: config?.varDiff?.maxDiff ?? null,
        varDiffTarget: config?.varDiff?.targetTime ?? null,
        varDiffRetarget: config?.varDiff?.retargetTime ?? null,
        varDiffVariance: config?.varDiff?.variancePercent ?? null,
      };
    });
  }, [portEntries, primaryPort, stratumHost, stratumUri]);

  const connectionGroups = useMemo<ConnectionGroup[]>(() => {
    const byHost = new Map<string, { group: ConnectionGroup; endpoints: ConnectionRow[] }>();

    connectionRows.forEach((row) => {
      const key = row.host;
      if (!byHost.has(key)) {
        byHost.set(key, {
          group: {
            id: key,
            label: row.label,
            flag: row.flag,
            host: row.host,
            endpoints: [],
          },
          endpoints: [],
        });
      }
      byHost.get(key)?.endpoints.push(row);
    });

    return Array.from(byHost.values()).map(({ group, endpoints }) => ({
      ...group,
      endpoints: [...endpoints].sort((a, b) => a.port - b.port),
    }));
  }, [connectionRows]);

  const [latencyMap, setLatencyMap] = useState<Record<string, LatencyState>>({});
  const measuredRef = useRef(new Set<string>());
  const manualSelectionRef = useRef(false);
  const manualEndpointRef = useRef(false);

  const defaultEndpointRow = useMemo<ConnectionRow | null>(() => {
    if (connectionRows.length === 0) return null;
    const midTier = connectionRows.find((row) => {
      const profile = (row.profileName ?? '').toLowerCase();
      const condensed = profile.replace(/[^a-z0-9]/g, '');
      return condensed.includes('midrange') || condensed.includes('midtier') || condensed.includes('medium');
    });
    if (midTier) return midTier;
    const preferred = connectionRows.find((row) => {
      const diff = row.difficulty ?? row.varDiffMin ?? null;
      return diff !== null && diff > 0 && diff <= 2048;
    });
    return preferred ?? connectionRows[0];
  }, [connectionRows]);

  const bestLatencyRow = useMemo<ConnectionRow | null>(() => {
    let best: ConnectionRow | null = null;
    let bestLatency = Number.POSITIVE_INFINITY;
    connectionRows.forEach((row) => {
      const entry = latencyMap[row.id];
      if (entry?.status === 'success' && entry.latency !== null && entry.latency < bestLatency) {
        best = row;
        bestLatency = entry.latency;
      }
    });
    return best;
  }, [connectionRows, latencyMap]);
  const groupByHost = useMemo(() => {
    const map = new Map<string, ConnectionGroup>();
    connectionGroups.forEach((group) => {
      map.set(group.host, group);
    });
    return map;
  }, [connectionGroups]);

  const groupById = useMemo(() => {
    const map = new Map<string, ConnectionGroup>();
    connectionGroups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [connectionGroups]);

  const defaultHost = defaultEndpointRow?.host ?? null;
  const bestLatencyHost = bestLatencyRow?.host ?? null;

  const defaultGroup = useMemo(
    () => (defaultHost ? groupByHost.get(defaultHost) ?? null : null),
    [defaultHost, groupByHost],
  );

  const bestLatencyGroup = useMemo(
    () => (bestLatencyHost ? groupByHost.get(bestLatencyHost) ?? null : null),
    [bestLatencyHost, groupByHost],
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selectedGroup = useMemo(
    () => (selectedGroupId ? groupById.get(selectedGroupId) ?? null : null),
    [groupById, selectedGroupId],
  );
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);

  const fastestEndpointFor = useCallback((group: ConnectionGroup | null) => {
    if (!group) return null;
    let best: ConnectionRow | null = null;
    let bestLatency = Number.POSITIVE_INFINITY;
    group.endpoints.forEach((row) => {
      const entry = latencyMap[row.id];
      if (entry?.status === 'success' && entry.latency !== null && entry.latency < bestLatency) {
        best = row;
        bestLatency = entry.latency;
      }
    });
    return best ?? group.endpoints[0] ?? null;
  }, [latencyMap]);

  const pickEndpointForGroup = useCallback((group: ConnectionGroup | null) => {
    if (!group) return null;
    if (defaultEndpointRow && defaultEndpointRow.host === group.host) {
      const match = group.endpoints.find((endpoint) => endpoint.id === defaultEndpointRow.id);
      if (match) return match;
    }
    const midTier = group.endpoints.find((endpoint) => endpoint.profileName?.toLowerCase().includes('mid'));
    if (midTier) return midTier;
    const varDiffEndpoint = group.endpoints.find((endpoint) => endpoint.difficulty === null || endpoint.varDiffMin !== null);
    if (varDiffEndpoint) return varDiffEndpoint;
    return fastestEndpointFor(group);
  }, [defaultEndpointRow, fastestEndpointFor]);

  useEffect(() => {
    if (connectionGroups.length === 0) {
      manualSelectionRef.current = false;
      manualEndpointRef.current = false;
      setSelectedGroupId(null);
      setSelectedEndpointId(null);
      return;
    }

    const stillExists = selectedGroupId ? groupById.has(selectedGroupId) : false;

    if (!manualSelectionRef.current || !stillExists) {
      const fallbackGroup = bestLatencyGroup ?? defaultGroup ?? connectionGroups[0] ?? null;
      const nextId = fallbackGroup?.id ?? null;
      if (nextId != selectedGroupId) {
        manualSelectionRef.current = false;
        setSelectedGroupId(nextId);
      }
    }
  }, [bestLatencyGroup, connectionGroups, defaultGroup, groupById, selectedGroupId]);

  useEffect(() => {
    const fallbackGroup =
      selectedGroup
      ?? bestLatencyGroup
      ?? defaultGroup
      ?? (connectionGroups.length > 0 ? connectionGroups[0] : null);

    if (!fallbackGroup) {
      manualEndpointRef.current = false;
      setSelectedEndpointId(null);
      return;
    }

    const endpoints = fallbackGroup.endpoints ?? [];
    const stillExists = selectedEndpointId
      ? endpoints.some((endpoint) => endpoint.id === selectedEndpointId)
      : false;

    if (!manualEndpointRef.current || !stillExists) {
      const fallbackEndpoint = pickEndpointForGroup(fallbackGroup);
      const nextEndpointId = fallbackEndpoint?.id ?? null;
      if (nextEndpointId !== selectedEndpointId) {
        manualEndpointRef.current = false;
        setSelectedEndpointId(nextEndpointId);
      }
    }
  }, [
    connectionGroups,
    selectedGroup,
    bestLatencyGroup,
    defaultGroup,
    selectedEndpointId,
    pickEndpointForGroup,
  ]);

  const testLatency = useCallback(async (row: ConnectionRow) => {
    const key = row.id;
    measuredRef.current.add(key);
    setLatencyMap((prev) => ({
      ...prev,
      [key]: { latency: null, status: 'testing' },
    }));

    try {
      const response = await fetch('/api/latency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ host: row.host, port: row.port, timeout: 4000 }),
      });

      const body = (await response.json()) as { latency: number | null; error?: string };

      if (!response.ok || body.latency === null) {
        setLatencyMap((prev) => ({
          ...prev,
          [key]: { latency: null, status: 'error', error: body.error ?? 'unreachable' },
        }));
        return;
      }

      const measured = Math.round(body.latency ?? 0);
      setLatencyMap((prev) => ({
        ...prev,
        [key]: { latency: measured, status: 'success' },
      }));
    }
    catch (error) {
      setLatencyMap((prev) => ({
        ...prev,
        [key]: { latency: null, status: 'error', error: 'network-error' },
      }));
    }
  }, []);

  useEffect(() => {
    connectionRows.forEach((row) => {
      if (!measuredRef.current.has(row.id)) {
        testLatency(row);
      }
    });
  }, [connectionRows, testLatency]);

  const remeasureAll = useCallback(() => {
    connectionRows.forEach((row) => {
      measuredRef.current.delete(row.id);
      testLatency(row);
    });
  }, [connectionRows, testLatency]);

  const selectGroup = useCallback((groupId: string) => {
    manualSelectionRef.current = true;
    if (groupId !== selectedGroupId) {
      manualEndpointRef.current = false;
      setSelectedEndpointId(null);
      setSelectedGroupId(groupId);
    } else {
      setSelectedGroupId(groupId);
    }
  }, [selectedGroupId, setSelectedEndpointId, setSelectedGroupId]);

  const selectEndpoint = useCallback((group: ConnectionGroup, endpoint: ConnectionRow) => {
    manualSelectionRef.current = true;
    manualEndpointRef.current = true;
    if (group.id !== selectedGroupId) {
      setSelectedGroupId(group.id);
    }
    setSelectedEndpointId(endpoint.id);
  }, [selectedGroupId, setSelectedEndpointId, setSelectedGroupId]);

  const retryGroup = useCallback((group: ConnectionGroup) => {
    group.endpoints.forEach((row) => {
      measuredRef.current.delete(row.id);
      testLatency(row);
    });
  }, [testLatency]);

  const latencyStatusFor = useCallback((row: ConnectionRow) => {
    const entry = latencyMap[row.id];
    if (!entry || entry.status === 'idle') return { label: '—', className: 'text-neutral-400' };
    if (entry.status === 'testing') return { label: 'testing…', className: 'text-amber-300' };
    if (entry.status === 'error' || entry.latency === null) return { label: 'unreachable', className: 'text-rose-300' };
    return { label: `${entry.latency} ms`, className: entry.latency <= 120 ? 'text-emerald-300' : entry.latency <= 220 ? 'text-amber-300' : 'text-rose-300' };
  }, [latencyMap]);

  const describeDifficulty = useCallback((row: ConnectionRow | null) => {
    if (!row) return '—';

    const parts: string[] = [];
    const hasMin = row.varDiffMin !== undefined && row.varDiffMin !== null && Number.isFinite(Number(row.varDiffMin));
    const hasMax = row.varDiffMax !== undefined && row.varDiffMax !== null && Number.isFinite(Number(row.varDiffMax));
    const hasTarget = row.varDiffTarget !== undefined && row.varDiffTarget !== null && Number.isFinite(Number(row.varDiffTarget));

    if (hasMin) {
      const value = Number(row.varDiffMin);
      parts.push(`min ${formatNumber(value, value < 10 ? 2 : 0)}`);
    }
    if (hasMax) {
      const value = Number(row.varDiffMax);
      parts.push(`max ${formatNumber(value, value < 10 ? 2 : 0)}`);
    }
    if (hasTarget) {
      const value = Number(row.varDiffTarget);
      parts.push(`target ${formatNumber(value, value < 10 ? 1 : 0)}s`);
    }

    if (parts.length > 0) {
      return `VarDiff ${parts.join(' / ')}`;
    }

    if (row.difficulty !== undefined && row.difficulty !== null && Number.isFinite(Number(row.difficulty))) {
      const value = Number(row.difficulty);
      return `Fixed ${formatNumber(value, value < 10 ? 2 : 0)}`;
    }

    return 'Automatic';
  }, []);
  const handleCopy = (value: string, field: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(value)
        .then(() => {
          setCopiedField(field);
          setTimeout(() => setCopiedField(null), 1500);
        })
        .catch(() => setCopiedField(field));
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1500);
      } catch (err) {
        console.warn('Clipboard copy failed', err);
      }
      document.body.removeChild(textarea);
    }
  };

  const autoExchangeEnabled = (pool as any)?.autoExchange === true;
  const poolEffort = pool?.poolStats?.poolEffort ?? pool?.poolEffort ?? null;
  const poolEffortPercent = poolEffort !== null && Number.isFinite(poolEffort) ? poolEffort * 100 : null;
  const lastNetworkBlockTime = pool?.networkStats?.lastNetworkBlockTime ?? null;
  const lastPoolBlockRelative = pool?.lastPoolBlockTime ? relativeTime(pool.lastPoolBlockTime) : '—';
  const poolFeeDisplay = pool?.poolFeePercent !== undefined && pool?.poolFeePercent !== null
    ? `${formatNumber(pool.poolFeePercent, pool.poolFeePercent < 1 ? 2 : 1)}%`
    : '—';
  const payoutSchemeLabel = useMemo(() => {
    const scheme = pool?.paymentProcessing?.payoutScheme ?? '—';
    const factor = (pool?.paymentProcessing?.payoutSchemeConfig as any)?.factor;
    if (factor !== undefined && factor !== null) {
      return `${scheme} (Factor: ${factor})`;
    }
    return scheme;
  }, [pool?.paymentProcessing?.payoutScheme, pool?.paymentProcessing?.payoutSchemeConfig]);
  const blockRefreshSeconds = (pool as any)?.jobRebroadcastTimeout ?? null;

  const blockIntervalSeconds = useMemo(() => {
    const statsInterval = (pool?.poolStats as any)?.avgBlockTime ?? (pool as any)?.avgBlockTime;
    if (Number.isFinite(statsInterval)) return Number(statsInterval);
    if (Number.isFinite(blockRefreshSeconds)) return Number(blockRefreshSeconds);
    const refresh = (pool as any)?.blockRefreshInterval ?? (pool as any)?.blockRefresh;
    if (Number.isFinite(refresh)) return Number(refresh);
    return null;
  }, [pool?.poolStats, blockRefreshSeconds, pool]);

  const blockIntervalDisplay = useMemo(() => formatDuration(blockIntervalSeconds), [blockIntervalSeconds]);

  const coinSymbol = pool?.coin?.symbol?.toLowerCase()?.replace(/[^a-z0-9]/g, '') ?? '';
  const coinMeta = COIN_META[coinSymbol];

  const coinLogoUrl = useMemo(() => {
    if (coinMeta?.logoUrl) return coinMeta.logoUrl;
    if (!coinSymbol) return null;
    return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${coinSymbol}.png`;
  }, [coinMeta?.logoUrl, coinSymbol]);

  const [priceInfo, setPriceInfo] = useState<{ price: number | null; change: number | null }>({ price: null, change: null });

  useEffect(() => {
    const coingeckoId = coinMeta?.coingeckoId;
    if (!coingeckoId) {
      setPriceInfo({ price: null, change: null });
      return;
    }

    let cancelled = false;

    const loadPrice = async () => {
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`,
        );
        if (!response.ok) throw new Error('price request failed');
        const json = await response.json();
        const entry = json?.[coingeckoId];
        if (!cancelled && entry) {
          setPriceInfo({
            price: typeof entry.usd === 'number' ? entry.usd : null,
            change: typeof entry.usd_24h_change === 'number' ? entry.usd_24h_change : null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setPriceInfo({ price: null, change: null });
        }
      }
    };

    loadPrice();
    const interval = setInterval(loadPrice, 300000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [coinMeta?.coingeckoId]);

  const activeTopMiners = useMemo<TopMiner[]>(() => (pool?.topMiners ?? []) as TopMiner[], [pool?.topMiners]);

  const priceDisplay = useMemo(() => {
    if (priceInfo.price === null) return '—';
    return `$${priceInfo.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [priceInfo.price]);

  const priceChangeDisplay = useMemo(() => {
    if (priceInfo.change === null) return '—';
    const formatted = priceInfo.change.toFixed(2);
    return `${priceInfo.change >= 0 ? '+' : ''}${formatted}%`;
  }, [priceInfo.change]);

  const externalLinks = useMemo<HeroLink[]>(() => {
    const rawLinks = deriveExternalLinks(pool);
    const withoutExplorer = rawLinks.filter(
      (link) => !link.label?.toLowerCase?.().includes('block explorer'),
    );

    const normalized = withoutExplorer.map((link) => ({
      label: link.label,
      href: link.href,
      accent: (link.accent as HeroAccentKey) ?? 'neutral',
      external: true,
    }));

    const symbol = pool?.coin?.symbol?.toUpperCase?.();
    const explorerHref = symbol === 'BCH'
      ? 'https://www.blockchain.com/explorer/assets/bch'
      : rawLinks.find((link) => link.label?.toLowerCase?.().includes('block explorer'))?.href ?? null;

    if (explorerHref) {
      normalized.push({ label: 'Block explorer', href: explorerHref, accent: 'violet', external: true });
    }

    const priority = ['Website', 'Market (CMC)', 'Block explorer'];
    return [...normalized].sort((a, b) => {
      const indexA = priority.indexOf(a.label);
      const indexB = priority.indexOf(b.label);
      if (indexA === -1 && indexB === -1) return a.label.localeCompare(b.label);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [pool]);

  const renderHeroLink = useCallback(
    (link: HeroLink | null) => {
      if (!link) {
        return <span className="block h-8 rounded-full border border-dashed border-neutral-800/60" />;
      }
      const accent = cardAccent[link.accent] ?? cardAccent.neutral;
      const className = `flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.28em] transition hover:scale-[1.01] ${accent.container}`;
      if (link.external) {
        return (
          <a href={link.href} target="_blank" rel="noreferrer" className={className}>
            <span className={accent.label}>{link.label}</span>
            <span aria-hidden className={`${accent.hint} text-[0.55rem]`}>↗</span>
          </a>
        );
      }
      return (
        <a href={link.href} className={className}>
          <span className={accent.label}>{link.label}</span>
        </a>
      );
    },
    [],
  );

  const statCards = useMemo(
    () => [
      {
        id: 'pool-hashrate',
        label: 'Pool hashrate',
        value: formatHashrate(pool?.poolStats?.poolHashrate),
        hint: `Connected miners: ${formatNumber(pool?.poolStats?.connectedMiners)}`,
        accent: 'emerald' as const,
      },
      {
        id: 'pool-effort',
        label: 'Pool effort',
        value:
          poolEffortPercent !== null && Number.isFinite(poolEffortPercent)
            ? `${formatNumber(poolEffortPercent, poolEffortPercent < 10 ? 2 : 1)}%`
            : '—',
        hint: `Shares / s: ${formatNumber(pool?.poolStats?.sharesPerSecond, 4)}`,
        accent: 'cyan' as const,
      },
      {
        id: 'pool-fee',
        label: 'Pool fee',
        value: poolFeeDisplay,
        hint: `Payout: ${payoutSchemeLabel}`,
        accent: 'rose' as const,
      },
      {
        id: 'blocks-found',
        label: 'Blocks found',
        value: formatNumber(pool?.totalBlocks ?? pool?.totalConfirmedBlocks),
        hint: `Pending: ${formatNumber(pool?.totalPendingBlocks)}`,
        accent: 'amber' as const,
        href: '#blocks',
      },
      {
        id: 'block-interval',
        label: 'Avg block found time',
        value: blockIntervalDisplay,
        hint: `Pool interval avg · ${lastPoolBlockRelative}`,
        accent: 'lime' as const,
      },
      {
        id: 'total-rewards',
        label: 'Total rewards',
        value: pool?.totalPaid
          ? `${pool.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${pool?.coin?.symbol ?? ''}`
          : '—',
        hint: `Last block · ${lastPoolBlockRelative}`,
        accent: 'cyan' as const,
        href: '#payments',
      },
  ],
  [
    pool?.poolStats?.poolHashrate,
    pool?.poolStats?.connectedMiners,
    poolEffortPercent,
    pool?.poolStats?.sharesPerSecond,
    pool?.totalBlocks,
    pool?.totalConfirmedBlocks,
    pool?.totalPendingBlocks,
    pool?.totalPaid,
    pool?.coin?.symbol,
    lastPoolBlockRelative,
      poolFeeDisplay,
      payoutSchemeLabel,
      blockIntervalDisplay,
    ],
  );

  const effectiveSelectedGroup = useMemo(
    () => selectedGroup ?? bestLatencyGroup ?? defaultGroup ?? connectionGroups[0] ?? null,
    [bestLatencyGroup, connectionGroups, defaultGroup, selectedGroup],
  );

  const effectiveSelectedEndpoint = useMemo(() => {
    if (!effectiveSelectedGroup) return null;
    if (selectedEndpointId) {
      const explicit = effectiveSelectedGroup.endpoints.find((endpoint) => endpoint.id === selectedEndpointId);
      if (explicit) return explicit;
    }
    return pickEndpointForGroup(effectiveSelectedGroup);
  }, [effectiveSelectedGroup, pickEndpointForGroup, selectedEndpointId]);

  const defaultDifficultyEndpoint = useMemo(
    () => defaultEndpointRow ?? connectionRows[0] ?? null,
    [connectionRows, defaultEndpointRow],
  );

  const priceChangeTone = priceInfo.change === null
    ? 'neutral'
    : priceInfo.change >= 0
      ? 'positive'
      : 'negative';

const priceBadgeClass = 'rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-sm font-semibold text-white';

const changeBadgeClass = priceChangeTone === 'positive'
  ? 'rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200'
  : priceChangeTone === 'negative'
      ? 'rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-sm font-semibold text-rose-200'
      : 'rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-sm font-semibold text-neutral-300';

  const selectedLatencyStatus = useMemo(
    () => (effectiveSelectedEndpoint ? latencyStatusFor(effectiveSelectedEndpoint) : null),
    [effectiveSelectedEndpoint, latencyStatusFor],
  );

  const selectedTierLabel = useMemo(() => tierLabelFor(effectiveSelectedEndpoint?.profileName ?? null), [effectiveSelectedEndpoint?.profileName]);
  const selectedTierDescription = useMemo(() => friendlyDescriptionFor(effectiveSelectedEndpoint?.profileName ?? null), [effectiveSelectedEndpoint?.profileName]);
  const selectedMinDiff = useMemo(
    () => formatDifficultyValue(effectiveSelectedEndpoint?.varDiffMin ?? effectiveSelectedEndpoint?.difficulty ?? null),
    [effectiveSelectedEndpoint?.varDiffMin, effectiveSelectedEndpoint?.difficulty],
  );
  const selectedMaxDiff = useMemo(
    () => formatDifficultyValue(effectiveSelectedEndpoint?.varDiffMax ?? null),
    [effectiveSelectedEndpoint?.varDiffMax],
  );
  const selectedTargetTime = useMemo(
    () => formatSecondsCompact(effectiveSelectedEndpoint?.varDiffTarget ?? null),
    [effectiveSelectedEndpoint?.varDiffTarget],
  );
  const selectedRetargetTime = useMemo(
    () => formatSecondsCompact(effectiveSelectedEndpoint?.varDiffRetarget ?? null),
    [effectiveSelectedEndpoint?.varDiffRetarget],
  );
  const selectedVariance = useMemo(
    () => formatVariance(effectiveSelectedEndpoint?.varDiffVariance ?? null),
    [effectiveSelectedEndpoint?.varDiffVariance],
  );

  const selectedLatencyBadgeTone = useMemo(() => {
    if (!selectedLatencyStatus) return 'border-neutral-700 text-neutral-200';
    const tone = selectedLatencyStatus.className ?? '';
    if (tone.includes('emerald')) return 'border-emerald-500/40 text-emerald-200';
    if (tone.includes('rose')) return 'border-rose-500/40 text-rose-200';
    if (tone.includes('amber')) return 'border-amber-500/40 text-amber-200';
    return 'border-neutral-700 text-neutral-200';
  }, [selectedLatencyStatus]);

  const handleMinerLookupSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = minerLookupValue.trim();
      if (!trimmed) return;
      const params = new URLSearchParams();
      params.set('wallet', trimmed);
      if (poolId) params.set('pool', poolId);
      router.push(`/miners?${params.toString()}`);
    },
    [minerLookupValue, poolId, router],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <section className="space-y-6" id="overview">
        <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-black/60 shadow-[0_0_36px_rgba(15,23,42,0.45)]">
          <div className="absolute -top-10 left-6 sm:left-10">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-neutral-700 bg-neutral-900/85 shadow-[0_10px_40px_rgba(56,189,248,0.25)] sm:h-24 sm:w-24">
              {coinLogoUrl ? (
                <Image
                  src={coinLogoUrl}
                  alt={`${pool?.coin?.name ?? pool?.coin?.symbol ?? 'Coin'} logo`}
                  width={72}
                  height={72}
                  className="h-16 w-16 object-contain sm:h-20 sm:w-20"
                  unoptimized
                />
              ) : (
                <span className="text-2xl font-semibold text-neutral-100 sm:text-3xl">
                  {pool?.coin?.symbol?.slice(0, 1) ?? '⛏'}
                </span>
              )}
            </div>
          </div>

          <div className="border-b border-neutral-800/60 bg-neutral-950/60 px-6 pb-5 pt-16 sm:px-8">
            {orderedPools.length > 1 ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-neutral-500">
                    <span>Browse pools</span>
                    <span className="hidden text-neutral-700 sm:inline">/</span>
                    <span className="hidden text-neutral-500 sm:inline">Tap to switch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollPools('left')}
                      className="rounded-full border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-300 transition hover:border-emerald-500/60 hover:text-white"
                      aria-label="Scroll pools left"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollPools('right')}
                      className="rounded-full border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-300 transition hover:border-emerald-500/60 hover:text-white"
                      aria-label="Scroll pools right"
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto pb-2" ref={scrollRef}>
                  <div className="flex min-w-max gap-3">
                    {filteredPools.map((item) => {
                      const isActive = item.id === poolId;
                      const itemSymbol = item.coin?.symbol?.toLowerCase()?.replace(/[^a-z0-9]/g, '') ?? '';
                      const itemMeta = COIN_META[itemSymbol];
                      const itemLogo = itemMeta?.logoUrl ?? (itemSymbol ? `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/64/color/${itemSymbol}.png` : null);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.id !== poolId) router.push(`/pools/${item.id}`);
                          }}
                          className={`rounded-3xl border px-6 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            isActive
                              ? 'border-emerald-500/60 bg-emerald-500/10 text-white shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                              : 'border-neutral-800 bg-neutral-950/80 text-neutral-300 hover:border-neutral-600 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative h-8 w-8 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80">
                              {itemLogo ? (
                                <Image src={itemLogo} alt={`${item.coin?.name ?? item.id} logo`} fill sizes="32px" className="object-contain p-1.5" unoptimized />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-neutral-200">
                                  {(item.coin?.symbol ?? item.id.slice(0, 2)).slice(0, 2)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{item.coin?.name ?? item.id}</p>
                              <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">{item.coin?.symbol ?? item.id.toUpperCase()}</p>
                              <p className="mt-1 text-[11px] text-neutral-500">{item.paymentProcessing?.payoutScheme?.toUpperCase?.() ?? '—'} mode</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {filteredPools.length === 0 ? (
                  <p className="text-xs text-neutral-500">No pools match your search.</p>
                ) : null}
                <div className="flex justify-end">
                  <input
                    type="text"
                    value={poolSearch}
                    onChange={(event) => setPoolSearch(event.target.value)}
                    placeholder="Search pools or coins…"
                    className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-white outline-none transition focus:border-emerald-500/60"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-neutral-500">
                <span>{pool?.coin?.symbol ?? poolId}</span>
                <span>Single pool view</span>
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-6 sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="space-y-2 lg:pl-28">
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                  {pool?.coin?.name ?? pool?.id ?? 'Pool'}
                </h1>
                <p className="text-xs text-neutral-400 sm:text-sm">
                  {pool?.coin?.algorithm ?? 'Unknown algorithm'} · {pool?.coin?.family ?? 'Unknown family'}
                </p>
                <div className="flex flex-wrap gap-2 pt-2 text-xs text-neutral-400 sm:text-sm">
                  <span className={priceBadgeClass}>{priceDisplay}</span>
                  <span className={changeBadgeClass}>{priceChangeDisplay}</span>
                </div>
              </div>
              <div className="flex w-full flex-col gap-4 lg:max-w-xl">
                <form onSubmit={handleMinerLookupSubmit} className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-2">
                  <label className="sr-only" htmlFor="hero-miner-lookup">Lookup miner wallet</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="hero-miner-lookup"
                      type="text"
                      value={minerLookupValue}
                      onChange={(event) => setMinerLookupValue(event.target.value)}
                      placeholder="Paste miner wallet address"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-emerald-100 transition hover:bg-emerald-500/20"
                    >
                      Lookup
                    </button>
                  </div>
                </form>
                {externalLinks.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {externalLinks.map((link) => (
                      <span key={`external-${link.label}`}>{renderHeroLink(link)}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map((card) => {
            const accent = cardAccent[card.accent] ?? cardAccent.neutral;
            const baseClasses = `flex h-full min-h-[150px] flex-col justify-between rounded-3xl border p-5 transition hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(255,255,255,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500 ${accent.container}`;
            const content = (
              <>
                <p className={`text-xs uppercase tracking-widest ${accent.label}`}>{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                <p className={`mt-3 text-xs font-medium ${accent.hint}`}>{card.hint}</p>
              </>
            );
            if (card.href) {
              return (
                <Link key={card.id} href={card.href} prefetch={false} className={baseClasses}>
                  {content}
                </Link>
              );
            }
            return (
              <div key={card.id} className={baseClasses}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" id="performance">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Performance history</h3>
              <p className="text-sm text-neutral-500">Pool versus network hashrate, refreshed every 30 seconds.</p>
            </div>
            <Link href="#blocks" className="text-xs font-semibold text-emerald-300 transition hover:text-emerald-100">
              View recent blocks →
            </Link>
          </header>
          <div className="mt-4 h-72">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6">
            <h3 className="text-sm font-semibold text-white">Network information</h3>
            <div className="mt-4 grid gap-3 text-sm text-neutral-300">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Network hashrate</span>
                <span className="font-semibold text-white">{formatHashrate(pool?.networkStats?.networkHashrate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Difficulty</span>
                <span className="font-semibold text-white">{formatNumber(pool?.networkStats?.networkDifficulty, 2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Block height</span>
                <span className="font-semibold text-white">{formatNumber(pool?.networkStats?.blockHeight)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Connected peers</span>
                <span className="font-semibold text-white">{formatNumber(pool?.networkStats?.connectedPeers)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Reward type</span>
                <span className="font-semibold text-white">{pool?.networkStats?.rewardType ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Node status</span>
                <span className="font-semibold text-white">{pool?.networkStats?.connectedPeers && pool?.networkStats?.connectedPeers > 0 ? 'Synced' : 'Syncing'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Last network block</span>
                <span className="font-semibold text-white">{lastNetworkBlockTime ? relativeTime(lastNetworkBlockTime) : '—'}</span>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-neutral-500">
                <span>Price</span>
                <span className={priceBadgeClass}>{priceDisplay}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-neutral-500">
                <span>24h change</span>
                <span className={changeBadgeClass}>{priceChangeDisplay}</span>
              </div>
            </div>
          </div>
        </div>
      </section>


            <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6" id="connections">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Connection endpoints</h3>
            <p className="text-xs text-neutral-500">Pick the closest server, choose a port tier, then copy the ready-to-use stratum URL.</p>
          </div>
          {connectionRows.length > 0 ? (
            <button
              type="button"
              onClick={remeasureAll}
              className="mt-2 inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-neutral-300 transition hover:border-cyan-500/40 hover:text-white sm:mt-0"
            >
              Retest latency
            </button>
          ) : null}
        </header>

        {connectionRows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">This pool has no published stratum endpoints yet.</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5 h-full">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">1. Select server</h4>
                    <p className="text-xs text-neutral-500">We highlight the lowest latency region for you.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {connectionGroups.map((group) => {
                    const isSelected = effectiveSelectedGroup?.id === group.id;
                    const isBest = bestLatencyGroup?.id === group.id;
                    const isDefault = defaultGroup?.id === group.id;
                    const fastestRow = (() => {
                      let fastest: ConnectionRow | null = null;
                      let bestLatency = Number.POSITIVE_INFINITY;
                      group.endpoints.forEach((endpoint) => {
                        const entry = latencyMap[endpoint.id];
                        if (entry?.status === 'success' && entry.latency !== null && entry.latency < bestLatency) {
                          fastest = endpoint;
                          bestLatency = entry.latency;
                        }
                      });
                      return fastest ?? group.endpoints[0] ?? null;
                    })();
                    const latencyDisplay = fastestRow ? latencyStatusFor(fastestRow) : { label: '—', className: 'text-neutral-400' };
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => selectGroup(group.id)}
                        className={`w-full flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition hover:border-neutral-600 ${
                          isSelected
                            ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
                            : 'border-neutral-800 bg-neutral-950/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="selected-server"
                            checked={isSelected}
                            onChange={() => selectGroup(group.id)}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold text-white flex items-center gap-2">
                              <span aria-hidden className="text-base">{group.flag}</span>
                              {group.label}
                            </p>
                            <p className="text-xs text-neutral-500">{group.host}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
                              {isDefault ? (
                                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                                  Normal diff
                                </span>
                              ) : null}
                              {isBest ? (
                                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
                                  Best ping
                                </span>
                              ) : null}
                              {isSelected && !isBest ? (
                                <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-neutral-300">
                                  Selected
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${latencyDisplay.className}`}>{latencyDisplay.label}</p>
                          <p className="text-xs text-neutral-500">Fastest port {fastestRow?.port ?? '—'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5 h-full">
                <h4 className="text-sm font-semibold text-white">2. Select port tier</h4>
                <p className="text-xs text-neutral-500">Mid-range hardware tier is chosen automatically; feel free to switch.</p>
                {effectiveSelectedGroup ? (
                  <div className="mt-4 space-y-3">
                    {effectiveSelectedGroup.endpoints.map((endpoint) => {
                      const endpointSelected = effectiveSelectedEndpoint?.id === endpoint.id;
                      const fieldKey = `endpoint-${effectiveSelectedGroup.id}-${endpoint.id}`;
                      const isDefaultEndpoint = defaultDifficultyEndpoint?.id === endpoint.id;
                      const tierLabel = tierLabelFor(endpoint.profileName);
                      const tierDescription = friendlyDescriptionFor(endpoint.profileName);
                      return (
                        <div
                          key={endpoint.id}
                          onClick={() => selectEndpoint(effectiveSelectedGroup, endpoint)}
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                            endpointSelected
                              ? 'border-emerald-500/50 bg-emerald-500/10'
                              : 'border-neutral-800 bg-neutral-950/80 hover-border-neutral-600'
                          }`}
                        >
                          <label className="flex flex-1 cursor-pointer items-center gap-3">
                            <input
                              type="radio"
                              name={`port-${effectiveSelectedGroup.id}`}
                              checked={endpointSelected}
                              onChange={() => selectEndpoint(effectiveSelectedGroup, endpoint)}
                              className="h-4 w-4 accent-emerald-500"
                            />
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-semibold text-white">
                                Port {endpoint.port}
                                {isDefaultEndpoint ? (
                                  <span className="ml-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
                                    Normal diff
                                  </span>
                                ) : null}
                              </p>
                              {tierLabel ? (
                                <p className="text-xs text-neutral-300">{tierLabel}</p>
                              ) : null}
                              {tierDescription ? (
                                <p className="text-[11px] text-neutral-500">{tierDescription}</p>
                              ) : null}
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCopy(endpoint.endpoint, fieldKey);
                            }}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              copiedField === fieldKey
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover-border-emerald-500/40 hover:text-white'
                            }`}
                          >
                            {copiedField === fieldKey ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-6 flex h-full items-center justify-center rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-6 text-xs text-neutral-500">
                    Choose a server to view available port tiers.
                  </div>
                )}
              </div>
            </div>
            {effectiveSelectedEndpoint ? (
              <div className="rounded-2xl border border-neutral-800 bg-black/40 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="text-lg">{effectiveSelectedEndpoint.flag}</span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">{effectiveSelectedEndpoint.label}</p>
                      <p className="text-xs text-neutral-500">{effectiveSelectedEndpoint.host}</p>
                    </div>
                  </div>
                  <div className="flex flex-1 min-w-[260px] items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-widest text-neutral-500">Stratum address</p>
                      <code className="block max-w-[320px] truncate text-xs text-emerald-100">{effectiveSelectedEndpoint.endpoint}</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(effectiveSelectedEndpoint.endpoint, 'selected-endpoint')}
                      className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                        copiedField === 'selected-endpoint'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover-border-emerald-500/40 hover:text-white'
                      }`}
                    >
                      {copiedField === 'selected-endpoint' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-neutral-300">
                      <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 font-semibold text-neutral-200">
                        Port {effectiveSelectedEndpoint.port}
                      </span>
                      {selectedTierLabel ? (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-200">
                          {selectedTierLabel}
                        </span>
                      ) : null}
                      {selectedLatencyStatus ? (
                        <span className={`rounded-full border px-2 py-0.5 font-semibold bg-neutral-900 ${selectedLatencyBadgeTone}`}>
                          {selectedLatencyStatus.label}
                        </span>
                      ) : null}
                    </div>
                    {selectedTierDescription ? (
                      <p className="text-[11px] text-neutral-500">{selectedTierDescription}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-neutral-400">
                    <span>Min Diff <span className="text-neutral-200">{selectedMinDiff}</span></span>
                    <span>Max Diff <span className="text-neutral-200">{selectedMaxDiff}</span></span>
                    <span>Target <span className="text-neutral-200">{selectedTargetTime}</span></span>
                    <span>Retarget <span className="text-neutral-200">{selectedRetargetTime}</span></span>
                    <span>Variance <span className="text-neutral-200">{selectedVariance}</span></span>
                    <span>Difficulty <span className="text-neutral-200">{describeDifficulty(effectiveSelectedEndpoint)}</span></span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>


      <section className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-6" id="active-miners">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Active miners</h3>
            <p className="text-xs text-neutral-500">Live ranking derived from the pool statistics.</p>
          </div>
          <p className="text-xs text-neutral-500">{activeTopMiners.length} miners listed</p>
        </header>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-800 text-sm text-neutral-200">
            <thead className="text-xs uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">Rank</th>
                <th className="px-4 py-2 text-left">Miner</th>
                <th className="px-4 py-2 text-right">Hashrate</th>
                <th className="px-4 py-2 text-right">Shares/s</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {activeTopMiners.length > 0 ? (
                activeTopMiners.map((miner, index) => (
                  <tr key={`${miner.miner}-${index}`}>
                    <td className="px-4 py-3 text-neutral-400">#{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-white">{miner.miner}</td>
                    <td className="px-4 py-3 text-right text-neutral-300">{formatHashrate(miner.hashrate)}</td>
                    <td className="px-4 py-3 text-right text-neutral-300">{formatNumber(miner.sharesPerSecond, 4)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-500">
                    No miners reported for this pool yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2" id="blocks">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent blocks</h3>
              <p className="text-xs text-neutral-500">Latest submissions mined by this pool.</p>
            </div>
          </header>
          {blocks.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full table-auto text-sm text-neutral-300">
                <thead className="text-xs uppercase tracking-widest text-neutral-500">
                  <tr className="border-b border-neutral-800">
                    <th className="px-4 py-2 text-left">Height</th>
                    <th className="px-4 py-2 text-left">Time</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Miner</th>
                    <th className="px-4 py-2 text-left">Reward</th>
                    <th className="px-4 py-2 text-left">Confirmations</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block, idx) => (
                    <tr key={`${block.hash ?? block.blockHeight ?? idx}`} className="border-b border-neutral-900/60 last:border-none">
                      <td className="px-4 py-3 font-semibold text-white">{formatNumber(block.blockHeight)}</td>
                      <td className="px-4 py-3">{relativeTime(block.created)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs uppercase text-emerald-100">
                          {block.status ?? 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{block.miner ? `${block.miner.slice(0, 8)}…${block.miner.slice(-6)}` : '—'}</td>
                      <td className="px-4 py-3">{block.reward?.toFixed(6) ?? '—'}</td>
                      <td className="px-4 py-3">{block.confirmationProgress ? `${Math.round(block.confirmationProgress * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/50 px-4 py-6 text-sm text-neutral-500">
              {blocksError ?? 'No block data available yet.'}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6" id="payments">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent payments</h3>
              <p className="text-xs text-neutral-500">Latest payouts emitted by Miningcore.</p>
            </div>
          </header>
          {payments.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full table-auto text-sm text-neutral-300">
                <thead className="text-xs uppercase tracking-widest text-neutral-500">
                  <tr className="border-b border-neutral-800">
                    <th className="px-4 py-2 text-left">Time</th>
                    <th className="px-4 py-2 text-left">Amount</th>
                    <th className="px-4 py-2 text-left">Address</th>
                    <th className="px-4 py-2 text-left">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, idx) => (
                    <tr key={`${payment.transactionConfirmationData ?? payment.address ?? idx}`} className="border-b border-neutral-900/60 last:border-none">
                      <td className="px-4 py-3 font-semibold text-white">{relativeTime(payment.created)}</td>
                      <td className="px-4 py-3">{payment.amount?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? '—'}</td>
                      <td className="px-4 py-3 truncate">{payment.address ?? '—'}</td>
                      <td className="px-4 py-3 truncate text-xs text-neutral-500">{payment.transactionConfirmationData ? `${payment.transactionConfirmationData.slice(0, 12)}…` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/50 px-4 py-6 text-sm text-neutral-500">
              {paymentsError ?? 'No payments recorded yet.'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
