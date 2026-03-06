import type { NavProvider, NavResult } from "../types.ts";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export class MockNavProvider implements NavProvider {
  async fetchLatestNavForFund(fundCode: string): Promise<NavResult | null> {
    const today = getTodayDateString();
    const seed = hashCode(fundCode + today);
    const baseNav = 10 + (seed % 40);
    const variation = ((seed % 100) - 50) / 100; // ±0.50
    const navPerUnit = Math.round((baseNav + variation) * 10000) / 10000;

    return {
      fundCode,
      navDate: today,
      navPerUnit,
      source: "mock",
    };
  }

  async fetchLatestNavForFunds(fundCodes: string[]): Promise<NavResult[]> {
    const results: NavResult[] = [];
    for (const code of fundCodes) {
      const result = await this.fetchLatestNavForFund(code);
      if (result) results.push(result);
    }
    return results;
  }
}
