/// <reference types="vitest/globals" />

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import FmsSnapshotHistory from "@/components/coach/FmsSnapshotHistory";
import { pl } from "@/lib/i18n/pl";
import type { FmsDiagnostic } from "@/lib/api/fms-diagnostics";

function makeDiagnostic(overrides: Partial<FmsDiagnostic> = {}): FmsDiagnostic {
  return {
    id: "diag-uuid-001",
    athlete_id: "athlete-uuid-001",
    coach_id: "coach-uuid-001",
    region: "upper",
    side: "left",
    muscle: "Bark przedni",
    severity: "2",
    notes: null,
    created_at: "2026-04-24T10:00:00Z",
    updated_at: "2026-04-24T10:00:00Z",
    ...overrides,
  };
}

describe("FmsSnapshotHistory", () => {
  it("renders null when no diagnostics", () => {
    const { container } = render(<FmsSnapshotHistory diagnostics={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders history title", () => {
    render(
      <FmsSnapshotHistory
        diagnostics={[makeDiagnostic({ created_at: "2026-04-24T10:00:00Z" })]}
      />,
    );
    expect(screen.getByText(pl.coach.athlete.diagnostics.historyTitle)).toBeInTheDocument();
  });

  it("groups diagnostics by date and shows count", () => {
    render(
      <FmsSnapshotHistory
        diagnostics={[
          makeDiagnostic({ id: "d1", created_at: "2026-04-24T10:00:00Z", muscle: "Bark" }),
          makeDiagnostic({ id: "d2", created_at: "2026-04-24T14:00:00Z", muscle: "Triceps" }),
          makeDiagnostic({ id: "d3", created_at: "2026-04-25T10:00:00Z", muscle: "Quad" }),
        ]}
      />,
    );
    expect(screen.getByText(/2 wpis/)).toBeInTheDocument();
    expect(screen.getByText(/1 wpis/)).toBeInTheDocument();
  });

  it("expands snapshot on click to show muscle details", () => {
    render(
      <FmsSnapshotHistory
        diagnostics={[
          makeDiagnostic({ id: "d1", created_at: "2026-04-24T10:00:00Z", muscle: "Bark" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId("snapshot-2026-04-24"));

    expect(screen.getByText(/Bark/)).toBeInTheDocument();
  });

  it("collapses on second click", () => {
    render(
      <FmsSnapshotHistory
        diagnostics={[
          makeDiagnostic({ id: "d1", created_at: "2026-04-24T10:00:00Z", muscle: "Bark" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId("snapshot-2026-04-24"));
    expect(screen.getByText(/Bark/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("snapshot-2026-04-24"));
    expect(screen.queryByText(/Bark/)).not.toBeInTheDocument();
  });

  it("shows severity for expanded diagnostic", () => {
    render(
      <FmsSnapshotHistory
        diagnostics={[
          makeDiagnostic({ id: "d1", created_at: "2026-04-24T10:00:00Z", muscle: "Bark", severity: "4" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId("snapshot-2026-04-24"));
    expect(screen.getByText(/Stopień: 4/)).toBeInTheDocument();
  });
});
