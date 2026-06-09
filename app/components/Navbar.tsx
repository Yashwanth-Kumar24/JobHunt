"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const pathname = usePathname();
  const [todayCount, setTodayCount] = useState<number | null>(null);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .gte("posted_at", start.toISOString())
      .then(({ count }) => {
        if (count !== null) setTodayCount(count);
      });
  }, []);

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-14 items-center gap-8">

          {/* Brand */}
          <Link href="/latest" className="flex items-center gap-2 shrink-0">
            <span className="text-blue-600 font-bold text-lg tracking-tight">Job</span>
            <span className="text-slate-800 font-bold text-lg tracking-tight -ml-1">Hunt</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/latest"
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                isActive("/latest")
                  ? "text-blue-600 border-b-2 border-blue-600 pb-[13px] pt-[15px]"
                  : "text-slate-600 hover:text-slate-800 py-4"
              }`}
            >
              Latest Jobs
              {todayCount !== null && todayCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {todayCount} today
                </span>
              )}
            </Link>

            <Link
              href="/companies"
              className={`text-sm font-medium transition-colors ${
                isActive("/companies")
                  ? "text-blue-600 border-b-2 border-blue-600 pb-[13px] pt-[15px]"
                  : "text-slate-600 hover:text-slate-800 py-4"
              }`}
            >
              Companies
            </Link>
          </div>

        </div>
      </div>
    </nav>
  );
}
