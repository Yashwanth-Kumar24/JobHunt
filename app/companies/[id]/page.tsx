"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useApplied } from "@/lib/useApplied";

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

function fmt(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function JobsPage() {
  const params = useParams();
  const companyId = typeof params?.id === "string" ? params.id : null;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [ascending, setAscending] = useState(false);
  const [compact, setCompact] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { toggle, isApplied } = useApplied();

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single()
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

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      (j.job_id?.toLowerCase() ?? "").includes(q) ||
      fmtLocation(j.locations).toLowerCase().includes(q)
    );
  }, [jobs, search]);

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

  const appliedCount = useMemo(
    () => jobs.filter(j => isApplied(j.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs, isApplied]
  );

  const cellPad = compact ? "px-4 py-1.5" : "px-4 py-3";

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Back nav */}
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 mb-4 transition-colors"
        >
          ← Back to Companies
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-800 mb-1">
            {companyName || "Company Jobs"}
          </h1>
          {!loading && !error && (
            <p className="text-slate-500 text-sm">
              {jobs.length} total role{jobs.length !== 1 ? "s" : ""}
              {appliedCount > 0 && (
                <span className="ml-2 text-green-600 font-medium">· {appliedCount} applied</span>
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
            className="w-full sm:w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
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

          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none"
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
          <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center text-red-600 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && sortedJobs.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-slate-500 shadow-sm">
            {search ? "No jobs match your search." : "No jobs found for this company."}
          </div>
        )}

        {/* Table */}
        {!loading && !error && paginatedJobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                <tr>
                  <th className={`${cellPad} text-left font-medium`}>Title</th>
                  <th className={`${cellPad} text-left font-medium whitespace-nowrap`}>Job ID</th>
                  <th className={`${cellPad} text-left font-medium`}>Link</th>
                  <th className={`${cellPad} text-left font-medium`}>Location</th>
                  <th
                    className={`${cellPad} text-left font-medium cursor-pointer select-none whitespace-nowrap`}
                    onClick={() => { setAscending(a => !a); setPage(1); }}
                  >
                    Posted On {ascending ? "↑" : "↓"}
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
                      <td className={`${cellPad} font-medium text-slate-800`}>{job.title}</td>
                      <td className={`${cellPad} text-slate-500`}>{job.job_id ?? "-"}</td>
                      <td className={`${cellPad}`}>
                        <a
                          href={job.posting_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Open ↗
                        </a>
                      </td>
                      <td className={`${cellPad} text-slate-600`}>{fmtLocation(job.locations)}</td>
                      <td className={`${cellPad} text-slate-500`}>{fmt(job.posted_at)}</td>
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
