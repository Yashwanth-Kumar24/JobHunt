"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Company = {
  id: string;
  name: string;
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [{ data: companiesData, error: cErr }, { data: countsData, error: jErr }] =
        await Promise.all([
          supabase.from("companies").select("id, name").order("name"),
          supabase
            .from("jobs")
            .select("company_id")
            .gte("posted_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(10000),
        ]);

      if (cErr || jErr) {
        setError("Failed to load companies. Please try again.");
        setLoading(false);
        return;
      }

      if (companiesData) setCompanies(companiesData);

      if (countsData) {
        const counts: Record<string, number> = {};
        countsData.forEach(j => { counts[j.company_id] = (counts[j.company_id] ?? 0) + 1; });
        setJobCounts(counts);
      }

      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(c => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ac = jobCounts[a.id] ?? 0, bc = jobCounts[b.id] ?? 0;
      if (bc !== ac) return bc - ac;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, jobCounts]);

  const totalJobs = Object.values(jobCounts).reduce((s, n) => s + n, 0);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors">
      <div className="max-w-6xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-800 dark:text-slate-100 mb-1">Companies</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {loading ? "Loading..." : `${companies.length} companies · ${totalJobs} jobs in the last 30 days`}
          </p>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
          />
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-500 dark:text-slate-400 shadow-sm">
            Loading companies...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center text-red-600 dark:text-red-400 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-500 dark:text-slate-400 shadow-sm">
            {search ? `No companies match "${search}".` : "No companies available."}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {sorted.map(company => {
            const count = jobCounts[company.id] ?? 0;
            return (
              <Link key={company.id} href={`/companies/${company.id}`} className="group">
                <div className="h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-medium text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-snug">
                      {company.name}
                    </h2>
                    {count > 0 && (
                      <span className="shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {count}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                    {count > 0 ? `${count} open role${count !== 1 ? "s" : ""}` : "No recent jobs"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </main>
  );
}
