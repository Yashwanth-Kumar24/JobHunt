"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useJobTracker, STATUS_META, type JobStatus } from "@/lib/useJobTracker";

type Job = {
  id: string;
  title: string;
  posting_url: string;
  posted_at: string | null;
  job_id: string | null;
  locations: any | null;
};

function fmtLocation(loc: any): string {
  if (!loc) return "US";
  if (typeof loc === "string") return loc;
  if (Array.isArray(loc)) return loc.join(", ");
  return "US";
}

function fmt(v: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString();
}

function daysSince(v: string | null): number {
  if (!v) return 999;
  return Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000);
}

function freshnessClass(posted_at: string | null): string {
  const d = daysSince(posted_at);
  if (d === 0) return "text-green-600 dark:text-green-400 font-semibold";
  if (d <= 2)  return "text-slate-700 dark:text-slate-200";
  if (d <= 7)  return "text-slate-500 dark:text-slate-400";
  return "text-slate-400 dark:text-slate-500";
}

function NoteCell({ jobId, initial, onSave }: { jobId: string; initial: string; onSave: (v: string) => void }) {
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

export default function JobsPage() {
  const params = useParams();
  const companyId = typeof params?.id === "string" ? params.id : null;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [ascending, setAscending] = useState(false);
  const [compact, setCompact] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  const { statuses, notes, setStatus, setNote, getStatus, getNote } = useJobTracker();

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("name").eq("id", companyId).single()
      .then(({ data }) => { if (data?.name) setCompanyName(data.name); });
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    supabase
      .from("jobs")
      .select("id, title, posting_url, posted_at, job_id, locations")
      .eq("company_id", companyId)
      .order("posted_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError("Failed to load jobs. Please try again.");
        else if (data) { setJobs(data); setPage(1); }
        setLoading(false);
      });
  }, [companyId]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => {
      if (!j.locations) return;
      const locs = Array.isArray(j.locations) ? j.locations : [j.locations];
      locs.forEach(l => typeof l === "string" && l.trim() && set.add(l.trim()));
    });
    return [...set].sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let data = jobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(j =>
        j.title.toLowerCase().includes(q) ||
        (j.job_id?.toLowerCase() ?? "").includes(q) ||
        fmtLocation(j.locations).toLowerCase().includes(q)
      );
    }
    if (locationFilter) {
      data = data.filter(j => fmtLocation(j.locations).includes(locationFilter));
    }
    return data;
  }, [jobs, search, locationFilter]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      if (!a.posted_at && !b.posted_at) return 0;
      if (!a.posted_at) return 1;
      if (!b.posted_at) return -1;
      const diff = new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime();
      return ascending ? diff : -diff;
    });
  }, [filteredJobs, ascending]);

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const paginatedJobs = sortedJobs.slice((page - 1) * pageSize, page * pageSize);

  const trackedCount = useMemo(() => jobs.filter(j => j.id in statuses).length, [jobs, statuses]);
  const cellPad = compact ? "px-4 py-1.5" : "px-4 py-3";

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors">
      <div className="max-w-7xl mx-auto">

        {/* Back nav */}
        <Link href="/companies" className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4 transition-colors">
          ← Back to Companies
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-800 dark:text-slate-100 mb-1">
            {companyName || "Company Jobs"}
          </h1>
          {!loading && !error && (
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {jobs.length} total role{jobs.length !== 1 ? "s" : ""}
              {trackedCount > 0 && (
                <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium">· {trackedCount} tracked</span>
              )}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search title, job ID, or location..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full sm:w-72 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
          />

          {locationOptions.length > 0 && (
            <select value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="">All Locations</option>
              {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}

          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            <button onClick={() => setCompact(false)} title="Comfortable"
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!compact ? "bg-slate-700 dark:bg-slate-500 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
            >▣</button>
            <button onClick={() => setCompact(true)} title="Compact"
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${compact ? "bg-slate-700 dark:bg-slate-500 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
            >▤</button>
          </div>

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
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-10 text-center text-red-600 dark:text-red-400 shadow-sm">
            {error}
          </div>
        )}
        {!loading && !error && sortedJobs.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-16 text-center text-slate-500 dark:text-slate-400 shadow-sm">
            {search || locationFilter ? "No jobs match your filters." : "No jobs found for this company."}
          </div>
        )}

        {/* Table */}
        {!loading && !error && paginatedJobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 sticky top-0 z-10">
                <tr>
                  <th className={`${cellPad} text-left font-medium`}>Title</th>
                  <th className={`${cellPad} text-left font-medium whitespace-nowrap`}>Job ID</th>
                  <th className={`${cellPad} text-left font-medium`}>Location</th>
                  <th className={`${cellPad} text-left font-medium cursor-pointer select-none whitespace-nowrap`}
                    onClick={() => { setAscending(a => !a); setPage(1); }}
                  >
                    Posted {ascending ? "↑" : "↓"}
                  </th>
                  <th className={`${cellPad} text-left font-medium`}>Status</th>
                  <th className={`${cellPad} text-left font-medium`}>Note</th>
                  <th className={`${cellPad} text-left font-medium`}>Link</th>
                </tr>
              </thead>
              <tbody>
                {paginatedJobs.map(job => {
                  const status = getStatus(job.id);
                  const meta = status ? STATUS_META[status] : null;
                  const hasNote = !!notes[job.id];
                  const noteOpen = openNoteId === job.id;
                  const rowBg = status === "rejected"
                    ? "opacity-60 dark:opacity-50"
                    : status === "offer"
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/40";

                  return (
                    <>
                      <tr key={job.id} className={`border-b border-slate-100 dark:border-slate-700 transition-colors ${rowBg}`}>
                        <td className={`${cellPad} font-medium text-slate-800 dark:text-slate-100`}>{job.title}</td>
                        <td className={`${cellPad} text-slate-500 dark:text-slate-400`}>{job.job_id ?? "-"}</td>
                        <td className={`${cellPad} text-slate-600 dark:text-slate-300`}>{fmtLocation(job.locations)}</td>
                        <td className={`${cellPad} whitespace-nowrap ${freshnessClass(job.posted_at)}`}>{fmt(job.posted_at)}</td>
                        <td className={`${cellPad}`}>
                          <select
                            value={status ?? ""}
                            onChange={e => setStatus(job.id, (e.target.value || null) as JobStatus | null)}
                            className={`rounded-md border px-2 py-1 text-xs font-medium cursor-pointer focus:outline-none transition-colors ${
                              meta ? `${meta.light} ${meta.dark}` : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400"
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
                            title={hasNote ? notes[job.id] : "Add note"}
                            className={`rounded-md px-2 py-1 text-xs border transition-colors ${
                              hasNote
                                ? "border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                                : "border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-slate-300"
                            }`}
                          >{hasNote ? "📝" : "+ Note"}</button>
                        </td>
                        <td className={`${cellPad}`}>
                          <a href={job.posting_url} target="_blank" rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                          >Open ↗</a>
                        </td>
                      </tr>

                      {noteOpen && (
                        <tr key={`${job.id}-note`} className="border-b border-slate-100 dark:border-slate-700">
                          <td colSpan={7} className="px-4 pb-3 pt-1 bg-yellow-50/50 dark:bg-yellow-900/10">
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
