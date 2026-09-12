"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  Search,
  Users,
  Bell,
  LogOut,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { alertsService } from "@/lib/services/alerts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** which roles can see this item; undefined = all authenticated */
  roles?: Array<"ORGANIZER" | "STAFF">;
  badge?: number;
}

function useAlertCount(isOrganizer: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isOrganizer) return;

    async function fetchCount() {
      try {
        const { data } = await alertsService.count();
        setCount(data.count);
      } catch {
        // non-fatal — badge just stays at 0
      }
    }

    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [isOrganizer]);

  return count;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, isOrganizer, logout } = useAuth();
  const alertCount = useAlertCount(isOrganizer);

  const role = user?.role ?? "STAFF";

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      // STAFF-only: their assigned sessions
      label: "My Sessions",
      href: "/my-sessions",
      icon: ClipboardList,
      roles: ["STAFF"],
    },
    {
      label: "Events",
      href: "/events",
      icon: CalendarDays,
    },
    {
      label: "Registrations",
      href: "/registrations",
      icon: Search,
    },
    {
      label: "Alerts",
      href: "/alerts",
      icon: Bell,
      roles: ["ORGANIZER"],
      badge: alertCount > 0 ? alertCount : undefined,
    },
    {
      label: "Staff",
      href: "/staff",
      icon: Users,
      roles: ["ORGANIZER"],
    },
  ];

  const visible = navItems.filter((i) => !i.roles || i.roles.includes(role as "ORGANIZER" | "STAFF"));

  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-50">
          <CalendarDays className="h-4 w-4 text-zinc-50 dark:text-zinc-900" />
        </div>
        <span className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
          EventBooking
        </span>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 space-y-0.5 overflow-y-auto p-3"
        aria-label="Main navigation"
      >
        {visible.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
              {active && (
                <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              )}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User footer */}
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-50">
              {user?.email}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {user?.role}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-zinc-600 hover:text-red-600 dark:text-zinc-400"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
