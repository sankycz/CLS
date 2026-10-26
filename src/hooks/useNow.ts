import { useEffect, useState } from 'react';

/** Aktuální čas obnovovaný v daném intervalu (pro časovače turniketů). */
export const useNow = (intervalMs = 1000): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
};
