import { notFound, redirect } from "next/navigation";

import CoachNavbar from "@/components/coach/CoachNavbar";
import AthleteEditorShell from "@/components/coach/AthleteEditorShell";
import { requireAuth } from "@/lib/api/auth-guard";
import { getAthleteById } from "@/lib/data/athlete";

interface AthletePageProps {
  params: Promise<{ id: string }>;
}

/**
 * /coach/athletes/[id] — Athlete editor page.
 * RSC: fetches athlete data server-side, passes to client AthleteEditorShell.
 * Auth-protected via middleware + server-side redirect fallback.
 */
export default async function AthletePage({ params }: AthletePageProps) {
  const { id } = await params;

  const { user, response } = await requireAuth("GET /athletes/[id]");
  if (response) redirect("/login");

  const athlete = await getAthleteById(id);

  if (!athlete) {
    notFound();
  }

  return (
    <div className="bg-background min-h-dvh">
      <CoachNavbar displayName={user.email ?? ""} />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <AthleteEditorShell athlete={athlete} />
      </main>
    </div>
  );
}
