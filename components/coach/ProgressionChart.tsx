"use client";

interface ProgressionChartEntry {
  entry_date: string;
  weight_kg: number;
}

interface ProgressionChartProps {
  entries: ProgressionChartEntry[];
  exerciseName: string;
}

const CHART_HEIGHT = 120;
const LABEL_HEIGHT = 18;
const PLOT_HEIGHT = CHART_HEIGHT - LABEL_HEIGHT - 8;

function formatWeight(weight: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(
    weight,
  );
}

function shortDate(date: string): string {
  return date.slice(5);
}

/**
 * Hand-rolled SVG bar chart for one exercise's load history. No chart
 * dependency: 1-30 entries, one metric (weight), static render.
 */
export default function ProgressionChart({
  entries,
  exerciseName,
}: ProgressionChartProps) {
  if (entries.length === 0) return null;

  const weights = entries.map((entry) => entry.weight_kg);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) {
    const pad = Math.max(min * 0.1, 1);
    min = Math.max(0, min - pad);
    max += pad;
  }

  const width = Math.max(entries.length * 32, 160);
  const barWidth = 24;
  const step = entries.length === 1 ? width / 2 : width / entries.length;

  return (
    <div className="overflow-x-auto" data-testid="progression-chart">
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        width="100%"
        height={CHART_HEIGHT}
        role="img"
        aria-label={`Wykres obciążeń dla ${exerciseName}`}
      >
        {entries.map((entry, index) => {
          const barHeight =
            ((entry.weight_kg - min) / (max - min)) * (PLOT_HEIGHT - 4) + 4;
          const x =
            step / 2 - barWidth / 2 + index * step;
          const y = PLOT_HEIGHT - barHeight;
          return (
            <g key={entry.entry_date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                className="fill-primary"
              >
                <title>{`${entry.entry_date}: ${formatWeight(entry.weight_kg)} kg`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT - 4}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={10}
              >
                {shortDate(entry.entry_date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}