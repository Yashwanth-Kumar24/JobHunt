"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Job = {
  title: string;
  posting_url: string;
  posted_at: string | null;
  job_id: string | null;
  locations: string | null;
};

type SortField = "posted_at";

export default function JobsPage() {
  const params = useParams();
  const companyId = typeof params?.id === "string" ? params.id : null;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [sortField, setSortField] = useState<SortField>("posted_at");
  const [ascending, setAscending] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!companyId) return;

    supabase
      .from("jobs")
      .select(`
        title,
        posting_url,
        posted_at,
        job_id,
        locations
      `)
      .eq("company_id", companyId)
      .order("posted_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setJobs(data);
          setPage(1);
        }
      });
  }, [companyId]);

  const sortedJobs = [...jobs].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (!aVal && !bVal) return 0;
    if (!aVal) return 1;
    if (!bVal) return -1;
    const diff =
      new Date(aVal).getTime() - new Date(bVal).getTime();
    return ascending ? diff : -diff;
  });

  const totalPages = Math.ceil(sortedJobs.length / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedJobs = sortedJobs.slice(start, start + pageSize);

  function toggleSort(field: SortField) {
    if (field === sortField) setAscending(!ascending);
    else {
      setSortField(field);
      setAscending(false);
    }
  }

  function sortIcon(field: SortField) {
    if (field !== sortField) return "⇅";
    return ascending ? "↑" : "↓";
  }

  function fmt(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-slate-800 mb-2">
          Jobs
        </h1>
        <p className="text-slate-600 mb-6">
          Browse open positions for this company
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </div>

          <span className="ml-auto text-sm text-slate-600">
            Page {page} of {totalPages || 1}
          </span>
        </div>

        {/* Table Card */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  Title
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Job ID
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Link
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Location
                </th>
                <th
                  className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                  onClick={() => toggleSort("posted_at")}
                >
                  Posted On {sortIcon("posted_at")}
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedJobs.map((job, idx) => (
                <tr
                  key={idx}
                  className="border-t border-slate-200 hover:bg-slate-50 transition"
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
                    {job.locations ?? "US"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {fmt(job.posted_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex justify-between">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Prev
          </button>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
