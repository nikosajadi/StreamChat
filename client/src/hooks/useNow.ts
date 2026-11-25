// useNow: re-renders every `ms` so "last seen 5 min ago" stays fresh.
import { useEffect, useState } from 'react';

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
