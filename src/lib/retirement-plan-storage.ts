import type { SimulationInput } from "./retirement-simulation";

const ACTIVE_KEY = "retirement_active_plan";
const HISTORY_KEY = "retirement_plan_history";
const MAX_HISTORY = 5;

export interface SavedRetirementPlan {
  id: string;
  savedAt: string;
  input: SimulationInput;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidPlan(obj: unknown): obj is SavedRetirementPlan {
  if (!obj || typeof obj !== "object") return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.savedAt === "string" &&
    typeof p.input === "object" &&
    p.input !== null &&
    typeof (p.input as Record<string, unknown>).birthYear === "number" &&
    typeof (p.input as Record<string, unknown>).retirementAge === "number" &&
    Array.isArray((p.input as Record<string, unknown>).savingsRanges)
  );
}

export function loadActivePlan(): SavedRetirementPlan | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidPlan(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveActivePlan(plan: SavedRetirementPlan): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(plan));
  } catch {
    // silently ignore
  }
}

export function loadPlanHistory(): SavedRetirementPlan[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPlan).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function pushPlanToHistory(plan: SavedRetirementPlan): void {
  try {
    const history = loadPlanHistory();
    const updated = [plan, ...history.filter((p) => p.id !== plan.id)].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // silently ignore
  }
}

export function createPlan(input: SimulationInput): SavedRetirementPlan {
  return {
    id: generateId(),
    savedAt: new Date().toISOString(),
    input,
  };
}

export function isSamePlanInput(a: SimulationInput, b: SimulationInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
