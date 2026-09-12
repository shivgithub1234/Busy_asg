"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  Search,
  Users,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS: Array<{
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: ("ORGANIZER" | "STAFF")[];
}> = [
  { label: "Dashboard",     href: "/dashboard",    icon: LayoutDashboard },
  { label: "My Sessions",   href: "/my-sessions",  icon: ClipboardList,   roles: ["STAFF"] },
  { label: "Events",        href: "/events",        icon: CalendarDays },
  { label: "Registrations", href: "/registrations", icon: Search },
  { label: "Alerts",        href: "/alerts",        icon: Bell,            roles: ["ORGANIZER"] },
  { label: "Staff",         href: "/staff",         icon: Users,           roles: ["ORGANIZER"] },
];

export function MobileHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role ?? "STAFF";
  const [open, setOpen] = useState(false);

  const visible = NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role as "ORGANIZER" | "STAFF"));

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-50">
            <CalendarDays className="h-4 w-4 text-zinc-50 dark:text-zinc-900" />
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">EventBooking</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl dark:bg-zinc-950">
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {visible.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-40" />}
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <p className="truncate px-3 text-xs text-zinc-500 mb-1">{user?.email}</p>
              <p className="px-3 text-[10px] uppercase tracking-wide text-zinc-400 mb-2">{user?.role}</p>
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start gap-2 text-zinc-600 hover:text-red-600"
                onClick={() => { logout(); setOpen(false); }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
