import type { NavProvider, NavResult } from "../types.ts";

/**
 * SEC Thailand NAV Provider (placeholder).
 * 
 * When ready to integrate, implement against:
 * https://api.sec.or.th/FundFactsheet/fund/daily
 * 
 * Requires an API key from SEC Thailand.
 * Set the secret SEC_TH_API_KEY in Supabase secrets.
 */
export class SecThNavProvider implements NavProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("SEC_TH_API_KEY") ?? "";
  }

  async fetchLatestNavForFund(fundCode: string): Promise<NavResult | null> {
    if (!this.apiKey) {
      console.warn(`[SEC Provider] No API key configured, skipping ${fundCode}`);
      return null;
    }

    try {
      const url = `https://api.sec.or.th/FundFactsheet/fund/daily?fund_code=${encodeURIComponent(fundCode)}`;
      const res = await fetch(url, {
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey,
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        console.error(`[SEC Provider] HTTP ${res.status} for ${fundCode}`);
        return null;
      }

      const data = await res.json();
      // SEC API returns an array; take the latest entry
      if (!Array.isArray(data) || data.length === 0) return null;

      const latest = data[0];
      const navDate = latest.nav_date?.substring(0, 10);
      const navPerUnit = parseFloat(latest.last_val);

      if (!navDate || isNaN(navPerUnit) || navPerUnit <= 0) return null;

      return {
        fundCode,
        navDate,
        navPerUnit,
        source: "sec_th",
      };
    } catch (err) {
      console.error(`[SEC Provider] Error fetching ${fundCode}:`, err);
      return null;
    }
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
