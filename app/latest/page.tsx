"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useJobTracker, STATUS_META, type JobStatus } from "@/lib/useJobTracker";
import { useLastVisit } from "@/lib/useLastVisit";

type Job = {
  id: string;
  title: string;
  posting_url: string;
  posted_at: string;
  first_seen_at: string;
  job_id: string | null;
  locations: any | null;
  company_id: string;
};

type CompanyMap = Record<string, string>;
type Range = 1 | 3 | 7 | 30;
type StatusFilter = "all" | "not_tracked" | JobStatus;

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalDate(value: string): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "Jun 10" — or "Today" for today's date */
function pillLabel(dateStr: string): string {
  if (dateStr === todayISO()) return "Today";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** "Jun 10" for stats card heading */
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtLocation(loc: any): string {
  if (!loc) return "US";
  if (typeof loc === "string") return loc;
  if (Array.isArray(loc)) return loc.join(", ");
  return "US";
}

function fmtDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function daysSince(value: string): number {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

function freshnessClass(posted_at: string): string {
  const d = daysSince(posted_at);
  if (d === 0) return "text-green-600 dark:text-green-400 font-semibold";
  if (d <= 2)  return "text-slate-700 dark:text-slate-200";
  if (d <= 7)  return "text-slate-500 dark:text-slate-400";
  return "text-slate-400 dark:text-slate-500";
}

const QUOTES = [
  "One yes is all it takes.",
  "The right role is looking for you too.",
  "Every application is a door knocked. Keep knocking.",
  "Consistency beats talent in a job hunt. Show up daily.",
  "You're not behind. You're building.",
  "It doesn't take 100 yeses. It takes one.",
  "The offer exists. You just haven't found it yet.",
];
function getDailyQuote(): string {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return QUOTES[day % QUOTES.length];
}

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: "Today",   value: 1  },
  { label: "3 Days",  value: 3  },
  { label: "7 Days",  value: 7  },
  { label: "30 Days", value: 30 },
];

// NoteCell isolated so parent doesn't re-render on every keystroke
function NoteCell({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(initial);
  useEffect(() => { setVal(initial); }, [initial]);
  return (
    <textarea
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      placeholder="Add a note about this application..."
      rows={2}
      className="w-full rounded border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LatestJobsPage() {
  const [jobs, setJobs]             = useState<Job[]>([]);
  const [companyMap, setCompanyMap] = useState<CompanyMap>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [exporting, setExporting]   = useState(false);

  const [range, setRange]                   = useState<Range>(7);
  const [selectedDate, setSelectedDate]     = useState<string | null>(null); // null = All
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [compact, setCompact]               = useState(false);

  const [companyAsc, setCompanyAsc]     = useState(true);
  const [postedAsc, setPostedAsc]       = useState(false);
  const [sortByPosted, setSortByPosted] = useState(true);

  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(20);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  const { statuses, setStatus, getStatus, getNote, setNote } = useJobTracker();
  const lastVisit = useLastVisit();
  const quote = useMemo(() => getDailyQuote(), []);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async function fetchJobs(r: Range = range) {
    setLoading(true);
    setError(null);

    const from = new Date();
    from.setDate(from.getDate() - (r - 1));
    from.setHours(0, 0, 0, 0);

    const { data: jobsData, error: jobsErr } = await supabase
      .from("jobs")
      .select("id, title, posting_url, posted_at, first_seen_at, job_id, locations, company_id")
      .gte("posted_at", from.toISOString())
      .order("posted_at", { ascending: false });

    if (jobsErr) {
      setError("Failed to load jobs. Please try again.");
      setLoading(false);
      return;
    }

    if (!jobsData || jobsData.length === 0) {
      setJobs([]);
      setCompanyMap({});
      setLoading(false);
      return;
    }

    setJobs(jobsData as Job[]);

    const companyIds = Array.from(new Set(jobsData.map(j => j.company_id)));
    const { data: companies } = await supabase
      .from("companies").select("id, name").in("id", companyIds);

    if (companies) {
      const map: CompanyMap = {};
      companies.forEach(c => (map[c.id] = c.name));
      setCompanyMap(map);
    }

    setPage(1);
    setLoading(false);
  }

  useEffect(() => {
    setSelectedDate(null); // clear day selection when range changes
    fetchJobs(range);
  }, [range]);

  // ── Export CSV ────────────────────────────────────────────────────────────

  async function exportApplied() {
    const stored = localStorage.getItem("jobhunt_status");
    const statusMap: Record<string, string> = stored ? JSON.parse(stored) : {};
    const ids = Object.keys(statusMap);
    if (ids.length === 0) { alert("No tracked jobs to export yet."); return; }

    setExporting(true);
    const { data: jobsData } = await supabase
      .from("jobs")
      .select("id, title, posting_url, posted_at, job_id, locations, company_id")
      .in("id", ids);

    if (!jobsData?.length) { setExporting(false); alert("Could not fetch job details."); return; }

    const companyIds = Array.from(new Set(jobsData.map(j => j.company_id)));
    const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIds);
    const cMap: Record<string, string> = {};
    companies?.forEach(c => (cMap[c.id] = c.name));

    const notesRaw = localStorage.getItem("jobhunt_notes");
    const notesMap: Record<string, string> = notesRaw ? JSON.parse(notesRaw) : {};

    const headers = ["Company", "Title", "Job ID", "Status", "Location", "Posted Date", "Job URL", "Notes"];
    const rows = jobsData.map(j => [
      cMap[j.company_id] ?? "",
      j.title,
      j.job_id ?? "",
      STATUS_META[statusMap[j.id] as JobStatus]?.label ?? statusMap[j.id] ?? "",
      fmtLocation(j.locations),
      j.posted_at ? new Date(j.posted_at).toLocaleDateString() : "",
      j.posting_url,
      notesMap[j.id] ?? "",
    ]);

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(c => esc(String(c))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-tracker-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  // ── Day strip data ────────────────────────────────────────────────────────

  /** Count of jobs per local date across the full fetched window */
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach(j => {
      const d = toLocalDate(j.posted_at);
      counts[d] = (counts[d] ?? 0) + 1;
    });
    return counts;
  }, [jobs]);

  /** Ordered pills: oldest → newest, one per day in the range */
  const dayPills = useMemo(() => {
    const pills: { date: string; count: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const date = addDays(todayISO(), -i);
      pills.push({ date, count: dayCounts[date] ?? 0 });
    }
    return pills;
  }, [range, dayCounts]);

  /** Today's total from the full unfiltered window — fixed reference point */
  const todayTotal = useMemo(
    () => dayCounts[todayISO()] ?? 0,
    [dayCounts]
  );

  // ── Location options ──────────────────────────────────────────────────────

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => {
      if (!j.locations) return;
      const locs = Array.isArray(j.locations) ? j.locations : [j.locations];
      locs.forEach(l => typeof l === "string" && l.trim() && set.add(l.trim()));
    });
    return [...set].sort();
  }, [jobs]);

  // ── Filter + Sort ─────────────────────────────────────────────────────────

  const filteredJobs = useMemo(() => {
    let data = jobs;

    if (selectedDate) {
      data = data.filter(j => toLocalDate(j.posted_at) === selectedDate);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(j => {
        const co = companyMap[j.company_id]?.toLowerCase() ?? "";
        return co.includes(q) || j.title.toLowerCase().includes(q) ||
          (j.job_id?.toLowerCase() ?? "").includes(q) ||
          fmtLocation(j.locations).toLowerCase().includes(q);
      });
    }

    if (locationFilter) {
      data = data.filter(j => fmtLocation(j.locations).includes(locationFilter));
    }

    if (statusFilter === "not_tracked") {
      data = data.filter(j => !(j.id in statuses));
    } else if (statusFilter !== "all") {
      data = data.filter(j => statuses[j.id] === statusFilter);
    }

    return data;
  }, [jobs, companyMap, selectedDate, search, locationFilter, statusFilter, statuses]);

  /** Stats derived from filteredJobs — update whenever the day strip / filters change */
  const stats = useMemo(() => ({
    showing:   filteredJobs.length,
    companies: new Set(filteredJobs.map(j => j.company_id)).size,
    tracked:   filteredJobs.filter(j => j.id in statuses).length,
  }), [filteredJobs, statuses]);

  const sortedJobs = useMemo(() => {
    const data = [...filteredJobs];
    if (sortByPosted) {
      return data.sort((a, b) => {
        const da = new Date(a.posted_at).getTime(), db = new Date(b.posted_at).getTime();
        return postedAsc ? da - db : db - da;
      });
    }
    return data.sort((a, b) => {
      const an = companyMap[a.company_id] ?? "", bn = companyMap[b.company_id] ?? "";
      return companyAsc ? an.localeCompare(bn) : bn.localeCompare(an);
    });
  }, [filteredJobs, companyMap, companyAsc, postedAsc, sortByPosted]);

  const totalPages    = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const paginatedJobs = sortedJobs.slice((page - 1) * pageSize, page * pageSize);
  const cellPad       = compact ? "px-4 py-1.5" : "px-4 py-3";
  const hasFilters    = !!search || !!locationFilter || statusFilter !== "all";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800 dark:text-slate-100 mb-1">Latest Jobs</h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm italic">"{quote}"</p>
          </div>
          <button
            onClick={exportApplied}
            disabled={exporting}
            className="shrink-0 mt-1 flex items-center gap-2 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-60 transition-colors"
          >
            {exporting ? "Exporting..." : "↓ Export CSV"}
          </button>
        </div>

        {/* Stats bar — always reflects current day/filter selection */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {/* Card 1: context-aware label */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {selectedDate ? shortDate(selectedDate) : "In Range"}
              </p>
              <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{stats.showing}</p>
            </div>

            {/* Card 2: today's count — fixed reference, never changes with selection */}
            <div className="rounded-xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Today</p>
              <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{todayTotal}</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Companies</p>
              <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{stats.companies}</p>
            </div>

            <div className="rounded-xl border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tracked</p>
              <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400">{stats.tracked}</p>
            </div>
          </div>
        )}

        {/* Controls: Range + Search + Density */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setRange(opt.value); setPage(1); }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  range === opt.value
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >{opt.label}</button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search company, title, job ID, or location..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-60 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
          />

          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            <button onClick={() => setCompact(false)} title="Comfortable"
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!compact ? "bg-slate-700 dark:bg-slate-500 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
            >▣</button>
            <button onClick={() => setCompact(true)} title="Compact"
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${compact ? "bg-slate-700 dark:bg-slate-500 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
            >▤</button>
          </div>
        </div>

        {/* Day Strip — replaces date picker entirely */}
        {!loading && !error && (
          <div className="mb-3">
            <div className="flex gap-2 overflow-x-auto pb-1 scroll-smooth" style={{ scrollbarWidth: "none" }}>

              {/* All pill */}
              <button
                onClick={() => { setSelectedDate(null); setPage(1); }}
                className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  !selectedDate
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600"
                }`}
              >
                <span className="text-xs leading-none mb-1 font-normal opacity-80">All</span>
                <span className="text-base font-semibold leading-none">{jobs.length}</span>
              </button>

              {/* Day pills */}
              {dayPills.map(({ date, count }) => {
                const isToday    = date === todayISO();
                const isSelected = selectedDate === date;
                const hasJobs    = count > 0;

                return (
                  <button
                    key={date}
                    onClick={() => { setSelectedDate(isSelected ? null : date); setPage(1); }}
                    disabled={!hasJobs}
                    className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : isToday && hasJobs
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-500"
                        : hasJobs
                        ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600"
                        : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <span className={`text-xs leading-none mb-1 ${isSelected ? "opacity-80" : "font-normal"}`}>
                      {pillLabel(date)}
                    </span>
                    <span className="text-base font-semibold leading-none">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls Row 2: Status + Location + Rows + Page info */}
        <div className="flex flex-wrap items-center gap-3 mb-4">

          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            {([
              { label: "All",         value: "all"         },
              { label: "Not Tracked", value: "not_tracked" },
              ...Object.entries(STATUS_META).map(([k, v]) => ({ label: v.label, value: k })),
            ] as { label: string; value: StatusFilter }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >{opt.label}</button>
            ))}
          </div>

          {locationOptions.length > 0 && (
            <select
              value={locationFilter}
              onChange={e => { setLocationFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="">All Locations</option>
              {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}

          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
              >
                {[10, 20, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <span>{sortedJobs.length} result{sortedJobs.length !== 1 ? "s" : ""} · Page {page}/{totalPages}</span>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-16 text-center text-slate-500 dark:text-slate-400 shadow-sm">
            Loading jobs...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-10 text-center shadow-sm">
            <p className="text-red-600 dark:text-red-400 mb-3">{error}</p>
            <button
              onClick={() => fetchJobs()}
              className="rounded-md border border-red-300 dark:border-red-700 px-4 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
            >Retry</button>
          </div>
        )}

        {!loading && !error && sortedJobs.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-16 text-center shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              {selectedDate && !hasFilters
                ? `No jobs posted on ${shortDate(selectedDate)}.`
                : "No jobs match your filters."}
            </p>
            {(selectedDate || hasFilters) && (
              <button
                onClick={() => { setSearch(""); setSelectedDate(null); setLocationFilter(""); setStatusFilter("all"); setPage(1); }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >Clear all filters</button>
            )}
          </div>
        )}

        {/* Table */}
        {!loading && !error && paginatedJobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 sticky top-0 z-10">
                <tr>
                  <th
                    className={`${cellPad} text-left font-medium cursor-pointer select-none whitespace-nowrap`}
                    onClick={() => { setSortByPosted(false); setCompanyAsc(!companyAsc); setPage(1); }}
                  >
                    Company {!sortByPosted ? (companyAsc ? "↑" : "↓") : <span className="text-slate-400">⇅</span>}
                  </th>
                  <th className={`${cellPad} text-left font-medium`}>Title</th>
                  <th className={`${cellPad} text-left font-medium whitespace-nowrap`}>Job ID</th>
                  <th className={`${cellPad} text-left font-medium`}>Location</th>
                  <th
                    className={`${cellPad} text-left font-medium cursor-pointer select-none whitespace-nowrap`}
                    onClick={() => { setSortByPosted(true); setPostedAsc(!postedAsc); setPage(1); }}
                  >
                    Posted {sortByPosted ? (postedAsc ? "↑" : "↓") : <span className="text-slate-400">⇅</span>}
                  </th>
                  <th className={`${cellPad} text-left font-medium`}>Status</th>
                  <th className={`${cellPad} text-left font-medium`}>Note</th>
                  <th className={`${cellPad} text-left font-medium`}>Link</th>
                </tr>
              </thead>
              <tbody>
                {paginatedJobs.map(job => {
                  const status     = getStatus(job.id);
                  const statusMeta = status ? STATUS_META[status] : null;
                  const isNew      = lastVisit !== null && new Date(job.first_seen_at) > lastVisit;
                  const hasNote    = !!getNote(job.id);
                  const noteOpen   = openNoteId === job.id;

                  const rowBg = status === "rejected"
                    ? "bg-slate-50 dark:bg-slate-800/50 opacity-70"
                    : status === "offer"
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/40";

                  return (
                    <React.Fragment key={job.id}>
                      <tr className={`border-b border-slate-100 dark:border-slate-700 transition-colors ${rowBg}`}>
                        <td className={`${cellPad} whitespace-nowrap`}>
                          <div className="flex items-center gap-2">
                            {isNew && (
                              <span className="rounded-full bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">NEW</span>
                            )}
                            <Link href={`/companies/${job.company_id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {companyMap[job.company_id] ?? "Unknown"}
                            </Link>
                          </div>
                        </td>
                        <td className={`${cellPad} font-medium text-slate-800 dark:text-slate-100`}>{job.title}</td>
                        <td className={`${cellPad} text-slate-500 dark:text-slate-400`}>{job.job_id ?? "-"}</td>
                        <td className={`${cellPad} text-slate-600 dark:text-slate-300`}>{fmtLocation(job.locations)}</td>
                        <td className={`${cellPad} whitespace-nowrap ${freshnessClass(job.posted_at)}`}>
                          {fmtDateTime(job.posted_at)}
                        </td>
                        <td className={`${cellPad}`}>
                          <select
                            value={status ?? ""}
                            onChange={e => setStatus(job.id, (e.target.value || null) as JobStatus | null)}
                            className={`rounded-md border px-2 py-1 text-xs font-medium cursor-pointer focus:outline-none transition-colors ${
                              statusMeta
                                ? `${statusMeta.light} ${statusMeta.dark}`
                                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            <option value="">Not Tracked</option>
                            {Object.entries(STATUS_META).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className={`${cellPad}`}>
                          <button
                            onClick={() => setOpenNoteId(noteOpen ? null : job.id)}
                            title={hasNote ? getNote(job.id) : "Add note"}
                            className={`rounded-md px-2 py-1 text-xs border transition-colors ${
                              hasNote
                                ? "border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                                : "border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-500"
                            }`}
                          >
                            {hasNote ? "📝" : "+ Note"}
                          </button>
                        </td>
                        <td className={`${cellPad}`}>
                          <a
                            href={job.posting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                          >View ↗</a>
                        </td>
                      </tr>

                      {noteOpen && (
                        <tr className="border-b border-slate-100 dark:border-slate-700">
                          <td colSpan={8} className="px-4 pb-3 pt-1 bg-yellow-50/50 dark:bg-yellow-900/10">
                            <NoteCell initial={getNote(job.id)} onSave={v => setNote(job.id, v)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-5 flex justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
          >← Prev</button>
          <button
            disabled={page >= totalPages || sortedJobs.length === 0}
            onClick={() => setPage(p => p + 1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
          >Next →</button>
        </div>

      </div>
    </main>
  );
}
