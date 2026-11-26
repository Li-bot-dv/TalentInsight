"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  Briefcase,
  Building2,
  Database,
  Menu,
  Newspaper,
  TrendingUp,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Market Pulse", icon: Activity, desc: "Executive overview" },
  { href: "/velocity", label: "Hiring Radar", icon: TrendingUp, desc: "Boost & decrease" },
  { href: "/senior-hiring", label: "Senior Hiring", icon: Briefcase, desc: "CXO, VP, Head, Staff" },
  { href: "/talent-flow", label: "Inflow – Outflow", icon: ArrowLeftRight, desc: "Candidate migration" },
  { href: "/movements", label: "Company Moves", icon: Newspaper, desc: "Org & news signals" },
  { href: "/crawlers", label: "Watchlist & Crawlers", icon: Database, desc: "Sources & Top 30" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navList = (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Main navigation">
      <div className="px-3 pb-2 section-kicker">Intelligence Modules</div>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-[#14171a] text-white font-medium shadow-xs"
                : "text-[#3f4650] hover:bg-[#efede6] hover:text-[#14171a]"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-teal-300" : "text-[#6b7280] group-hover:text-[#14171a]"}`} />
            <div className="min-w-0">
              <div className="truncate leading-tight">{item.label}</div>
              <div className={`text-[11px] truncate ${active ? "text-stone-300" : "text-[#7c8490]"}`}>
                {item.desc}
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[#f7f6f2] text-[#14171a]">
      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#e5e2d9] z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-[#e5e2d9]">
          <div className="h-8 w-8 rounded-md bg-[#14171a] text-white flex items-center justify-center font-mono text-xs font-semibold tracking-tight">
            TI
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-[#14171a] truncate">
              TalentInsight <span className="text-[#0f766e]">VN</span>
            </div>
            <div className="text-[11px] text-[#7c8490] truncate">Tech · CFC · Banking</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{navList}</div>

        <div className="p-4 border-t border-[#e5e2d9] bg-[#faf9f6]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#14171a]">
            <Building2 className="h-3.5 w-3.5 text-[#0f766e]" />
            <span>Vietnam Market Coverage</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#646d78]">
            TopDev, ITviec, VietnamWorks, CareerViet, Company ATS &amp; VN News RSS.
          </p>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-[#e5e2d9] px-4 flex items-center justify-between z-40">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-[#14171a] text-white flex items-center justify-center font-mono text-[11px] font-semibold">
            TI
          </div>
          <span className="text-sm font-bold tracking-tight">
            TalentInsight <span className="text-[#0f766e]">VN</span>
          </span>
        </Link>
        <button
          type="button"
          id="mobile-menu-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-md text-[#4e5661] hover:bg-[#f1efe9]"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/30 pt-14" onClick={() => setMobileOpen(false)}>
          <div
            className="w-64 h-full bg-white border-r border-[#e5e2d9] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {navList}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 pt-14 lg:pt-0 min-w-0">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
