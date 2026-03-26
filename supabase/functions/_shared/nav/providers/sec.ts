import type { NavProvider, NavResult } from "../types.ts";
import { SecApiClient, delay, THROTTLE_DELAY_MS } from "../../sec-api/client.ts";

const NORM = (s: string): string => s.trim().toUpperCase();

/**
 * SEC Thailand NAV Provider
 *
 * Uses the Fund Daily Info API to fetch daily NAV by proj_id.
 * proj_id resolution is handled externally via the injected projIdMap
 * (sourced from sec_fund_directory).
 */
export class SecThNavProvider implements NavProvider {
  private client: SecApiClient;

  constructor() {
    // Prefer SEC_DAILY_API_KEY; fall back to SEC_API_KEY
    const dailyKey = Deno.env.get("SEC_DAILY_API_KEY") ?? "";
    const fallbackKey = Deno.env.get("SEC_API_KEY") ?? "";
    const apiKey = dailyKey || fallbackKey;

    if (dailyKey) {
      console.log("[SEC] Using SEC_DAILY_API_KEY");
    } else if (fallbackKey) {
      console.log("[SEC] Using SEC_API_KEY as fallback for Daily NAV");
    }

    this.client = new SecApiClient(apiKey);
  }

  async fetchLatestNavForFund(fundCode: string, projId?: string): Promise<NavResult | null> {
    if (!projId) {
      console.warn(`[SEC] No projId provided for ${fundCode} — skipping`);
      return null;
    }

    console.log(`[SEC] Fund ${fundCode} → proj_id ${projId}`);

    try {
      const today = new Date();
      for (let daysBack = 0; daysBack < 5; daysBack++) {
        const date = new Date(today);
        date.setDate(date.getDate() - daysBack);
        const dateStr = date.toISOString().substring(0, 10);

        const result = await this.client.fetchDailyNav(projId, dateStr, "[SEC]");

        if (result.status === "auth_error") {
          return null;
        }

        if (result.status === "no_data" || result.status === "error") {
          await delay(THROTTLE_DELAY_MS);
          continue;
        }

        return {
          fundCode,
          navDate: dateStr,
          navPerUnit: result.navPerUnit,
          source: "sec_th",
        };
      }

      console.warn(`[SEC] No NAV data found for ${fundCode} (proj_id=${projId}) in last 5 days`);
      return null;
    } catch (err) {
      console.error(`[SEC] Error fetching ${fundCode} (proj_id=${projId}):`, err);
      return null;
    }
  }

  async fetchLatestNavForFunds(fundCodes: string[], projIdMap?: Map<string, string>): Promise<NavResult[]> {
    if (!projIdMap || projIdMap.size === 0) {
      throw new Error("projIdMap is required for SEC provider — ensure sec_fund_directory is populated");
    }

    const results: NavResult[] = [];
    for (let i = 0; i < fundCodes.length; i++) {
      const code = fundCodes[i];
      const projId = projIdMap.get(NORM(code));

      if (!projId) {
        console.warn(`[SEC] No proj_id in map for ${code} — skipping`);
        continue;
      }

      const result = await this.fetchLatestNavForFund(code, projId);
      if (result) results.push(result);

      if (i < fundCodes.length - 1) {
        await delay(THROTTLE_DELAY_MS);
      }
    }
    return results;
  }
}
