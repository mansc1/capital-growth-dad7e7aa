import type { SimulationInput } from "./retirement-simulation";

const STORAGE_KEY = "retirement_planner_state";

interface PersistedState {
  input: SimulationInput;
  comparisonMode: boolean;
}

export function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.input?.birthYear !== "number" ||
      typeof parsed?.input?.retirementAge !== "number" ||
      typeof parsed?.input?.targetAge !== "number" ||
      !Array.isArray(parsed?.input?.savingsRanges)
    ) {
      return null;
    }
    return {
      input: parsed.input,
      comparisonMode: !!parsed.comparisonMode,
    };
  } catch {
    return null;
  }
}

export function savePersistedState(input: SimulationInput, comparisonMode: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ input, comparisonMode }));
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}
