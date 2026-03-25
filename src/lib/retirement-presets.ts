import type { ReturnRange } from "@/lib/retirement-simulation";

export const RETURN_PRESETS: Record<string, { label: string; ranges: ReturnRange[] }> = {
  conservative: {
    label: "Conservative",
    ranges: [
      { startAge: 30, endAge: 39, annualReturn: 6.0 },
      { startAge: 40, endAge: 49, annualReturn: 5.0 },
      { startAge: 50, endAge: 59, annualReturn: 4.0 },
      { startAge: 60, endAge: 90, annualReturn: 3.0 },
    ],
  },
  balanced: {
    label: "Balanced",
    ranges: [
      { startAge: 30, endAge: 39, annualReturn: 8.0 },
      { startAge: 40, endAge: 49, annualReturn: 7.0 },
      { startAge: 50, endAge: 59, annualReturn: 6.0 },
      { startAge: 60, endAge: 90, annualReturn: 4.0 },
    ],
  },
  growth: {
    label: "Growth",
    ranges: [
      { startAge: 30, endAge: 39, annualReturn: 9.0 },
      { startAge: 40, endAge: 49, annualReturn: 8.0 },
      { startAge: 50, endAge: 59, annualReturn: 7.0 },
      { startAge: 60, endAge: 90, annualReturn: 4.5 },
    ],
  },
};
