import { useEffect, useState } from 'react';

/**
 * Returns current epoch milliseconds, updating on the specified interval.
 * Cleans up interval on unmount or interval change to prevent timer leaks.
 */
export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}
