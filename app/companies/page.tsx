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

  useEffect(() => {
    supabase
      .from("companies")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setCompanies(data);
      });
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Companies</h1>

      <ul className="space-y-2">
        {companies.map(c => (
          <li key={c.id}>
            <Link
              href={`/companies/${c.id}`}
              className="text-blue-600 hover:underline"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
