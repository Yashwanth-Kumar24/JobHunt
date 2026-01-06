"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Job = {
  title: string;
  posting_url: string;
  posted_at: string;
  job_id: string | null;
  locations: any | null;
  company_id: string;
};

type CompanyMap = Record<string, string>;

export default function TodaysJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyMap, setCompanyMap] = useState<CompanyMap>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [companyAsc, setCompanyAsc] = useState(true);
  const [postedAsc, setPostedAsc] = useState(false);
  const [sortByPosted, setSortByPosted] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function loadData() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: jobsData } = await supabase
        .from("jobs")
        .select(`
          title,
          posting_url,
          posted_at,
          job_id,
          locations,
          company_id
        `)
        .gte("posted_at", today.toISOString())
        .order("posted_at", { ascending: false });

      if (!jobsData) {
        setLoading(false);
        return;
      }

      setJobs(jobsData as Job[]);

      const companyIds = Array.from(
        new Set(jobsData.map(j => j.company_id))
      );

      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);

      if (companies) {
        const map: CompanyMap = {};
        companies.forEach(c => {
          map[c.id] = c.name;
        });
        setCompanyMap(map);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // 🔍 SEARCH
  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;

    const q = search.toLowerCase();

    return jobs.filter(j => {
      const company = companyMap[j.company_id]?.toLowerCase() || "";
      const title = j.title.toLowerCase();
      const jobId = j.job_id?.toLowerCase() || "";
      const location =
        typeof j.locations === "string"
          ? j.locations.toLowerCase()
          : Array.isArray(j.locations)
          ? j.locations.join(", ").toLowerCase()
          : "";

      return (
        company.includes(q) ||
        title.includes(q) ||
        jobId.includes(q) ||
        location.includes(q)
      );
    });
  }, [jobs, companyMap, search]);

  // 🔤 SORTING
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
      const aName = companyMap[a.company_id] || "";
      const bName = companyMap[b.company_id] || "";
      return companyAsc
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName);
    });
  }, [
    filteredJobs,
    companyMap,
    companyAsc,
    postedAsc,
    sortByPosted,
  ]);

  const totalPages = Math.ceil(sortedJobs.length / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedJobs = sortedJobs.slice(start, start + pageSize);

  function fmtDateTime(value: string) {
    return new Date(value).toLocaleString();
  }

  function fmtLocation(loc: any) {
    if (!loc) return "US";
    if (typeof loc === "string") return loc;
    if (Array.isArray(loc)) return loc.join(", ");
    return "Multiple locations";
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-slate-800 mb-2">
          Today’s Jobs
        </h1>
        <p className="text-slate-600 mb-6">
          All jobs posted today across companies
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <input
            type="text"
            placeholder="Search company, title, job ID, or location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-96 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200"
          />

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1"
            >
              {[10, 20, 30, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <span className="ml-auto text-sm text-slate-600">
            Page {page} of {totalPages || 1}
          </span>
        </div>

        {!loading && paginatedJobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer"
                    onClick={() => {
                      setSortByPosted(false);
                      setCompanyAsc(!companyAsc);
                    }}
                  >
                    Company {companyAsc ? "↑" : "↓"}
                  </th>
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
                    className="px-4 py-3 text-left font-medium cursor-pointer"
                    onClick={() => {
                      setSortByPosted(true);
                      setPostedAsc(!postedAsc);
                    }}
                  >
                    Posted {sortByPosted ? (postedAsc ? "↑" : "↓") : ""}
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedJobs.map((job, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/companies/${job.company_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {companyMap[job.company_id] || "Unknown"}
                      </Link>
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {job.title}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {job.job_id ?? "-"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      <Link
                        href={job.posting_url}
                        className="text-blue-600 hover:underline"
                      >
                        View Job
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {fmtLocation(job.locations)}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {fmtDateTime(job.posted_at)}
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
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm disabled:opacity-50"
          >
            Prev
          </button>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
