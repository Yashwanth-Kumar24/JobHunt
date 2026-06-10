import { useState, useEffect } from "react";

const KEY = "jobhunt_last_visit";

/**
 * Returns the timestamp of the PREVIOUS visit (before this page load).
 * Immediately updates localStorage to now, so next visit can compare.
 */
export function useLastVisit(): Date | null {
  const [lastVisit, setLastVisit] = useState<Date | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored) setLastVisit(new Date(stored));
    localStorage.setItem(KEY, new Date().toISOString());
  }, []);

  return lastVisit;
}
