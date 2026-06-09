"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-14 items-center gap-6">
        <Link
            href="/latest"
            className={`text-sm font-medium ${
              isActive("/latest")
                ? "text-blue-600 border-b-2 border-blue-600 pb-3"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Latest Jobs
          </Link>

          <Link
            href="/companies"
            className={`text-sm font-medium ${
              isActive("/companies")
                ? "text-blue-600 border-b-2 border-blue-600 pb-3"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Companies
          </Link>
        </div>
      </div>
    </nav>
  );
}
