import { useState, useEffect, useCallback } from 'react';

/**
 * Generic data-fetching hook with loading/error/data states.
 *
 * @param {() => Promise<T>} fetcher — async function that returns data
 * @param {boolean} [immediate=true] — fetch on mount
 * @returns {{ data: T|null, loading: boolean, error: Error|null, refetch: () => void }}
 */
export function useApi(fetcher, immediate = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err);
      console.error('API fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { data, loading, error, refetch: execute };
}
