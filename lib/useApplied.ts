import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "jobhunt_applied";

export function useApplied() {
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setApplied(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, []);

  const toggle = useCallback((id: string) => {
    setApplied(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const isApplied = useCallback(
    (id: string) => applied.has(id),
    [applied]
  );

  return { applied, toggle, isApplied };
}
