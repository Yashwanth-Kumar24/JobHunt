"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Company = {
  id: string;
  name: string;
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("companies")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setCompanies(data);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold text-slate-800 mb-2">
          Companies
        </h1>
        <p className="text-slate-600 mb-8">
          Explore companies and view their open job positions
        </p>

        {loading && (
          <p className="text-slate-500">Loading companies...</p>
        )}

        {!loading && companies.length === 0 && (
          <p className="text-slate-500">No companies available.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {companies.map(company => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="group"
            >
              <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-slate-800 group-hover:text-blue-600">
                    {company.name}
                  </h2>
                </div>

                <div className="mt-3 text-sm text-slate-500">
                  View open roles →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
