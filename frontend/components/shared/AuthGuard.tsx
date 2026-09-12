"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface AuthGuardProps {
  children: React.ReactNode;
  requireOrganizer?: boolean;
}

/**
 * Wraps protected pages. Redirects to /login when unauthenticated,
 * and to /dashboard when a STAFF user tries to reach an ORGANIZER-only page.
 */
export function AuthGuard({ children, requireOrganizer = false }: AuthGuardProps) {
  const { isAuthenticated, isOrganizer, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (requireOrganizer && !isOrganizer) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isOrganizer, isLoading, requireOrganizer, router]);

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return null;
  if (requireOrganizer && !isOrganizer) return null;

  return <>{children}</>;
}
