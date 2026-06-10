import { useState, useEffect, useCallback } from "react";

export type JobStatus = "applied" | "screening" | "interview" | "offer" | "rejected";

export const STATUS_META: Record<JobStatus, { label: string; light: string; dark: string }> = {
  applied:   { label: "Applied",   light: "bg-blue-100 text-blue-700 border-blue-300",   dark: "dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700" },
  screening: { label: "Screening", light: "bg-amber-100 text-amber-700 border-amber-300", dark: "dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700" },
  interview: { label: "Interview", light: "bg-purple-100 text-purple-700 border-purple-300", dark: "dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700" },
  offer:     { label: "Offer",     light: "bg-green-100 text-green-700 border-green-300",  dark: "dark:bg-green-900/40 dark:text-green-300 dark:border-green-700" },
  rejected:  { label: "Rejected",  light: "bg-slate-100 text-slate-500 border-slate-300",  dark: "dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600" },
};

const STATUS_KEY = "jobhunt_status";
const NOTES_KEY = "jobhunt_notes";
const LEGACY_KEY = "jobhunt_applied";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function useJobTracker() {
  const [statuses, setStatuses] = useState<Record<string, JobStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = read<Record<string, JobStatus>>(STATUS_KEY, {});
    // one-time migration from old binary applied set
    const legacy = read<string[]>(LEGACY_KEY, []);
    if (legacy.length > 0) {
      legacy.forEach(id => { if (!stored[id]) stored[id] = "applied"; });
      write(STATUS_KEY, stored);
      localStorage.removeItem(LEGACY_KEY);
    }
    setStatuses(stored);
    setNotes(read(NOTES_KEY, {}));
  }, []);

  const setStatus = useCallback((id: string, status: JobStatus | null) => {
    setStatuses(prev => {
      const next = { ...prev };
      if (status === null) delete next[id];
      else next[id] = status;
      write(STATUS_KEY, next);
      return next;
    });
  }, []);

  const setNote = useCallback((id: string, note: string) => {
    setNotes(prev => {
      const next = { ...prev };
      if (!note.trim()) delete next[id];
      else next[id] = note;
      write(NOTES_KEY, next);
      return next;
    });
  }, []);

  const getStatus = useCallback((id: string): JobStatus | null => statuses[id] ?? null, [statuses]);
  const getNote   = useCallback((id: string): string => notes[id] ?? "", [notes]);
  const isTracked = useCallback((id: string) => id in statuses, [statuses]);

  return { statuses, notes, setStatus, setNote, getStatus, getNote, isTracked };
}
