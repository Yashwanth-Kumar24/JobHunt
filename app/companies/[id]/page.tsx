"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Job = {
  title: string;
  posting_url: string;
  posted_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

type SortField = "posted_at" | "first_seen_at" | "last_seen_at";

export default function JobsPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [sortField, setSortField] = useState<SortField>("posted_at");
  const [ascending, setAscending] = useState(false);

  // pagination state
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
        first_seen_at,
        last_seen_at
      `)
      .eq("company_id", companyId)
      .order("posted_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setJobs(data);
          setPage(1); // reset page on reload
        }
      });
  }, [companyId]);

  // sorting
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

  // pagination math
  const totalPages = Math.ceil(sortedJobs.length / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedJobs = sortedJobs.slice(start, end);

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setAscending(!ascending);
    } else {
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
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Jobs</h1>



      <table className="w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Title</th>
            <th className="p-2 border">Link</th>

            <th
              className="p-2 border cursor-pointer select-none"
              onClick={() => toggleSort("posted_at")}
            >
              Posted {sortIcon("posted_at")}
            </th>

            <th
              className="p-2 border cursor-pointer select-none"
              onClick={() => toggleSort("first_seen_at")}
            >
              First Seen {sortIcon("first_seen_at")}
            </th>

            <th
              className="p-2 border cursor-pointer select-none"
              onClick={() => toggleSort("last_seen_at")}
            >
              Last Seen {sortIcon("last_seen_at")}
            </th>
          </tr>
        </thead>

        <tbody>
          {paginatedJobs.map((job, idx) => (
            <tr key={idx}>
              <td className="p-2 border">{job.title}</td>
              <td className="p-2 border">
                <a
                  href={job.posting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open
                </a>
              </td>
              <td className="p-2 border">{fmt(job.posted_at)}</td>
              <td className="p-2 border">{fmt(job.first_seen_at)}</td>
              <td className="p-2 border">{fmt(job.last_seen_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
           {/* Pagination controls */}
      <div className="flex items-center gap-4 mb-4">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="border p-1"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={30}>30</option>
        </select>

        <span className="ml-auto">
          Page {page} of {totalPages || 1}
        </span>
      </div>
      
      {/* Pagination buttons */}
      <div className="flex gap-2 mt-4">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="border px-3 py-1 disabled:opacity-50"
        >
          Prev
        </button>

        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
          className="border px-3 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </main>
  );
}
