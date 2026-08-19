"use client";

import { useEffect, useRef, useState } from "react";

import {
  getMuscleByKey,
  searchMuscles,
  type Muscle,
  type MuscleRegion,
} from "@/lib/constants/muscles";
import { pl } from "@/lib/i18n/pl";

interface MuscleComboboxProps {
  id: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  disabled?: boolean;
  error?: string;
}

const REGION_ORDER: MuscleRegion[] = ["upper", "lower", "foot"];

function muscleLabel(muscle: Muscle): string {
  return `${muscle.namePl} (${muscle.nameLatin})`;
}

function groupByRegion(muscles: Muscle[]): Record<MuscleRegion, Muscle[]> {
  const groups: Record<MuscleRegion, Muscle[]> = {
    upper: [],
    lower: [],
    foot: [],
  };
  for (const muscle of muscles) {
    groups[muscle.region].push(muscle);
  }
  return groups;
}

/**
 * Searchable combobox for the 68-muscle FMS catalog.
 * Filters by Polish and Latin name (diacritic-insensitive), groups by region,
 * supports arrow-key navigation + Enter selection.
 */
export default function MuscleCombobox({
  id,
  selectedKey,
  onSelect,
  disabled = false,
  error,
}: MuscleComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = selectedKey ? getMuscleByKey(selectedKey) : undefined;
  const results = searchMuscles(query);
  const groups = groupByRegion(results);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectMuscle(muscle: Muscle) {
    onSelect(muscle.key);
    setQuery("");
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
      setIsOpen(true);
      return;
    }
    if (!isOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const muscle = results[activeIndex];
      if (muscle) selectMuscle(muscle);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={
          isOpen ? `${id}-option-${activeIndex}` : undefined
        }
        aria-invalid={Boolean(error)}
        autoComplete="off"
        placeholder={
          selected
            ? muscleLabel(selected)
            : pl.coach.athlete.diagnostics.field.musclePlaceholder
        }
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      />

      {isOpen && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-label={pl.coach.athlete.diagnostics.field.muscle}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-input border border-border bg-popover py-1 text-sm shadow-lg"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">
              {pl.common.noResults}
            </li>
          )}

          {REGION_ORDER.map((region) => {
            const muscles = groups[region];
            if (muscles.length === 0) return null;
            return (
              <li key={region} role="presentation">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {pl.coach.athlete.diagnostics.region[region]}
                </p>
                <ul role="presentation">
                  {muscles.map((muscle) => {
                    const flatIndex = results.indexOf(muscle);
                    return (
                      <li
                        key={muscle.key}
                        id={`${id}-option-${flatIndex}`}
                        role="option"
                        aria-selected={muscle.key === selectedKey}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectMuscle(muscle);
                        }}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        className={`cursor-pointer px-3 py-1.5 ${
                          flatIndex === activeIndex
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {muscleLabel(muscle)}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}