"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useApplied } from "@/lib/useApplied";

type Job = {
  id: string;
  title: string;
  posting_url: string;
  posted_at: string;
  job_id: string | null;
  locations: any | null;
  company_id: string;
};

type CompanyMap = Record<string, string>;
type Range = 1 | 3 | 7 | 30;
type AppliedFilter = "all" | "applied" | "not_applied";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// Picks a quote based on day-of-year so it rotates daily
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
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return QUOTES[dayOfYear % QUOTES.length];
}

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: "Today", value: 1 },
  { label: "3 Days", value: 3 },
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
];

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
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter>("all");
  const [compact, setCompact] = useState(false);

  const [companyAsc, setCompanyAsc] = useState(true);
  const [postedAsc, setPostedAsc] = useState(false);
  const [sortByPosted, setSortByPosted] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { applied, toggle, isApplied } = useApplied();

  const quote = useMemo(() => getDailyQuote(), []);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  async function fetchJobs(r: Range = range) {
    setLoading(true);
    setError(null);

    const from = new Date();
    from.setDate(from.getDate() - (r - 1));
    from.setHours(0, 0, 0, 0);

    const { data: jobsData, error: jobsErr } = await supabase
      .from("jobs")
      .select("id, title, posting_url, posted_at, job_id, locations, company_id")
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
      .from("companies")
      .select("id, name")
      .in("id", companyIds);

    if (companies) {
      const map: CompanyMap = {};
      companies.forEach(c => (map[c.id] = c.name));
      setCompanyMap(map);
    }

    setPage(1);
    setLoading(false);
  }

  useEffect(() => { fetchJobs(range); }, [range]);

  // ── Export applied jobs as CSV ───────────────────────────────────────────────

  async function exportApplied() {
    const raw = localStorage.getItem("jobhunt_applied");
    const ids: string[] = raw ? JSON.parse(raw) : [];

    if (ids.length === 0) {
      alert("No applied jobs to export yet. Mark some jobs as applied first.");
      return;
    }

    setExporting(true);

    const { data: jobsData } = await supabase
      .from("jobs")
      .select("id, title, posting_url, posted_at, job_id, locations, company_id")
      .in("id", ids);

    if (!jobsData || jobsData.length === 0) {
      setExporting(false);
      alert("Could not fetch applied job details.");
      return;
    }

    const companyIds = Array.from(new Set(jobsData.map(j => j.company_id)));
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);

    const cMap: Record<string, string> = {};
    companies?.forEach(c => (cMap[c.id] = c.name));

    const headers = ["Company", "Title", "Job ID", "Location", "Posted Date", "Job URL"];
    const rows = jobsData.map(j => [
      cMap[j.company_id] ?? "",
      j.title,
      j.job_id ?? "",
      fmtLocation(j.locations),
      j.posted_at ? new Date(j.posted_at).toLocaleDateString() : "",
      j.posting_url,
    ]);

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows]
      .map(row => row.map(cell => escape(String(cell))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applied-jobs-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExporting(false);
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Stats from raw unfiltered jobs — today uses local date to match todayISO()
  const stats = useMemo(() => {
    const today = todayISO();
    const todayCount = jobs.filter(j => toLocalDate(j.posted_at) === today).length;
    const companiesCount = new Set(jobs.map(j => j.company_id)).size;
    const appliedCount = jobs.filter(j => applied.has(j.id)).length;
    return { total: jobs.length, today: todayCount, companies: companiesCount, appliedCount };
  }, [jobs, applied]);

  const filteredJobs = useMemo(() => {
    let data = jobs;

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(j => {
        const company = companyMap[j.company_id]?.toLowerCase() ?? "";
        const title = j.title.toLowerCase();
        const jobId = j.job_id?.toLowerCase() ?? "";
        const location = fmtLocation(j.locations).toLowerCase();
        return company.includes(q) || title.includes(q) || jobId.includes(q) || location.includes(q);
      });
    }

    if (selectedDate) {
      data = data.filter(j => toLocalDate(j.posted_at) === selectedDate);
    }

    if (appliedFilter === "applied") data = data.filter(j => applied.has(j.id));
    else if (appliedFilter === "not_applied") data = data.filter(j => !applied.has(j.id));

    return data;
  }, [jobs, companyMap, search, selectedDate, appliedFilter, applied]);

  const sortedJobs = useMemo(() => {
    const data = [...filteredJobs];
    if (sortByPosted) {
      return data.sort((a, b) => {
        const da = new Date(a.posted_at).getTime();
        const db = new Date(b.posted_at).getTime();
        return postedAsc ? da - db : db - da;
      });
    }
    return data.sort((a, b) => {
      const aName = companyMap[a.company_id] ?? "";
      const bName = companyMap[b.company_id] ?? "";
      return companyAsc ? aName.localeCompare(bName) : bName.localeCompare(aName);
    });
  }, [filteredJobs, companyMap, companyAsc, postedAsc, sortByPosted]);

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const paginatedJobs = sortedJobs.slice((page - 1) * pageSize, page * pageSize);

  const cellPad = compact ? "px-4 py-1.5" : "px-4 py-3";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-slate-800 mb-1">Latest Jobs</h1>
              <p className="text-slate-400 text-sm italic">"{quote}"</p>
            </div>
            <button
              onClick={exportApplied}
              disabled={exporting}
              className="shrink-0 mt-1 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-60 transition-colors"
            >
              {exporting ? "Exporting..." : "↓ Export Applied"}
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">In Range</p>
              <p className="text-2xl font-semibold text-slate-800">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Posted Today</p>
              <p className="text-2xl font-semibold text-blue-600">{stats.today}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Companies</p>
              <p className="text-2xl font-semibold text-slate-800">{stats.companies}</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Applied</p>
              <p className="text-2xl font-semibold text-green-600">{stats.appliedCount}</p>
            </div>
          </div>
        )}

        {/* Controls Row 1: Range + Search + Density */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setRange(opt.value); setPage(1); }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  range === opt.value
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search company, title, job ID, or location..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-60 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          {/* Density toggle */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setCompact(false)}
              title="Comfortable view"
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                !compact ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              ▣
            </button>
            <button
              onClick={() => setCompact(true)}
              title="Compact view"
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                compact ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              ▤
            </button>
          </div>
        </div>

        {/* Controls Row 2: Date nav + Applied filter + Rows + Page info */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSelectedDate(addDays(selectedDate, -1)); setPage(1); }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm hover:bg-slate-100"
            >
              ←
            </button>
            <input
              type="date"
              value={selectedDate}
              max={todayISO()}
              onChange={e => { setSelectedDate(e.target.value); setPage(1); }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none"
            />
            <button
              disabled={selectedDate >= todayISO()}
              onClick={() => { setSelectedDate(addDays(selectedDate, 1)); setPage(1); }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40"
            >
              →
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {(["all", "not_applied", "applied"] as AppliedFilter[]).map(f => (
              <button
                key={f}
                onClick={() => { setAppliedFilter(f); setPage(1); }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  appliedFilter === f
                    ? f === "applied"
                      ? "bg-green-600 text-white"
                      : f === "not_applied"
                      ? "bg-slate-700 text-white"
                      : "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f === "all" ? "All" : f === "applied" ? "Applied" : "Not Applied"}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              >
                {[10, 20, 30, 50, 100].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <span className="text-slate-500">
              {sortedJobs.length} result{sortedJobs.length !== 1 ? "s" : ""} · Page {page}/{totalPages}
            </span>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-slate-500 shadow-sm">
            Loading jobs...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center shadow-sm">
            <p className="text-red-600 mb-3">{error}</p>
            <button
              onClick={() => fetchJobs()}
              className="rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && sortedJobs.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-slate-500 shadow-sm">
            {search
              ? "No jobs match your search."
              : `No jobs found for ${selectedDate}.`}
          </div>
        )}

        {/* Table */}
        {!loading && !error && paginatedJobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                <tr>
                  <th
                    className={`${cellPad} text-left font-medium cursor-pointer select-none whitespace-nowrap`}
                    onClick={() => { setSortByPosted(false); setCompanyAsc(!companyAsc); setPage(1); }}
                  >
                    Company{" "}
                    {!sortByPosted
                      ? companyAsc ? "↑" : "↓"
                      : <span className="text-slate-400">⇅</span>}
                  </th>
                  <th className={`${cellPad} text-left font-medium`}>Title</th>
                  <th className={`${cellPad} text-left font-medium whitespace-nowrap`}>Job ID</th>
                  <th className={`${cellPad} text-left font-medium`}>Link</th>
                  <th className={`${cellPad} text-left font-medium`}>Location</th>
                  <th
                    className={`${cellPad} text-left font-medium cursor-pointer select-none whitespace-nowrap`}
                    onClick={() => { setSortByPosted(true); setPostedAsc(!postedAsc); setPage(1); }}
                  >
                    Posted{" "}
                    {sortByPosted
                      ? postedAsc ? "↑" : "↓"
                      : <span className="text-slate-400">⇅</span>}
                  </th>
                  <th className={`${cellPad} text-left font-medium`}>Applied</th>
                </tr>
              </thead>
              <tbody>
                {paginatedJobs.map(job => {
                  const wasApplied = isApplied(job.id);
                  return (
                    <tr
                      key={job.id}
                      className={`border-b border-slate-100 transition-colors ${
                        wasApplied ? "bg-green-50 hover:bg-green-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className={`${cellPad} whitespace-nowrap`}>
                        <Link
                          href={`/companies/${job.company_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {companyMap[job.company_id] ?? "Unknown"}
                        </Link>
                      </td>
                      <td className={`${cellPad} font-medium text-slate-800`}>{job.title}</td>
                      <td className={`${cellPad} text-slate-500`}>{job.job_id ?? "-"}</td>
                      <td className={`${cellPad}`}>
                        <a
                          href={job.posting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Job ↗
                        </a>
                      </td>
                      <td className={`${cellPad} text-slate-600`}>{fmtLocation(job.locations)}</td>
                      <td className={`${cellPad} text-slate-500 whitespace-nowrap`}>{fmtDateTime(job.posted_at)}</td>
                      <td className={`${cellPad}`}>
                        <button
                          onClick={() => toggle(job.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                            wasApplied
                              ? "border-green-400 bg-green-100 text-green-700 hover:bg-green-200"
                              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {wasApplied ? "✓ Applied" : "Mark Applied"}
                        </button>
                      </td>
                    </tr>
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
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            disabled={page >= totalPages || sortedJobs.length === 0}
            onClick={() => setPage(p => p + 1)}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Next →
          </button>
        </div>

      </div>
    </main>
  );
}
