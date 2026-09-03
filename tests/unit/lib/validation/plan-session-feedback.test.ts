/// <reference types="vitest/globals" />

import {
  feedbackDayNumberSchema,
  feedbackTextSchema,
  feedbackWeekNumberSchema,
  publicFeedbackPostBodySchema,
  publicFeedbackQuerySchema,
  sanitizeFeedbackText,
  sessionOutcomeSchema,
  shareCodePathSchema,
} from "@/lib/validation/plan-session-feedback";

const VALID_OUTCOME = {
  sessionDate: "2026-05-22",
  sessionStatus: "completed",
  sessionRpe: 7,
  wellbeing: 4,
  painScore: 2,
  painLocation: "knee",
  painSide: "left",
} as const;

describe("plan-session-feedback validation", () => {
  it("normalizes share code and accepts valid format", () => {
    const parsed = shareCodePathSchema.parse(" ab c2 34 ");
    expect(parsed).toBe("ABC234");
  });

  it("rejects invalid share code format", () => {
    const result = shareCodePathSchema.safeParse("AB01IO");
    expect(result.success).toBe(false);
  });

  it("enforces week and day boundaries", () => {
    expect(feedbackWeekNumberSchema.safeParse(1).success).toBe(true);
    expect(feedbackWeekNumberSchema.safeParse(4).success).toBe(true);
    expect(feedbackWeekNumberSchema.safeParse(0).success).toBe(false);
    expect(feedbackWeekNumberSchema.safeParse(5).success).toBe(false);

    expect(feedbackDayNumberSchema.safeParse(1).success).toBe(true);
    expect(feedbackDayNumberSchema.safeParse(7).success).toBe(true);
    expect(feedbackDayNumberSchema.safeParse(0).success).toBe(false);
    expect(feedbackDayNumberSchema.safeParse(8).success).toBe(false);
  });

  it("trims feedback text and strips unsafe control characters", () => {
    const parsed = feedbackTextSchema.parse("  abc\x01\x02\n\tdef  ");
    expect(parsed).toBe("abc\n\tdef");
  });

  it("rejects whitespace-only feedback", () => {
    const result = feedbackTextSchema.safeParse(" \n\t ");
    expect(result.success).toBe(false);
  });

  it("rejects feedback longer than 2000 chars after sanitization", () => {
    const result = feedbackTextSchema.safeParse("a".repeat(2001));
    expect(result.success).toBe(false);
  });

  it("accepts valid post body and returns sanitized feedback text", () => {
    const parsed = publicFeedbackPostBodySchema.parse({
      weekNumber: 2,
      dayNumber: 5,
      feedbackText: "  test\x03 text  ",
    });

    expect(parsed).toEqual({
      weekNumber: 2,
      dayNumber: 5,
      feedbackText: "test text",
    });
  });

  it("accepts v2 post body with complete outcome and optional feedback text", () => {
    const parsed = publicFeedbackPostBodySchema.parse({
      contractVersion: 2,
      weekNumber: 2,
      dayNumber: 5,
      feedbackText: "  komentarz\x03  ",
      outcome: VALID_OUTCOME,
    });

    expect(parsed).toEqual({
      contractVersion: 2,
      weekNumber: 2,
      dayNumber: 5,
      feedbackText: "komentarz",
      outcome: VALID_OUTCOME,
    });
  });

  it("allows v2 feedback text to be omitted", () => {
    const parsed = publicFeedbackPostBodySchema.parse({
      contractVersion: 2,
      weekNumber: 2,
      dayNumber: 5,
      outcome: VALID_OUTCOME,
    });

    expect(parsed.feedbackText).toBeNull();
  });

  it("rejects incomplete v2 outcome", () => {
    const result = publicFeedbackPostBodySchema.safeParse({
      contractVersion: 2,
      weekNumber: 2,
      dayNumber: 5,
      feedbackText: null,
      outcome: {
        sessionDate: "2026-05-22",
        sessionStatus: "completed",
        sessionRpe: 7,
      },
    });

    expect(result.success).toBe(false);
  });

  it("enforces v2 outcome cross-field rules", () => {
    expect(
      sessionOutcomeSchema.safeParse({
        ...VALID_OUTCOME,
        sessionStatus: "skipped",
        sessionRpe: 7,
      }).success,
    ).toBe(false);

    expect(
      sessionOutcomeSchema.safeParse({
        ...VALID_OUTCOME,
        painScore: 0,
        painLocation: "knee",
      }).success,
    ).toBe(false);

    expect(
      sessionOutcomeSchema.safeParse({
        ...VALID_OUTCOME,
        painLocation: null,
        painSide: "left",
      }).success,
    ).toBe(false);
  });

  it("rejects future v2 session date", () => {
    const result = sessionOutcomeSchema.safeParse({
      ...VALID_OUTCOME,
      sessionDate: "9999-12-31",
    });

    expect(result.success).toBe(false);
  });

  it("rejects impossible v2 calendar date", () => {
    const result = sessionOutcomeSchema.safeParse({
      ...VALID_OUTCOME,
      sessionDate: "2026-02-31",
    });

    expect(result.success).toBe(false);
  });

  it("parses optional contractVersion=2 query flag", () => {
    const parsed = publicFeedbackQuerySchema.parse({
      weekNumber: "2",
      dayNumber: "5",
      contractVersion: "2",
    });

    expect(parsed).toEqual({ weekNumber: 2, dayNumber: 5, contractVersion: 2 });
  });

  it("sanitizeFeedbackText helper is deterministic", () => {
    expect(sanitizeFeedbackText("x\x00y\x1Fz")).toBe("xyz");
  });
});
