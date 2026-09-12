// Root "/" redirects based on auth state.
// AuthGuard in the (app) layout handles the actual redirect to /login when
// unauthenticated. This page just pushes authenticated visitors to /dashboard.
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
