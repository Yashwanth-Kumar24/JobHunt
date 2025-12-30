"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Job = {
  title: string;
  posting_url: string;
  posted_at: string | null;
  job_id: string | null;
  locations: string | null;
};

export default function TodaysJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    supabase
      .from("jobs")
      .select(`
        title,
        posting_url,
        posted_at,
        job_id,
        locations
      `)
      .gte("posted_at", today.toISOString())
      .order("posted_at", { ascending: false })
      .then(({ data }) => {
        if (data) setJobs(data);
        setLoading(false);
      });
  }, []);

  function fmt(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString();
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
          <p className="text-slate-500">
            No jobs posted today yet.
          </p>
        )}

        {!loading && jobs.length > 0 && (
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
                  <th className="px-4 py-3 text-left font-medium">
                    Posted
                  </th>
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
        )}
      </div>
    </main>
  );
}
