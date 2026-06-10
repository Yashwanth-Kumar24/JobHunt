"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/app/components/ThemeToggle";

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
      .then(({ count }) => { if (count !== null) setTodayCount(count); });
  }, []);

  const linkBase = "text-sm font-medium transition-colors";
  const activeLink = "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-[13px] pt-[15px]";
  const inactiveLink = "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white py-4";

  return (
    <nav className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-14 items-center gap-8">

          {/* Brand */}
          <Link href="/latest" className="flex items-center shrink-0">
            <span className="text-blue-600 font-bold text-lg tracking-tight">Job</span>
            <span className="text-slate-800 dark:text-slate-100 font-bold text-lg tracking-tight">Hunt</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/latest" className={`${linkBase} ${isActive("/latest") ? activeLink : inactiveLink} flex items-center gap-2`}>
              Latest Jobs
              {todayCount !== null && todayCount > 0 && (
                <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {todayCount} today
                </span>
              )}
            </Link>

            <Link href="/companies" className={`${linkBase} ${isActive("/companies") ? activeLink : inactiveLink}`}>
              Companies
            </Link>

            <Link href="/applied" className={`${linkBase} ${isActive("/applied") ? activeLink : inactiveLink}`}>
              Tracker
            </Link>
          </div>

          <div className="ml-auto">
            <ThemeToggle />
          </div>

        </div>
      </div>
    </nav>
  );
}
