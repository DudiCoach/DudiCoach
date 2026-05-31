"use client";

import type { TrainingPlan } from "@/lib/api/plans";
import { pl } from "@/lib/i18n/pl";

interface PlanPrintViewProps {
  plan: TrainingPlan;
}

/**
 * Print-friendly view of a training plan.
 * Renders all 4 weeks in a single view for PDF export.
 * Only visible when printing (hidden on screen via CSS).
 */
export default function PlanPrintView({ plan }: PlanPrintViewProps) {
  const { plan_json: planJson } = plan;
  const { viewer } = pl.coach.athlete.plans;

  return (
    <div className="plan-print-view hidden print:block">
      {/* Header */}
      <div className="mb-6 border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-bold">{plan.plan_name}</h1>
        {plan.phase && (
          <p className="text-gray-600 mt-1">
            Faza: {plan.phase}
          </p>
        )}
        <p className="text-gray-500 text-sm mt-2">
          {pl.athletePanel.plan.generatedOn}:{" "}
          {new Date(plan.created_at).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h2 className="font-bold text-lg mb-2">{viewer.summary}</h2>
        <p className="text-sm">{planJson.summary}</p>
      </div>

      {/* Weekly Overview */}
      <div className="mb-6">
        <h2 className="font-bold text-lg mb-2">{viewer.weeklyOverview}</h2>
        <p className="text-sm">{planJson.weeklyOverview}</p>
      </div>

      {/* Weeks */}
      {planJson.weeks.map((week) => (
        <div key={week.weekNumber} className="mb-8 page-break-inside-avoid">
          <h2 className="font-bold text-lg mb-2 border-b border-gray-200 pb-1">
            {viewer.week.replace("{n}", String(week.weekNumber))}
          </h2>
          <p className="text-sm text-gray-600 mb-3">{week.focus}</p>

          {week.days.map((day) => (
            <div key={day.dayNumber} className="mb-4 ml-4">
              <h3 className="font-semibold mb-2">
                {day.dayName} ({day.duration})
              </h3>

              {/* Warmup */}
              <div className="mb-2">
                <span className="font-medium text-sm">{viewer.warmup}: </span>
                <span className="text-sm">{day.warmup}</span>
              </div>

              {/* Exercises */}
              <table className="w-full text-sm mb-2 border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1">#</th>
                    <th className="text-left py-1">Ćwiczenie</th>
                    <th className="text-left py-1">{viewer.exercise.sets}</th>
                    <th className="text-left py-1">{viewer.exercise.reps}</th>
                    <th className="text-left py-1">{viewer.exercise.intensity}</th>
                    <th className="text-left py-1">{viewer.exercise.rest}</th>
                    <th className="text-left py-1">{viewer.exercise.tempo}</th>
                  </tr>
                </thead>
                <tbody>
                  {day.exercises.map((exercise, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1 font-medium">{exercise.name}</td>
                      <td className="py-1">{exercise.sets}</td>
                      <td className="py-1">{exercise.reps}</td>
                      <td className="py-1">{exercise.intensity}</td>
                      <td className="py-1">{exercise.rest}</td>
                      <td className="py-1">{exercise.tempo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Cooldown */}
              <div className="mb-1">
                <span className="font-medium text-sm">{viewer.cooldown}: </span>
                <span className="text-sm">{day.cooldown}</span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Footer sections */}
      <div className="mt-8 border-t border-gray-300 pt-4 space-y-4">
        <div>
          <h2 className="font-bold text-lg mb-2">{viewer.progressionNotes}</h2>
          <p className="text-sm">{planJson.progressionNotes}</p>
        </div>
        <div>
          <h2 className="font-bold text-lg mb-2">{viewer.nutritionTips}</h2>
          <p className="text-sm">{planJson.nutritionTips}</p>
        </div>
        <div>
          <h2 className="font-bold text-lg mb-2">{viewer.recoveryProtocol}</h2>
          <p className="text-sm">{planJson.recoveryProtocol}</p>
        </div>
      </div>
    </div>
  );
}
