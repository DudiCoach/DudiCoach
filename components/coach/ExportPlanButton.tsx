"use client";

import { pl } from "@/lib/i18n/pl";

/**
 * Button to export a training plan as PDF via browser print.
 * Uses window.print() with a print-specific stylesheet.
 */
export default function ExportPlanButton() {
  const handleExport = () => {
    // Add print class to body for CSS targeting
    document.body.classList.add("printing-plan");

    // Open print dialog
    window.print();

    // Remove print class after print dialog closes
    document.body.classList.remove("printing-plan");
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="bg-secondary text-foreground hover:bg-secondary/80 rounded-pill px-4 py-2 text-sm font-medium transition-colors"
    >
      {pl.coach.athlete.plans.exportPdf}
    </button>
  );
}
