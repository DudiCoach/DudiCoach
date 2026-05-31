import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getAthleteById, getDb } from "@/lib/firebase/admin";
import { generatePlan } from "@/lib/ai/client";
import {
  buildProgressionSystemPrompt,
  buildProgressionUserPrompt,
} from "@/lib/ai/prompts/progression-recommendation";
import type { FirestoreProgression } from "@/lib/firebase/admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/athletes/[id]/progression-recommendation
 * Generates AI-powered progression recommendations based on
 * feedback, RPE reports, diagnostics, and current progressions.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id: athleteId } = await params;

  const { user, response } = await requireAuth(
    "POST /api/athletes/[id]/progression-recommendation",
  );
  if (response) return response;

  try {
    const athlete = await getAthleteById(athleteId);
    if (!athlete || athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch all data concurrently
    const db = getDb();
    const athleteDoc = db.collection("athletes").doc(athleteId);

    const [feedbackSnap, rpeSnap, progressionsSnap, diagnosticsSnap] =
      await Promise.all([
        athleteDoc.collection("session_feedback").orderBy("weekNumber", "asc").get(),
        athleteDoc.collection("rpe_reports").orderBy("weekNumber", "asc").get(),
        athleteDoc.collection("progressions").orderBy("createdAt", "desc").limit(20).get(),
        athleteDoc.collection("fms_diagnostics").get(),
      ]);

    const feedback = feedbackSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        weekNumber: data.weekNumber,
        dayNumber: data.dayNumber,
        text: data.feedbackText,
      };
    });

    const rpeReports = rpeSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        weekNumber: data.weekNumber,
        dayNumber: data.dayNumber,
        rpe: data.rpe,
        painLevel: data.painLevel,
        painLocation: data.painLocation,
      };
    });

    const currentProgressions = progressionsSnap.docs.map((doc) => {
      const data = doc.data() as FirestoreProgression;
      return {
        exerciseName: data.exerciseName,
        weightKg: data.weightKg,
        reps: Number(data.reps) || 0,
        sets: Number(data.sets) || 0,
      };
    });

    const diagnosticFindings = diagnosticsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        muscle: data.muscle,
        severity: data.severity,
        notes: data.notes,
      };
    });

    const systemPrompt = buildProgressionSystemPrompt();
    const userPrompt = buildProgressionUserPrompt({
      athleteName: athlete.data.name ?? "Zawodnik",
      sport: athlete.data.sport ?? "Ogólna",
      currentPhase: athlete.data.currentPhase ?? "Nieznana",
      feedback,
      rpeReports,
      currentProgressions,
      diagnosticFindings,
    });

    const rawText = await generatePlan({ systemPrompt, userPrompt });

    let recommendations;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        recommendations = { recommendations: [], summary: rawText };
      }
    } catch {
      recommendations = { recommendations: [], summary: rawText };
    }

    return NextResponse.json({ data: recommendations });
  } catch (error) {
    console.error("[POST /api/athletes/[id]/progression-recommendation] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
