'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_CONFIG } from '../api/config';
import { fetchPools } from '../api/client';
import type { Pool } from '../types/miningcore';

export interface UsePoolsDataResult {
  pools: Pool[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: number | null;
}

export const usePoolsData = (interval = API_CONFIG.refreshInterval): UsePoolsDataResult => {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchPools();
      const poolList: Pool[] = Array.isArray(response?.pools)
        ? response.pools
        : Array.isArray(response)
          ? response
          : [];
      setPools(poolList);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Failed to load pool data', err);
      setError('Unable to load pool data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      await load();
    };

    run();

    const timer = setInterval(() => {
      if (!active) return;
      load();
    }, interval);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [interval, load]);

  return useMemo(
    () => ({ pools, loading, error, refresh: load, lastUpdated }),
    [pools, loading, error, load, lastUpdated],
  );
};
