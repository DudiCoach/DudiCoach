import Anthropic from "@anthropic-ai/sdk";

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

export type PlanErrorCode =
  | "parse_error"
  | "validation_error"
  | "api_timeout"
  | "api_rate_limit"
  | "api_error"
  | "unknown_error";

interface ClassifyResult {
  errorCode: PlanErrorCode;
  errorMessage: string;
  requeue: boolean;
}

/**
 * Classify an error from the AI generation process.
 * Returns the appropriate error code, message, and whether to requeue.
 */
export function classifyPlanError(error: unknown): ClassifyResult {
  // Parse/validation errors — deterministic, no retry
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("parse") || msg.includes("json")) {
      return {
        errorCode: "parse_error",
        errorMessage: "Błąd formatu odpowiedzi AI. Spróbuj ponownie.",
        requeue: false,
      };
    }

    if (msg.includes("validation") || msg.includes("schema")) {
      return {
        errorCode: "validation_error",
        errorMessage: "Odpowiedź AI nie spełnia wymagań. Spróbuj ponownie.",
        requeue: false,
      };
    }
  }

  // Anthropic API errors
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;

    // Timeout
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return {
        errorCode: "api_timeout",
        errorMessage: "Przekroczono czas połączenia z AI. Ponawiam...",
        requeue: true,
      };
    }

    // Rate limiting (429)
    if (status === 429) {
      return {
        errorCode: "api_rate_limit",
        errorMessage: "Zbyt wiele zapytań do AI. Ponawiam...",
        requeue: true,
      };
    }

    // Server errors (5xx) — transient, retryable
    if (status >= 500) {
      return {
        errorCode: "api_error",
        errorMessage: "Błąd serwera AI. Ponawiam...",
        requeue: true,
      };
    }

    // Other API errors — non-retryable
    return {
      errorCode: "api_error",
      errorMessage: `Błąd API AI: ${error.message}`,
      requeue: false,
    };
  }

  // Network errors — retryable
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("econnrefused")) {
      return {
        errorCode: "api_error",
        errorMessage: "Błąd połączenia z AI. Ponawiam...",
        requeue: true,
      };
    }
  }

  // Unknown errors — non-retryable
  return {
    errorCode: "unknown_error",
    errorMessage: "Nieoczekiwany błąd podczas generowania planu.",
    requeue: false,
  };
}
