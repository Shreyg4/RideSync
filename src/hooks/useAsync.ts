import { useCallback, useEffect, useState } from 'react';
import { reportAndDescribe } from '@/src/services/errors';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useAsync = <T>(
  run: () => Promise<T>,
  deps: readonly unknown[],
  scope: string
): AsyncState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    run()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((caught) => {
        if (!cancelled) setError(reportAndDescribe(caught, { scope }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { data, loading, error, reload };
};
