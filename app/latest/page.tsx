"use client";

import { useEffect, useMemo, useState } from "react";
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
type StatusFilter = "all" | JobStatus;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDate(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fmtLocation(loc: any): string {
  if (!loc) return "US";
  if (typeof loc === "string") return loc;
  if (Array.isArray(loc)) return loc.join(", ");
  return "US";
}
function fmtDateTime(value: string) {
  return new Date(value).toLocaleString();
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
function getDailyQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return QUOTES[day % QUOTES.length];
}

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: "Today", value: 1 },
  { label: "3 Days", value: 3 },
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
];

const STATUS_FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Not Tracked", value: "all" }, // handled separately below
  ...Object.entries(STATUS_META).map(([k, v]) => ({ label: v.label, value: k as JobStatus })),
];

// Note cell — isolated to avoid re-rendering the whole table on keystroke
function NoteCell({ jobId, initial, onSave }: { jobId: string; initial: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(initial);
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyMap, setCompanyMap] = useState<CompanyMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [range, setRange] = useState<Range>(30);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [statusFilter, setStatusFilter] = useState<StatusFilter | "not_tracked">("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [compact, setCompact] = useState(false);

  const [companyAsc, setCompanyAsc] = useState(true);
  const [postedAsc, setPostedAsc] = useState(false);
  const [sortByPosted, setSortByPosted] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
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

    if (jobsErr) { setError("Failed to load jobs. Please try again."); setLoading(false); return; }

    if (!jobsData || jobsData.length === 0) {
      setJobs([]); setCompanyMap({}); setLoading(false); return;
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

  useEffect(() => { fetchJobs(range); }, [range]);

  // ── Export applied CSV ────────────────────────────────────────────────────

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

  // ── Location options from actual job data ─────────────────────────────────

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => {
      if (!j.locations) return;
      const locs = Array.isArray(j.locations) ? j.locations : [j.locations];
      locs.forEach(l => typeof l === "string" && l.trim() && set.add(l.trim()));
    });
    return [...set].sort();
  }, [jobs]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const today = todayISO();
    const todayCount = jobs.filter(j => toLocalDate(j.posted_at) === today).length;
    const companiesCount = new Set(jobs.map(j => j.company_id)).size;
    const trackedCount = jobs.filter(j => j.id in statuses).length;
    return { total: jobs.length, today: todayCount, companies: companiesCount, tracked: trackedCount };
  }, [jobs, statuses]);

  // ── Filter + Sort ─────────────────────────────────────────────────────────

  const filteredJobs = useMemo(() => {
    let data = jobs;

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(j => {
        const co = companyMap[j.company_id]?.toLowerCase() ?? "";
        return co.includes(q) || j.title.toLowerCase().includes(q) ||
          (j.job_id?.toLowerCase() ?? "").includes(q) ||
          fmtLocation(j.locations).toLowerCase().includes(q);
      });
    }

    if (selectedDate) {
      data = data.filter(j => toLocalDate(j.posted_at) === selectedDate);
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
  }, [jobs, companyMap, search, selectedDate, locationFilter, statusFilter, statuses]);

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

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const paginatedJobs = sortedJobs.slice((page - 1) * pageSize, page * pageSize);
  const cellPad = compact ? "px-4 py-1.5" : "px-4 py-3";

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

        {/* Stats Bar */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {[
              { label: "In Range", value: stats.total, color: "text-slate-800 dark:text-slate-100" },
              { label: "Posted Today", value: stats.today, color: "text-blue-600 dark:text-blue-400" },
              { label: "Companies", value: stats.companies, color: "text-slate-800 dark:text-slate-100" },
              { label: "Tracked", value: stats.tracked, color: "text-purple-600 dark:text-purple-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
                <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Controls Row 1: Range + Search + Density */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            {RANGE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => { setRange(opt.value); setPage(1); }}
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

        {/* Controls Row 2: Date + Status filter + Location + Rows */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1">
            <button onClick={() => { setSelectedDate(addDays(selectedDate, -1)); setPage(1); }}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >←</button>
            <input type="date" value={selectedDate} max={todayISO()}
              onChange={e => { setSelectedDate(e.target.value); setPage(1); }}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
            />
            <button disabled={selectedDate >= todayISO()}
              onClick={() => { setSelectedDate(addDays(selectedDate, 1)); setPage(1); }}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
            >→</button>
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            {[
              { label: "All", value: "all" as const },
              { label: "Not Tracked", value: "not_tracked" as const },
              ...Object.entries(STATUS_META).map(([k, v]) => ({ label: v.label, value: k as JobStatus })),
            ].map(opt => (
              <button key={opt.value} onClick={() => { setStatusFilter(opt.value as any); setPage(1); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >{opt.label}</button>
            ))}
          </div>

          {/* Location filter */}
          {locationOptions.length > 0 && (
            <select value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="">All Locations</option>
              {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}

          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
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
            <button onClick={() => fetchJobs()}
              className="rounded-md border border-red-300 dark:border-red-700 px-4 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
            >Retry</button>
          </div>
        )}
        {!loading && !error && sortedJobs.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-16 text-center text-slate-500 dark:text-slate-400 shadow-sm">
            {search ? "No jobs match your search." : `No jobs found for ${selectedDate}.`}
          </div>
        )}

        {/* Table */}
        {!loading && !error && paginatedJobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 sticky top-0 z-10">
                <tr>
                  <th className={`${cellPad} text-left font-medium cursor-pointer select-none whitespace-nowrap`}
                    onClick={() => { setSortByPosted(false); setCompanyAsc(!companyAsc); setPage(1); }}
                  >
                    Company {!sortByPosted ? (companyAsc ? "↑" : "↓") : <span className="text-slate-400">⇅</span>}
                  </th>
                  <th className={`${cellPad} text-left font-medium`}>Title</th>
                  <th className={`${cellPad} text-left font-medium whitespace-nowrap`}>Job ID</th>
                  <th className={`${cellPad} text-left font-medium`}>Location</th>
                  <th className={`${cellPad} text-left font-medium cursor-pointer select-none whitespace-nowrap`}
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
                  const status = getStatus(job.id);
                  const statusMeta = status ? STATUS_META[status] : null;
                  const isNew = lastVisit !== null && new Date(job.first_seen_at) > lastVisit;
                  const hasNote = !!getNote(job.id);
                  const noteOpen = openNoteId === job.id;

                  const rowBg = status === "rejected"
                    ? "bg-slate-50 dark:bg-slate-800/50 opacity-70"
                    : status === "offer"
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/40";

                  return (
                    <>
                      <tr key={job.id} className={`border-b border-slate-100 dark:border-slate-700 transition-colors ${rowBg}`}>
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
                        <td className={`${cellPad} whitespace-nowrap ${freshnessClass(job.posted_at)}`}>{fmtDateTime(job.posted_at)}</td>
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
                          <a href={job.posting_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                          >View ↗</a>
                        </td>
                      </tr>

                      {noteOpen && (
                        <tr key={`${job.id}-note`} className="border-b border-slate-100 dark:border-slate-700">
                          <td colSpan={8} className="px-4 pb-3 pt-1 bg-yellow-50/50 dark:bg-yellow-900/10">
                            <NoteCell jobId={job.id} initial={getNote(job.id)} onSave={v => setNote(job.id, v)} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-5 flex justify-between">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
          >← Prev</button>
          <button disabled={page >= totalPages || sortedJobs.length === 0} onClick={() => setPage(p => p + 1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
          >Next →</button>
        </div>

      </div>
    </main>
  );
}
