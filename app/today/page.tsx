"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Job = {
  title: string;
  posting_url: string;
  posted_at: string | null;
  job_id: string | null;
  locations: any | null;
  company_id: string;
};

type CompanyMap = Record<string, string>;

export default function TodaysJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyMap, setCompanyMap] = useState<CompanyMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1️⃣ Fetch today’s jobs
      const { data: jobsData, error } = await supabase
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

      if (error || !jobsData) {
        setLoading(false);
        return;
      }

      setJobs(jobsData as Job[]);

      // 2️⃣ Fetch company names
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

  function fmtDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString();
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

        {loading && (
          <p className="text-slate-500">Loading today’s jobs...</p>
        )}

        {!loading && jobs.length === 0 && (
          <p className="text-slate-500">No jobs posted today yet.</p>
        )}

        {!loading && jobs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-left font-medium">Job ID</th>
                  <th className="px-4 py-3 text-left font-medium">Link</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th className="px-4 py-3 text-left font-medium">Posted</th>
                </tr>
              </thead>

              <tbody>
                {jobs.map((job, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-slate-200 hover:bg-slate-50 transition"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {job.title}
                    </td>

                    <td className="px-4 py-3">
                      {companyMap[job.company_id] ? (
                        <Link
                          href={`/companies/${job.company_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {companyMap[job.company_id]}
                        </Link>
                      ) : (
                        <span className="text-slate-500">Unknown</span>
                      )}
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
                      {fmtDate(job.posted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
