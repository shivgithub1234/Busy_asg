"use client";

import { AuthGuard } from "@/components/shared/AuthGuard";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileHeader } from "@/components/shell/MobileHeader";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* Sidebar — hidden on mobile */}
        <div className="hidden lg:flex lg:flex-col lg:shrink-0">
          <Sidebar />
        </div>

        {/* Main content column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar */}
          <MobileHeader />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
