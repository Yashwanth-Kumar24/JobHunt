"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useJobTracker, STATUS_META, type JobStatus } from "@/lib/useJobTracker";

type TrackedJob = {
  id: string;
  title: string;
  posting_url: string;
  posted_at: string | null;
  job_id: string | null;
  locations: any | null;
  company_id: string;
  company_name: string;
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

// Isolated note cell to avoid full re-render on keystroke
function NoteCell({ jobId, initial, onSave }: { jobId: string; initial: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(initial);
  useEffect(() => { setVal(initial); }, [initial]);
  return (
    <textarea
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      placeholder="Notes..."
      rows={2}
      className="w-full rounded border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
    />
  );
}

const STATUS_ORDER: (JobStatus | "all")[] = ["all", "applied", "screening", "interview", "offer", "rejected"];

export default function AppliedPage() {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const { statuses, notes, setStatus, setNote, getNote } = useJobTracker();

  // Reload tracked jobs whenever statuses change (new additions)
  const trackedIds = useMemo(() => Object.keys(statuses), [statuses]);

  useEffect(() => {
    if (trackedIds.length === 0) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    supabase
      .from("jobs")
      .select("id, title, posting_url, posted_at, job_id, locations, company_id")
      .in("id", trackedIds)
      .then(async ({ data, error: err }) => {
        if (err) { setError("Failed to load tracked jobs."); setLoading(false); return; }
        if (!data?.length) { setJobs([]); setLoading(false); return; }

        const companyIds = Array.from(new Set(data.map(j => j.company_id)));
        const { data: companies } = await supabase
          .from("companies").select("id, name").in("id", companyIds);

        const cMap: Record<string, string> = {};
        companies?.forEach(c => (cMap[c.id] = c.name));

        setJobs(data.map(j => ({ ...j, company_name: cMap[j.company_id] ?? "Unknown" })));
        setLoading(false);
      });
  }, [trackedIds.join(",")]);

  // Pipeline counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    jobs.forEach(j => {
      const s = statuses[j.id];
      if (s) c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [jobs, statuses]);

  const filteredJobs = useMemo(() => {
    let data = jobs;

    if (statusFilter !== "all") {
      data = data.filter(j => statuses[j.id] === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(j =>
        j.company_name.toLowerCase().includes(q) ||
        j.title.toLowerCase().includes(q) ||
        fmtLocation(j.locations).toLowerCase().includes(q) ||
        (j.job_id?.toLowerCase() ?? "").includes(q)
      );
    }

    return [...data].sort((a, b) => {
      const av = a.posted_at ?? "", bv = b.posted_at ?? "";
      const diff = new Date(av).getTime() - new Date(bv).getTime();
      return sortAsc ? diff : -diff;
    });
  }, [jobs, statuses, statusFilter, search, sortAsc]);

  function removeJob(id: string) {
    setStatus(id, null);
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-800 dark:text-slate-100 mb-1">Application Tracker</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Track every stage of your job hunt</p>
        </div>

        {/* Pipeline summary cards */}
        {!loading && !error && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {STATUS_ORDER.map(s => {
              const meta = s === "all" ? null : STATUS_META[s];
              const count = counts[s] ?? 0;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-xl border p-3 text-left transition-all shadow-sm ${
                    statusFilter === s
                      ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  } bg-white dark:bg-slate-800`}
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 capitalize">{s === "all" ? "Total" : meta?.label}</p>
                  <p className={`text-xl font-semibold ${
                    s === "offer" ? "text-green-600 dark:text-green-400"
                    : s === "interview" ? "text-purple-600 dark:text-purple-400"
                    : s === "screening" ? "text-amber-600 dark:text-amber-400"
                    : s === "rejected" ? "text-slate-400 dark:text-slate-500"
                    : "text-slate-800 dark:text-slate-100"
                  }`}>{count}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search company, title, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
          />
          <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
            {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* States */}
        {loading && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-16 text-center text-slate-500 dark:text-slate-400 shadow-sm">
            Loading tracked jobs...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-10 text-center text-red-600 dark:text-red-400 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && trackedIds.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-16 text-center shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 mb-3">No applications tracked yet.</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              Go to <Link href="/latest" className="text-blue-600 dark:text-blue-400 hover:underline">Latest Jobs</Link> and set a status on any job to start tracking.
            </p>
          </div>
        )}

        {!loading && !error && trackedIds.length > 0 && filteredJobs.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-500 dark:text-slate-400 shadow-sm">
            No jobs match your filter.
          </div>
        )}

        {/* Table */}
        {!loading && !error && filteredJobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Company</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                    onClick={() => setSortAsc(a => !a)}
                  >
                    Posted {sortAsc ? "↑" : "↓"}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Link</th>
                  <th className="px-4 py-3 text-left font-medium">Note</th>
                  <th className="px-4 py-3 text-left font-medium">Remove</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => {
                  const status = statuses[job.id] as JobStatus | undefined;
                  const meta = status ? STATUS_META[status] : null;
                  const noteOpen = openNoteId === job.id;
                  const hasNote = !!notes[job.id];

                  return (
                    <>
                      <tr
                        key={job.id}
                        className={`border-b border-slate-100 dark:border-slate-700 transition-colors ${
                          status === "rejected" ? "opacity-60 dark:opacity-50" : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link href={`/companies/${job.company_id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {job.company_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{job.title}</td>
                        <td className="px-4 py-3">
                          <select
                            value={status ?? ""}
                            onChange={e => setStatus(job.id, (e.target.value || null) as JobStatus | null)}
                            className={`rounded-md border px-2 py-1 text-xs font-medium cursor-pointer focus:outline-none ${
                              meta ? `${meta.light} ${meta.dark}` : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            <option value="">Not Tracked</option>
                            {Object.entries(STATUS_META).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmtLocation(job.locations)}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{fmt(job.posted_at)}</td>
                        <td className="px-4 py-3">
                          <a href={job.posting_url} target="_blank" rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                          >Open ↗</a>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setOpenNoteId(noteOpen ? null : job.id)}
                            title={hasNote ? notes[job.id] : "Add note"}
                            className={`rounded-md px-2 py-1 text-xs border transition-colors ${
                              hasNote
                                ? "border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                                : "border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            {hasNote ? "📝" : "+ Note"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeJob(job.id)}
                            title="Remove from tracker"
                            className="rounded-md px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-red-300 dark:hover:border-red-700 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          >✕</button>
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

      </div>
    </main>
  );
}
