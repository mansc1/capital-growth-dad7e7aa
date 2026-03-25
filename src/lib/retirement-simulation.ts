// ── Types ──────────────────────────────────────────────────────────────────────

export interface SavingsRange {
  startAge: number;
  endAge: number;
  monthlySavings: number;
}

export interface ReturnRange {
  startAge: number;
  endAge: number;
  annualReturn: number; // percentage, e.g. 6 for 6%
}

export type ReturnMode = "fixed" | "age-based" | "portfolio";
export type SpendingMode = "manual" | "withdrawal-rate";

export interface SimulationInput {
  birthYear: number;
  retirementAge: number;
  targetAge: number;
  annualReturn: number; // percentage, e.g. 6 for 6% — used in fixed mode
  retirementMonthlySpending: number;
  inflationRate: number; // percentage, e.g. 2 for 2%
  applyInflationToRetirementSpending: boolean;
  spendingMode: SpendingMode;
  withdrawalRate: number; // percentage, e.g. 4 for 4%
  savingsRanges: SavingsRange[];
  returnMode: ReturnMode;
  returnRanges: ReturnRange[];
}

export type Phase = "pre-retirement" | "post-retirement";

export interface YearlyRow {
  age: number;
  phase: Phase;
  monthlySavings: number;
  annualSavings: number;
  annualWithdrawal: number;
  annualInterest: number;
  endBalance: number;
  isPositive: boolean;
}

export interface SimulationResult {
  rows: YearlyRow[];
  balanceAtRetirement: number;
  lastsUntilTarget: boolean;
  balanceAtTarget: number;
  runOutAge: number | null;
}

// ── Return Resolution ──────────────────────────────────────────────────────────

export function resolveReturnForAge(age: number, input: SimulationInput): number {
  if (input.returnMode === "fixed") return input.annualReturn / 100;
  if (input.returnMode === "age-based") {
    const match = input.returnRanges.find((r) => age >= r.startAge && age <= r.endAge);
    return match ? match.annualReturn / 100 : 0;
  }
  return 0;
}

// ── Validation ─────────────────────────────────────────────────────────────────

export interface SavingsRangeErrors {
  startAge?: string;
  endAge?: string;
  monthlySavings?: string;
  overlap?: string;
}

export interface ReturnRangeErrors {
  startAge?: string;
  endAge?: string;
  annualReturn?: string;
  overlap?: string;
}

export interface ValidationErrors {
  birthYear?: string;
  retirementAge?: string;
  targetAge?: string;
  annualReturn?: string;
  retirementMonthlySpending?: string;
  inflationRate?: string;
  withdrawalRate?: string;
  savingsRanges?: Record<number, SavingsRangeErrors>;
  returnRanges?: Record<number, ReturnRangeErrors>;
}

export interface ValidationWarnings {
  returnRangeCoverage?: string;
}

export function validateInputs(input: SimulationInput): { errors: ValidationErrors; warnings: ValidationWarnings } {
  const errors: ValidationErrors = {};
  const warnings: ValidationWarnings = {};
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - input.birthYear;

  if (!Number.isFinite(input.birthYear) || input.birthYear < 1900 || input.birthYear > currentYear) {
    errors.birthYear = "Enter a valid birth year.";
  }

  if (!Number.isFinite(input.retirementAge) || input.retirementAge <= 0) {
    errors.retirementAge = "Must be a positive number.";
  } else if (input.retirementAge <= currentAge) {
    errors.retirementAge = `Must be greater than current age (${currentAge}).`;
  }

  if (!Number.isFinite(input.targetAge) || input.targetAge <= 0) {
    errors.targetAge = "Must be a positive number.";
  } else if (input.targetAge <= input.retirementAge) {
    errors.targetAge = "Must be greater than retirement age.";
  }

  if (input.returnMode === "fixed") {
    if (!Number.isFinite(input.annualReturn) || input.annualReturn < 0) {
      errors.annualReturn = "Must be a non-negative number.";
    }
  }

  if (input.spendingMode === "manual") {
    if (!Number.isFinite(input.retirementMonthlySpending) || input.retirementMonthlySpending < 0) {
      errors.retirementMonthlySpending = "Must be a non-negative number.";
    }
  }

  if (input.spendingMode === "withdrawal-rate") {
    if (!Number.isFinite(input.withdrawalRate) || input.withdrawalRate < 0) {
      errors.withdrawalRate = "Must be a non-negative number.";
    } else if (input.withdrawalRate > 15) {
      errors.withdrawalRate = "Must be ≤ 15%.";
    }
  }

  if (!Number.isFinite(input.inflationRate) || input.inflationRate < 0) {
    errors.inflationRate = "Must be a non-negative number.";
  } else if (input.inflationRate > 15) {
    errors.inflationRate = "Must be ≤ 15%.";
  }

  const rangeErrors: Record<number, SavingsRangeErrors> = {};
  const sorted = input.savingsRanges.map((r, i) => ({ ...r, idx: i })).sort((a, b) => a.startAge - b.startAge);

  input.savingsRanges.forEach((range, i) => {
    const re: SavingsRangeErrors = {};
    if (!Number.isFinite(range.startAge) || range.startAge < 0) re.startAge = "Must be a non-negative number.";
    if (!Number.isFinite(range.endAge) || range.endAge < 0) re.endAge = "Must be a non-negative number.";
    else if (range.endAge < range.startAge) re.endAge = "Must be ≥ start age.";
    if (!Number.isFinite(range.monthlySavings) || range.monthlySavings < 0) re.monthlySavings = "Must be non-negative.";
    if (Object.keys(re).length) rangeErrors[i] = re;
  });

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].startAge <= sorted[i].endAge) {
        const idxA = sorted[i].idx;
        const idxB = sorted[j].idx;
        if (!rangeErrors[idxA]) rangeErrors[idxA] = {};
        if (!rangeErrors[idxB]) rangeErrors[idxB] = {};
        rangeErrors[idxA].overlap = "This range overlaps with another.";
        rangeErrors[idxB].overlap = "This range overlaps with another.";
      }
    }
  }

  if (Object.keys(rangeErrors).length) errors.savingsRanges = rangeErrors;

  if (input.returnMode === "age-based") {
    const retErrors: Record<number, ReturnRangeErrors> = {};
    const retSorted = input.returnRanges.map((r, i) => ({ ...r, idx: i })).sort((a, b) => a.startAge - b.startAge);

    input.returnRanges.forEach((range, i) => {
      const re: ReturnRangeErrors = {};
      if (!Number.isFinite(range.startAge) || range.startAge < 0) re.startAge = "Must be a non-negative number.";
      if (!Number.isFinite(range.endAge) || range.endAge < 0) re.endAge = "Must be a non-negative number.";
      else if (range.endAge < range.startAge) re.endAge = "Must be ≥ start age.";
      if (!Number.isFinite(range.annualReturn) || range.annualReturn < 0) re.annualReturn = "Must be non-negative.";
      else if (range.annualReturn > 30) re.annualReturn = "Must be ≤ 30%.";
      if (Object.keys(re).length) retErrors[i] = re;
    });

    for (let i = 0; i < retSorted.length; i++) {
      for (let j = i + 1; j < retSorted.length; j++) {
        if (retSorted[j].startAge <= retSorted[i].endAge) {
          const idxA = retSorted[i].idx;
          const idxB = retSorted[j].idx;
          if (!retErrors[idxA]) retErrors[idxA] = {};
          if (!retErrors[idxB]) retErrors[idxB] = {};
          retErrors[idxA].overlap = "This range overlaps with another.";
          retErrors[idxB].overlap = "This range overlaps with another.";
        }
      }
    }

    if (Object.keys(retErrors).length) errors.returnRanges = retErrors;

    const startAge = input.savingsRanges.length > 0
      ? Math.min(...input.savingsRanges.map((r) => r.startAge))
      : input.retirementAge;
    
    for (let age = startAge; age <= input.targetAge; age++) {
      const covered = input.returnRanges.some((r) => age >= r.startAge && age <= r.endAge);
      if (!covered) {
        warnings.returnRangeCoverage = "Some ages in the simulation do not have a return assumption.";
        break;
      }
    }
  }

  return { errors, warnings };
}

export function hasErrors(errors: ValidationErrors): boolean {
  if (errors.birthYear || errors.retirementAge || errors.targetAge || errors.annualReturn || errors.retirementMonthlySpending || errors.inflationRate || errors.withdrawalRate) return true;
  if (errors.savingsRanges && Object.keys(errors.savingsRanges).length > 0) return true;
  if (errors.returnRanges && Object.keys(errors.returnRanges).length > 0) return true;
  return false;
}

// ── Spending Resolution ────────────────────────────────────────────────────────

export function resolveBaseAnnualSpending(input: SimulationInput, balanceAtRetirement: number): number {
  if (input.spendingMode === "withdrawal-rate") {
    return balanceAtRetirement * (input.withdrawalRate / 100);
  }
  return input.retirementMonthlySpending * 12;
}

export function resolveAnnualRetirementSpending(
  age: number,
  input: SimulationInput,
  baseAnnualSpending: number
): number {
  if (!input.applyInflationToRetirementSpending || input.inflationRate === 0) return baseAnnualSpending;
  const firstWithdrawalAge = input.retirementAge + 1;
  const yearsSince = Math.max(0, age - firstWithdrawalAge);
  return baseAnnualSpending * Math.pow(1 + input.inflationRate / 100, yearsSince);
}

// ── Simulation ─────────────────────────────────────────────────────────────────

export function runSimulation(input: SimulationInput): SimulationResult {
  const startAge = input.savingsRanges.length > 0
    ? Math.min(...input.savingsRanges.map((r) => r.startAge))
    : input.retirementAge;

  const rows: YearlyRow[] = [];
  let balance = 0;
  let balanceAtRetirement = 0;
  let runOutAge: number | null = null;

  for (let age = startAge; age <= input.retirementAge; age++) {
    const rate = resolveReturnForAge(age, input);
    const matchingRange = input.savingsRanges.find((r) => age >= r.startAge && age <= r.endAge);
    const monthlySavings = matchingRange ? matchingRange.monthlySavings : 0;
    const annualSavings = monthlySavings * 12;
    const annualInterest = balance * rate;

    balance = balance * (1 + rate) + annualSavings;

    rows.push({
      age,
      phase: "pre-retirement",
      monthlySavings,
      annualSavings,
      annualWithdrawal: 0,
      annualInterest,
      endBalance: balance,
      isPositive: balance > 0,
    });
  }

  balanceAtRetirement = balance;

  const baseAnnualSpending = resolveBaseAnnualSpending(input, balanceAtRetirement);

  for (let age = input.retirementAge + 1; age <= input.targetAge; age++) {
    const rate = resolveReturnForAge(age, input);
    const annualWithdrawal = resolveAnnualRetirementSpending(age, input, baseAnnualSpending);
    const annualInterest = balance * rate;

    balance = balance * (1 + rate) - annualWithdrawal;

    const isPositive = balance > 0;
    if (!isPositive && runOutAge === null) {
      runOutAge = age;
    }

    rows.push({
      age,
      phase: "post-retirement",
      monthlySavings: 0,
      annualSavings: 0,
      annualWithdrawal,
      annualInterest,
      endBalance: balance,
      isPositive,
    });
  }

  const lastRow = rows[rows.length - 1];
  const balanceAtTarget = lastRow ? lastRow.endBalance : 0;
  const lastsUntilTarget = runOutAge === null;

  return {
    rows,
    balanceAtRetirement,
    lastsUntilTarget,
    balanceAtTarget,
    runOutAge,
  };
}
