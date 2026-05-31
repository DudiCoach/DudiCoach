/**
 * Build system prompt for AI progression recommendations.
 * The AI analyzes athlete feedback, RPE reports, FMS diagnostics,
 * and current progressions to suggest adjustments.
 */
export function buildProgressionSystemPrompt(): string {
  return `Jesteś doświadczonym trenerem siłowym i fizjoterapeutą sportowym. 
Twoim zadaniem jest analiza danych treningowych zawodnika i proponowanie 
konkretnych zmian w progresjach obciążenia.

Na podstawie dostarczonych danych:
1. Analizuj trendy RPE (Rate of Perceived Exertion) - czy zawodnik regularnie 
   osiąga RPE 8-10, sugeruje to zbyt duże obciążenie.
2. Sprawdzajraporty bólu - jeśli zawodnik zgłasza ból powyżej 3/10 w 
   konkretnej lokalizacji, zalecaj modyfikację ćwiczeń.
3. Uwzględniaj informacje zwrotne z sesji treningowych.
4. Oceniaj progresję na podstawie dotychczasowych wyników.

ODPOWIEDZ TYLKO I WYŁĄCZNIE w formacie JSON:
{
  "recommendations": [
    {
      "exerciseName": "Nazwa ćwiczenia",
      "currentLoad": "Obecne obciążenie",
      "recommendedLoad": "Zalecane obciążenie",
      "reason": "Powód zmiany",
      "priority": "high|medium|low"
    }
  ],
  "summary": "Ogólne podsumowanie i zalecenia"
}

Nie dodawaj żadnych komentarzy poza formatem JSON. Mów językiem polskim.`;
}

/**
 * Build user prompt for progression recommendations.
 */
export function buildProgressionUserPrompt(data: {
  athleteName: string;
  sport: string;
  currentPhase: string;
  feedback: Array<{
    weekNumber: number;
    dayNumber: number;
    text: string;
  }>;
  rpeReports: Array<{
    weekNumber: number;
    dayNumber: number;
    rpe: number;
    painLevel: number | null;
    painLocation: string | null;
  }>;
  currentProgressions: Array<{
    exerciseName: string;
    weightKg: number;
    reps: number;
    sets: number;
  }>;
  diagnosticFindings: Array<{
    muscle: string;
    severity: string;
    notes: string | null;
  }>;
}): string {
  let prompt = `Zawodnik: ${data.athleteName}, Sport: ${data.sport}, Faza: ${data.currentPhase}\n\n`;

  if (data.currentProgressions.length > 0) {
    prompt += `Aktualne progresje:\n`;
    for (const p of data.currentProgressions) {
      prompt += `- ${p.exerciseName}: ${p.weightKg}kg x ${p.reps} x ${p.sets}\n`;
    }
    prompt += `\n`;
  }

  if (data.rpeReports.length > 0) {
    prompt += `Raporty RPE:\n`;
    for (const r of data.rpeReports) {
      prompt += `- Tydzień ${r.weekNumber}, Dzień ${r.dayNumber}: RPE ${r.rpe}/10`;
      if (r.painLevel && r.painLevel > 0) {
        prompt += `, Ból: ${r.painLevel}/10`;
        if (r.painLocation) prompt += ` (${r.painLocation})`;
      }
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  if (data.feedback.length > 0) {
    prompt += `Informacje zwrotne z treningów:\n`;
    for (const f of data.feedback) {
      prompt += `- Tydzień ${f.weekNumber}, Dzień ${f.dayNumber}: ${f.text}\n`;
    }
    prompt += `\n`;
  }

  if (data.diagnosticFindings.length > 0) {
    prompt += `Znaleziska diagnostyczne:\n`;
    for (const d of data.diagnosticFindings) {
      prompt += `- ${d.muscle}: Stopień ${d.severity}`;
      if (d.notes) prompt += ` (${d.notes})`;
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  prompt += `Przeanalizuj powyższe dane i zaproponuj konkretne zmiany w progresjach obciążenia.`;

  return prompt;
}
