"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single()
      .then(({ data }) => {
        if (data?.name) setCompanyName(data.name);
      });
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
        if (err) {
          setError("Failed to load jobs. Please try again.");
        } else if (data) {
          setJobs(data);
          setPage(1);
        }
        setLoading(false);
      });
  }, [companyId]);

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(j => {
      const title = j.title.toLowerCase();
      const jobId = j.job_id?.toLowerCase() ?? "";
      const location = fmtLocation(j.locations).toLowerCase();
      return title.includes(q) || jobId.includes(q) || location.includes(q);
    });
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
  const start = (page - 1) * pageSize;
  const paginatedJobs = sortedJobs.slice(start, start + pageSize);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-slate-800 mb-2">
          {companyName ? `${companyName} Jobs` : "Jobs"}
        </h1>
        <p className="text-slate-600 mb-6">
          Browse open positions for this company
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <input
            type="text"
            placeholder="Search title, job ID, or location..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-80 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {[10, 20, 30, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
        </div>

        {/* States */}
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
            Loading jobs...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-600 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && sortedJobs.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
            {search ? "No jobs match your search." : "No jobs found for this company."}
          </div>
        )}

        {/* Table */}
        {!loading && !error && paginatedJobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Job ID</th>
                  <th className="px-4 py-3 text-left font-medium">Link</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                    onClick={() => {
                      setAscending(a => !a);
                      setPage(1);
                    }}
                  >
                    Posted On {ascending ? "↑" : "↓"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedJobs.map(job => (
                  <tr
                    key={job.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {job.title}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {job.job_id ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={job.posting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Open
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmtLocation(job.locations)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmt(job.posted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages || sortedJobs.length === 0}
            onClick={() => setPage(p => p + 1)}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
