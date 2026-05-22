/// <reference types="vitest/globals" />

import {
  feedbackDayNumberSchema,
  feedbackTextSchema,
  feedbackWeekNumberSchema,
  publicFeedbackPostBodySchema,
  sanitizeFeedbackText,
  shareCodePathSchema,
} from "@/lib/validation/plan-session-feedback";

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

  it("sanitizeFeedbackText helper is deterministic", () => {
    expect(sanitizeFeedbackText("x\x00y\x1Fz")).toBe("xyz");
  });
});
