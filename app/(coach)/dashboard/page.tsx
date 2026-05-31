import { redirect } from "next/navigation";

import CoachNavbar from "@/components/coach/CoachNavbar";
import DashboardContent from "@/components/coach/DashboardContent";
import { pl } from "@/lib/i18n/pl";
import { requireAuth } from "@/lib/api/auth-guard";
import { getAthletesByCoach } from "@/lib/data/athlete";

/**
 * /coach/dashboard — Athlete list dashboard.
 * RSC: fetches athletes server-side for instant render, passes to DashboardContent.
 * Auth-protected via middleware + server-side redirect fallback.
 */
export default async function DashboardPage() {
  const { user, response } = await requireAuth("GET /dashboard");
  if (response) redirect("/login");

  // Fetch athletes server-side for instant render (no loading flash)
  const athletes = await getAthletesByCoach(user.uid);

  return (
    <div className="bg-background min-h-dvh">
      <CoachNavbar displayName={user.email ?? ""} />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-foreground mb-2 text-2xl font-semibold">
          {pl.coach.dashboard.title}
        </h1>
        <p className="text-muted-foreground mb-8 text-sm">
          {pl.coach.dashboard.welcome}
        </p>

        <DashboardContent initialAthletes={athletes} />
      </main>
    </div>
  );
}
